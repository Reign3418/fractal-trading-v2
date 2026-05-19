import express from 'express';
import cors from 'cors';
import { Ripple } from '../lib/ripple';
import { StateLake } from '../nodes/state-lake';
import { ValidationForest } from '../nodes/validation-forest';
import { TradingRiver } from '../nodes/trading-river';
import { AnalysisOcean } from '../nodes/analysis-ocean';
import { StrategyCity } from '../nodes/strategy-city';
import { Watershed } from '../lib/watershed';
import { ExchangeClient } from '../lib/exchange';
import { MarketCoast } from '../nodes/market-coast';
import { PerformanceTracker } from '../lib/tracker';
import { ExecutionMountain } from '../nodes/execution-mountain';

const app = express();
app.use(cors());
app.use(express.json());

// ===================================================================
// EXCHANGE CLIENT (Paper or Live)
// ===================================================================
const exchangeClient = new ExchangeClient({
  mode: (process.env.TRADING_MODE as 'paper' | 'live') || 'paper',
  exchangeId: process.env.EXCHANGE_ID || 'binance',
  apiKey: process.env.EXCHANGE_API_KEY,
  secret: process.env.EXCHANGE_SECRET || process.env.EXCHANGE_API_SECRET,
  sandbox: process.env.EXCHANGE_SANDBOX !== 'false',
});

// Backward-compat wrapper for test endpoints
const mockExchange = {
  positions: {} as Record<string, any>,
  async getPositions() { return exchangeClient.getPositions(); },
  async getPrice(asset: string) { return exchangeClient.getPrice(asset); },
  async createOrder(order: any) { return exchangeClient.createOrder(order); },
  addPosition(asset: string, quantity: number, entryPrice: number) {
    exchangeClient.addPosition(asset, quantity, entryPrice);
    this.positions = exchangeClient.paperExchange.positions;
  },
  setPrice(asset: string, price: number) { exchangeClient.setPrice(asset, price); },
  reset() { exchangeClient.reset(); this.positions = {}; },
};

// ===================================================================
// PERFORMANCE TRACKER
// ===================================================================
const tracker = new PerformanceTracker(100000); // $100k starting balance

// ===================================================================
// EXECUTION MOUNTAIN
// ===================================================================
const mountain = new ExecutionMountain({ nodeName: 'execution-mountain', exchangeClient, tracker });

const stateStore = {
  data: null as any,
  async save(state: any) { this.data = JSON.parse(JSON.stringify(state)); },
  async load() { return this.data; },
};

// ===================================================================
// WATERSHED
// ===================================================================
const watershed = new Watershed();

// ===================================================================
// NODES
// ===================================================================
const lake = new StateLake({ nodeName: 'state-lake', exchangeClient: mockExchange, stateStore });
const forest = new ValidationForest({ nodeName: 'validation-forest', stateLake: lake, exchangeClient: mockExchange });
const river = new TradingRiver({ nodeName: 'trading-river', watershed });
const ocean = new AnalysisOcean({ nodeName: 'analysis-ocean', exchangeClient });
const city = new StrategyCity({ nodeName: 'strategy-city', watershed });
const coast = new MarketCoast({ nodeName: 'market-coast', exchangeClient, trackedAssets: ['BTC', 'ETH', 'SOL'] });

watershed.register('state-lake', { elevation: 100, terrain: 'lake', handler: lake });
watershed.register('validation-forest', { elevation: 700, terrain: 'forest', handler: forest });
watershed.register('trading-river', { elevation: 400, terrain: 'river', handler: river });
watershed.register('analysis-ocean', { elevation: 250, terrain: 'ocean', handler: ocean });
watershed.register('strategy-city', { elevation: 600, terrain: 'city', handler: city });
watershed.register('market-coast', { elevation: 150, terrain: 'coast', handler: coast });
watershed.register('execution-mountain', { elevation: 300, terrain: 'mountain', handler: mountain });

// ===================================================================
// RIPPLE ROUTER
// ===================================================================
async function routeRipple(ripple: Ripple): Promise<any> {
  console.log(`[WATERSHED] ${ripple.type} from ${ripple.source}`);
  const routes = watershed.route(ripple);
  for (const route of routes) {
    const { nodeName } = route;
    if (nodeName === 'state-lake') await lake.receive(route.ripple);
    else if (nodeName === 'validation-forest') await forest.receive(route.ripple);
    else if (nodeName === 'trading-river') await river.receive(route.ripple);
    else if (nodeName === 'analysis-ocean') await ocean.receive(route.ripple);
    else if (nodeName === 'strategy-city') await city.receive(route.ripple);
    else if (nodeName === 'market-coast') await coast.receive(route.ripple);
    else if (nodeName === 'execution-mountain') await mountain.receive(route.ripple);
  }
  return { routedTo: routes.map(r => r.nodeName) };
}

// ===================================================================
// API ROUTES
// ===================================================================

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    nodes: watershed.snapshot(),
    basin: lake.getBasinSnapshot(),
    forest: forest.getStats(),
    river: river.getStats(),
    ocean: ocean.getStats(),
    city: city.getStats(),
    coast: coast.getStatus(),
    exchange: exchangeClient.getStatus(),
    mountain: mountain.getStats(),
    tracker: tracker.getSnapshot(),
  });
});

app.get('/api/state', (_req, res) => { res.json(lake.getState()); });
app.get('/api/positions', (_req, res) => { res.json(lake.getState().openPositions); });
app.get('/api/decisions', (_req, res) => { res.json(lake.getDecisionLog(50)); });
app.get('/api/queue', (_req, res) => { res.json(river.getQueue()); });
app.get('/api/routes', (_req, res) => { res.json(river.getRoutingLog(50)); });

// ===================================================================
// DIRECT COMMIT
// ===================================================================
app.post('/api/commit', async (req, res) => {
  const { event, asset, directiveId, position, directive } = req.body;

  if (event === 'POSITION_UPDATE' && asset && position) {
    lake.canonicalState.openPositions[asset] = { ...position, updatedAt: Date.now() };
    mockExchange.addPosition(asset, position.quantity, position.entryPrice);
    lake.canonicalState.lastCommit = Date.now();
  }

  if (event === 'LIQUIDATION_COMPLETE' && asset) {
    delete lake.canonicalState.openPositions[asset];
    if (directiveId && lake.canonicalState.directives[directiveId]) {
      lake.canonicalState.directives[directiveId].status = 'VOID';
      lake.canonicalState.directives[directiveId].invalidatedAt = Date.now();
    }
    lake.canonicalState.closedPositions.push({ asset, closedAt: Date.now(), reason: 'liquidation', liquidatedBy: 'validation-forest' });
    lake.canonicalState.lastCommit = Date.now();
  }

  if (event === 'DIRECTIVE_CREATED' && directiveId && directive) {
    lake.canonicalState.directives[directiveId] = { ...directive, status: 'ACTIVE', createdAt: Date.now() };
    lake.canonicalState.lastCommit = Date.now();
  }

  res.json({ committed: true, state: lake.getState() });
});

// ===================================================================
// RIPPLE ENDPOINT
// ===================================================================
app.post('/api/ripple', async (req, res) => {
  const ripple = new Ripple(req.body);
  const result = await routeRipple(ripple);
  res.json({ received: true, id: ripple.id, routed: result.routedTo });
});

// ===================================================================
// HEARTBEAT — Coast fetches → Ocean analyzes → City signals → Mountain executes → Forest detects → Lake commits
// ===================================================================
app.post('/api/heartbeat', async (_req, res) => {
  console.log('[API] Heartbeat — Coast fetches → Ocean analyzes → City signals → Mountain executes → Forest detects → Lake commits');

  // Step 1: Coast fetches prices
  await coast.fetchPrices();

  // Step 2: Ocean analyzes
  const analysisAssets = coast.trackedAssets;
  const analyses: any[] = [];
  for (const asset of analysisAssets) {
    try {
      const result = await ocean.analyze(asset);
      analyses.push({ asset, signal: result.overallSignal, confidence: result.confidence });
    } catch (e) { console.log(`[API] Analysis failed:`, (e as Error).message); }
  }

  // Step 3: City generates signals from analysis (analysis → signal → execution)
  // This happens through ripple routing when ocean sends ANALYSIS ripples

  // Step 4: Forest checks liquidations
  const liquidations = await forest.checkLiquidations();

  // Step 5: Route liquidations through mountain for P&L tracking
  for (const liq of liquidations) {
    await mountain.receive(liq); // Track liquidation P&L
    await river.receive(liq);

    const asset = liq.payload.asset;
    const directiveId = liq.payload.directiveId;

    delete lake.canonicalState.openPositions[asset];
    if (directiveId && lake.canonicalState.directives[directiveId]) {
      lake.canonicalState.directives[directiveId].status = 'VOID';
      lake.canonicalState.directives[directiveId].invalidatedAt = Date.now();
    }
    lake.canonicalState.closedPositions.push({ asset, closedAt: Date.now(), reason: 'stop_loss', liquidatedBy: 'validation-forest' });
    exchangeClient.paperExchange.positions[asset] && delete exchangeClient.paperExchange.positions[asset];
    mockExchange.positions[asset] && delete mockExchange.positions[asset];
    lake.canonicalState.lastCommit = Date.now();
    lake.logDecision('LIQUIDATION', { asset, directiveId, price: liq.payload.exitPrice });
  }

  // Step 6: Update equity tracking
  const prices: Record<string, number> = {};
  for (const [asset, data] of coast.priceCache) {
    prices[asset] = data.price;
  }
  tracker.recordEquity(100000 + tracker.getTotalPnl(), tracker.getUnrealizedPnl(prices));

  res.json({
    heartbeat: true,
    liquidationsDetected: liquidations.length,
    analysesRun: analyses.length,
    analysisSummary: analyses,
    pricesFetched: coast.priceCache.size,
    tracker: tracker.getSnapshot(prices),
    nodesChecked: ['market-coast', 'validation-forest', 'analysis-ocean', 'trading-river', 'strategy-city', 'execution-mountain', 'state-lake'],
    state: lake.getState(),
  });
});

// ===================================================================
// STRATEGY CITY ENDPOINTS
// ===================================================================
app.get('/api/strategies', (_req, res) => { res.json(city.getStrategies()); });

app.post('/api/strategies', (req, res) => {
  const strategy = city.createStrategy(req.body);
  res.json({ created: true, strategy });
});

app.post('/api/strategies/:id/activate', (req, res) => {
  const ok = city.activateStrategy(req.params.id);
  res.json({ activated: ok });
});

app.post('/api/strategies/:id/pause', (req, res) => {
  const ok = city.pauseStrategy(req.params.id);
  res.json({ paused: ok });
});

app.delete('/api/strategies/:id', (req, res) => {
  const ok = city.deleteStrategy(req.params.id);
  res.json({ deleted: ok });
});

app.post('/api/strategies/:id/params', (req, res) => {
  const ok = city.updateStrategyParams(req.params.id, req.body);
  res.json({ updated: ok });
});

app.post('/api/strategies/:id/backtest', (req, res) => {
  const result = city.runBacktest(req.params.id, req.body.candles || []);
  res.json({ backtest: true, result });
});

app.get('/api/signals', (_req, res) => { res.json(city.getSignalLog(50)); });

// ===================================================================
// ANALYSIS OCEAN ENDPOINTS
// ===================================================================
app.get('/api/analysis', (_req, res) => { res.json(ocean.getStats()); });

app.get('/api/analysis/:asset', (req, res) => {
  res.json(ocean.getAnalysisHistory(req.params.asset, 10));
});

app.post('/api/analyze', async (req, res) => {
  const { asset } = req.body;
  const result = await ocean.analyze(asset || 'BTC');
  res.json({ analyzed: true, result });
});

app.get('/api/detectors/:asset', (req, res) => {
  const history = ocean.getAnalysisHistory(req.params.asset, 1);
  res.json(history.length > 0 ? history[0].detectors : []);
});

// ===================================================================
// TRACKING & PERFORMANCE ENDPOINTS
// ===================================================================
app.get('/api/performance', (_req, res) => {
  const prices: Record<string, number> = {};
  for (const [asset, data] of coast.priceCache) {
    prices[asset] = data.price;
  }
  res.json(tracker.getSnapshot(prices));
});

app.get('/api/trades', (req, res) => {
  const { asset, status, limit } = req.query;
  const trades = tracker.getTrades({
    asset: asset as string | undefined,
    status: status as 'OPEN' | 'CLOSED' | undefined,
    limit: limit ? parseInt(limit as string) : 50,
  });
  res.json(trades);
});

app.get('/api/trades/:id', (req, res) => {
  const trade = tracker.trades.get(req.params.id);
  res.json(trade || { error: 'Trade not found' });
});

app.get('/api/equity', (_req, res) => {
  res.json(tracker.getEquityHistory());
});

// ===================================================================
// EXECUTION ENDPOINTS
// ===================================================================
app.post('/api/execute', async (req, res) => {
  const { asset, side, quantity, price, strategyId } = req.body;
  const currentPrice = price || await exchangeClient.getPrice(asset);

  const trade = tracker.recordEntry({
    asset,
    side: side.toUpperCase(),
    quantity,
    price: currentPrice,
    strategyId,
  });

  // Create the order
  const order = await exchangeClient.createOrder({
    asset,
    side,
    type: 'market',
    amount: quantity,
  });

  res.json({ executed: true, tradeId: trade.id, orderId: order.id, price: currentPrice });
});

app.post('/api/close', async (req, res) => {
  const { asset, price, reason } = req.body;
  const exitPrice = price || await exchangeClient.getPrice(asset);
  const closed = await mountain.closePosition(asset, exitPrice, reason || 'manual');
  res.json({ closed: true, trades: closed.map(t => ({ id: t.id, pnl: t.pnl })) });
});

// ===================================================================
// TEST HELPERS
// ===================================================================
app.post('/api/test/set-price', (req, res) => {
  const { asset, price } = req.body;
  mockExchange.setPrice(asset, price);
  res.json({ asset, priceSet: price, currentPrice: mockExchange.getPrice(asset) });
});

app.post('/api/test/reset', (_req, res) => {
  mockExchange.reset();
  lake.canonicalState = { openPositions: {}, closedPositions: [], directives: {}, lastCommit: null, lastExchangeSync: null };
  res.json({ reset: true });
});

// ===================================================================
// EXCHANGE ENDPOINTS
// ===================================================================
app.get('/api/exchange/status', (_req, res) => { res.json(exchangeClient.getStatus()); });

app.post('/api/exchange/configure', (req, res) => {
  const { exchangeId, apiKey, secret, sandbox } = req.body;
  exchangeClient.setCredentials(exchangeId, apiKey, secret, sandbox);
  res.json({ configured: true, status: exchangeClient.getStatus() });
});

app.post('/api/exchange/mode', (req, res) => {
  const { mode } = req.body;
  exchangeClient.setMode(mode);
  res.json({ mode: exchangeClient.mode, status: exchangeClient.getStatus() });
});

app.get('/api/exchange/prices', (_req, res) => { res.json(coast.getPriceCache()); });

app.get('/api/exchange/price/:asset', (req, res) => {
  const price = coast.getPrice(req.params.asset);
  res.json({ asset: req.params.asset, price, timestamp: Date.now() });
});

app.get('/api/exchange/balance', async (_req, res) => {
  const balance = await exchangeClient.getBalance();
  res.json(balance);
});

// ===================================================================
// COAST ENDPOINTS
// ===================================================================
app.get('/api/coast/status', (_req, res) => { res.json(coast.getStatus()); });

app.post('/api/coast/start', (req, res) => {
  const { intervalMs } = req.body;
  coast.startFeed(intervalMs || 30000);
  res.json({ started: true, status: coast.getStatus() });
});

app.post('/api/coast/stop', (_req, res) => {
  coast.stopFeed();
  res.json({ stopped: true, status: coast.getStatus() });
});

app.get('/api/coast/prices', (_req, res) => { res.json(coast.getPriceCache()); });

app.post('/api/coast/assets', (req, res) => {
  coast.trackedAssets = req.body.assets || ['BTC', 'ETH', 'SOL'];
  res.json({ updated: true, trackedAssets: coast.trackedAssets });
});

// ===================================================================
// DASHBOARD (production only)
// ===================================================================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dashboard/dist'));
  app.get('*', (_req, res) => { res.sendFile('dashboard/dist/index.html', { root: process.cwd() }); });
}

// ===================================================================
// START
// ===================================================================
// Auto-start coast feed
coast.startFeed(30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fractal Trading v2 on port ${PORT}`);
  console.log(`Nodes: state-lake, validation-forest, trading-river, market-coast, analysis-ocean, strategy-city, execution-mountain`);
  console.log(`POST /api/heartbeat — Coast → Ocean → City → Mountain → Forest → Lake`);
});

export default app;
