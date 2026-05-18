import express from 'express';
import cors from 'cors';
import { StateLake } from '../nodes/state-lake';
import { ValidationForest } from '../nodes/validation-forest';
import { Watershed } from '../lib/watershed';

const app = express();
app.use(cors());
app.use(express.json());

// --- Mock exchange client for paper trading ---
const mockExchange = {
  async getPositions() { return {}; },
  async getPrice(asset: string) { return 100; },
  async createOrder() { return { id: 'paper-' + Date.now() }; }
};

// --- Initialize the watershed (node registry) ---
const watershed = new Watershed();

// --- Initialize Lake ---
const lake = new StateLake({
  nodeName: 'state-lake',
  exchangeClient: mockExchange as any,
  stateStore: {
    async save(state: any) { /* TODO: persist to disk */ },
    async load() { return null; }
  }
});

// --- Initialize Forest ---
const forest = new ValidationForest({
  stateLake: lake,
  exchangeClient: mockExchange as any
});

// --- Register nodes ---
watershed.register('state-lake', { elevation: 100, terrain: 'lake', handler: lake });
watershed.register('validation-forest', { elevation: 700, terrain: 'forest', handler: forest });

// --- API Routes (for dashboard) ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    nodes: watershed.snapshot(),
    lake: lake.getBasinSnapshot(),
    forest: forest.getStats()
  });
});

app.get('/api/state', (req, res) => {
  res.json(lake.getState());
});

app.get('/api/positions', (req, res) => {
  res.json(lake.getState().openPositions);
});

// --- Receive Ripples from other nodes ---
app.post('/api/ripple', async (req, res) => {
  const ripple = req.body;
  
  if (ripple.target === 'state-lake') {
    await lake.receive(ripple);
  } else if (ripple.target === 'validation-forest') {
    await forest.receive(ripple);
  }
  
  res.json({ received: true, id: ripple.id