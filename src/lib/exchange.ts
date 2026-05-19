export class ExchangeClient {
  mode: 'paper' | 'live';
  exchangeId: string;
  apiKey?: string;
  secret?: string;
  sandbox: boolean;
  ccxtExchange: any | null;
  paperExchange: {
    positions: Record<string, { quantity: number; entryPrice: number; currentPrice: number }>;
    balances: Record<string, number>;
  };

  constructor(config: {
    mode?: 'paper' | 'live';
    exchangeId?: string;
    apiKey?: string;
    secret?: string;
    sandbox?: boolean;
  }) {
    this.mode = config.mode || 'paper';
    this.exchangeId = config.exchangeId || 'binance';
    this.apiKey = config.apiKey;
    this.secret = config.secret;
    this.sandbox = config.sandbox ?? true;
    this.ccxtExchange = null;
    this.paperExchange = {
      positions: {},
      balances: { USDT: 100000, BTC: 0, ETH: 0, SOL: 0, DOGE: 0 },
    };
    if (this.mode === 'live') {
      this.initCCXT();
    }
  }

  private initCCXT(): void {
    try {
      // Dynamic require for ccxt — graceful fallback if not installed
      const ccxt = require('ccxt');
      const ExchangeClass = ccxt[this.exchangeId];
      if (ExchangeClass) {
        this.ccxtExchange = new ExchangeClass({
          apiKey: this.apiKey,
          secret: this.secret,
          enableRateLimit: true,
          sandbox: this.sandbox,
        });
        console.log(`[EXCHANGE] CCXT initialized: ${this.exchangeId}`);
      } else {
        console.warn(
          `[EXCHANGE] CCXT exchange '${this.exchangeId}' not found, falling back to paper`
        );
        this.mode = 'paper';
      }
    } catch (err: any) {
      console.warn(
        `[EXCHANGE] CCXT not available: ${err.message}, using paper mode`
      );
      this.mode = 'paper';
      this.ccxtExchange = null;
    }
  }

  async getPrice(asset: string): Promise<number> {
    if (this.mode === 'live' && this.ccxtExchange) {
      try {
        const symbol = this.toSymbol(asset);
        const ticker = await this.ccxtExchange.fetchTicker(symbol);
        return ticker.last || 0;
      } catch (e: any) {
        console.warn(
          `[EXCHANGE] Live price fetch failed for ${asset}: ${e.message}`
        );
      }
    }
    // Paper fallback
    return this.paperExchange.positions[asset]?.currentPrice || 0;
  }

  async getPrices(assets: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const asset of assets) {
      result[asset] = await this.getPrice(asset);
    }
    return result;
  }

  async getOHLCV(
    asset: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<any[]> {
    if (this.mode === 'live' && this.ccxtExchange) {
      try {
        const symbol = this.toSymbol(asset);
        const ohlcv = await this.ccxtExchange.fetchOHLCV(
          symbol,
          timeframe,
          undefined,
          limit
        );
        return ohlcv.map((c: any[]) => ({
          timestamp: c[0],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5],
        }));
      } catch (e: any) {
        console.warn(
          `[EXCHANGE] OHLCV fetch failed for ${asset}: ${e.message}`
        );
      }
    }
    // Paper fallback — generate simulated OHLCV
    return this.generateSimulatedOHLCV(asset, limit);
  }

  generateSimulatedOHLCV(asset: string, limit: number): any[] {
    const basePrice =
      this.paperExchange.positions[asset]?.currentPrice || 50000;
    const candles: any[] = [];
    let price = basePrice;
    const now = Date.now();
    for (let i = limit; i > 0; i--) {
      const ts = now - i * 3600000;
      const change = (Math.random() - 0.48) * price * 0.02;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      const volume = Math.random() * 1000 + 100;
      candles.push({ timestamp: ts, open, high, low, close, volume });
      price = close;
    }
    return candles;
  }

  async createOrder(order: {
    asset: string;
    side: string;
    type?: string;
    amount: number;
    price?: number;
  }): Promise<any> {
    if (this.mode === 'live' && this.ccxtExchange) {
      try {
        const symbol = this.toSymbol(order.asset);
        const result = await this.ccxtExchange.createOrder(
          symbol,
          order.type || 'market',
          order.side,
          order.amount,
          order.price
        );
        return {
          id: result.id,
          status: result.status,
          filled: result.filled,
        };
      } catch (e: any) {
        console.error(`[EXCHANGE] Order failed: ${e.message}`);
        throw e;
      }
    }
    // Paper trading
    if (order.side === 'buy') {
      const price =
        order.price ||
        this.paperExchange.positions[order.asset]?.currentPrice ||
        50000;
      this.paperExchange.positions[order.asset] = {
        quantity: order.amount,
        entryPrice: price,
        currentPrice: price,
      };
      const cost = order.amount * price;
      this.paperExchange.balances['USDT'] =
        (this.paperExchange.balances['USDT'] || 0) - cost;
    } else if (order.side === 'sell') {
      delete this.paperExchange.positions[order.asset];
    }
    return { id: `paper-${Date.now()}`, status: 'filled' };
  }

  async getPositions(): Promise<Record<string, any>> {
    if (this.mode === 'live' && this.ccxtExchange) {
      try {
        const positions = await this.ccxtExchange.fetchPositions();
        const result: Record<string, any> = {};
        for (const p of positions) {
          if (p.contracts > 0) {
            const asset = p.symbol.split('/')[0];
            result[asset] = {
              quantity: p.contracts,
              entryPrice: p.entryPrice,
              currentPrice: p.markPrice,
            };
          }
        }
        return result;
      } catch (e: any) {
        console.warn(`[EXCHANGE] Positions fetch failed: ${e.message}`);
      }
    }
    return { ...this.paperExchange.positions };
  }

  async getBalance(): Promise<Record<string, number>> {
    if (this.mode === 'live' && this.ccxtExchange) {
      try {
        const balance = await this.ccxtExchange.fetchBalance();
        const result: Record<string, number> = {};
        for (const [key, val] of Object.entries(balance.total || {})) {
          if ((val as number) > 0) result[key] = val as number;
        }
        return result;
      } catch (e: any) {
        console.warn(`[EXCHANGE] Balance fetch failed: ${e.message}`);
      }
    }
    return { ...this.paperExchange.balances };
  }

  async get24hTicker(
    asset: string
  ): Promise<{ change: number; volume: number; high: number; low: number }> {
    if (this.mode === 'live' && this.ccxtExchange) {
      try {
        const symbol = this.toSymbol(asset);
        const ticker = await this.ccxtExchange.fetchTicker(symbol);
        return {
          change: ticker.percentage || 0,
          volume: ticker.baseVolume || 0,
          high: ticker.high || 0,
          low: ticker.low || 0,
        };
      } catch (e: any) {
        console.warn(`[EXCHANGE] 24h ticker failed: ${e.message}`);
      }
    }
    return { change: 0, volume: 0, high: 0, low: 0 };
  }

  isLive(): boolean {
    return this.mode === 'live';
  }

  getStatus(): {
    mode: string;
    exchangeId: string;
    connected: boolean;
    sandbox: boolean;
  } {
    return {
      mode: this.mode,
      exchangeId: this.exchangeId,
      connected: this.mode === 'live' ? this.ccxtExchange !== null : true,
      sandbox: this.sandbox,
    };
  }

  setMode(mode: 'paper' | 'live'): void {
    this.mode = mode;
    if (mode === 'live') {
      this.initCCXT();
    } else {
      this.ccxtExchange = null;
    }
  }

  setCredentials(
    exchangeId: string,
    apiKey: string,
    secret: string,
    sandbox?: boolean
  ): void {
    this.exchangeId = exchangeId;
    this.apiKey = apiKey;
    this.secret = secret;
    if (sandbox !== undefined) this.sandbox = sandbox;
    if (this.mode === 'live') this.initCCXT();
  }

  addPosition(
    asset: string,
    quantity: number,
    entryPrice: number
  ): void {
    this.paperExchange.positions[asset] = {
      quantity,
      entryPrice,
      currentPrice: entryPrice,
    };
  }

  setPrice(asset: string, price: number): void {
    if (this.paperExchange.positions[asset]) {
      this.paperExchange.positions[asset].currentPrice = price;
    }
  }

  reset(): void {
    this.paperExchange.positions = {};
    this.paperExchange.balances = {
      USDT: 100000,
      BTC: 0,
      ETH: 0,
      SOL: 0,
      DOGE: 0,
    };
  }

  private toSymbol(asset: string): string {
    // Handle assets that may already include a quote currency
    if (asset.includes('/')) {
      return asset;
    }
    return `${asset}/USDT`;
  }
}
