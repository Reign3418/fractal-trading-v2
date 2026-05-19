import { Ripple } from '../lib/ripple';
import { Basin } from '../lib/basin';
import { ExchangeClient } from '../lib/exchange';
import { MarketData } from '../types';

interface MarketCoastConfig {
  nodeName?: string;
  exchangeClient: ExchangeClient;
  trackedAssets?: string[];
}

export class MarketCoast {
  nodeName: string = 'market-coast';
  elevation = 150;
  terrain = 'coast' as const;
  basin: Basin;
  exchangeClient: ExchangeClient;
  trackedAssets: string[];
  priceCache: Map<string, MarketData>;
  ohlcvCache: Map<string, any[]>;
  feedInterval: any;
  isRunning: boolean;
  lastFetch: number;

  constructor(config: MarketCoastConfig) {
    this.nodeName = config.nodeName || 'market-coast';
    this.exchangeClient = config.exchangeClient;
    this.trackedAssets = config.trackedAssets || ['BTC', 'ETH', 'SOL'];
    this.basin = new Basin({
      nodeName: this.nodeName,
      terrain: 'coast',
      depth: 500,
      absorptionRate: 0.30,
      overflowThreshold: 0.75,
    });
    this.priceCache = new Map();
    this.ohlcvCache = new Map();
    this.isRunning = false;
    this.lastFetch = 0;
  }

  async receive(ripple: Ripple): Promise<any> {
    const result = this.basin.receive(ripple);

    if (ripple.type === 'HEARTBEAT') {
      await this.fetchPrices();
      return { pricesUpdated: this.priceCache.size };
    }

    if (ripple.scent.type === 'data' && ripple.payload.asset) {
      const candles = await this.fetchOHLCV(
        ripple.payload.asset,
        ripple.payload.timeframe,
        ripple.payload.limit
      );
      await this.broadcastOHLCV(ripple.payload.asset, candles);
    }

    return result;
  }

  async fetchPrices(): Promise<void> {
    const now = Date.now();
    for (const asset of this.trackedAssets) {
      try {
        const price = await this.exchangeClient.getPrice(asset);
        const ticker24h = await this.exchangeClient.get24hTicker(asset);
        this.priceCache.set(asset, {
          asset,
          price,
          change24h: ticker24h.change,
          volume24h: ticker24h.volume,
          high24h: ticker24h.high,
          low24h: ticker24h.low,
          timestamp: now,
        });
      } catch (e: any) {
        console.warn(
          `[${this.nodeName}] Price fetch failed for ${asset}: ${e.message}`
        );
      }
    }
    this.lastFetch = now;
    console.log(
      `[${this.nodeName}] Prices updated for ${this.trackedAssets.length} assets`
    );
  }

  async fetchOHLCV(
    asset: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<any[]> {
    try {
      const candles = await this.exchangeClient.getOHLCV(
        asset,
        timeframe,
        limit
      );
      this.ohlcvCache.set(asset, candles);
      return candles;
    } catch (e: any) {
      console.warn(
        `[${this.nodeName}] OHLCV fetch failed for ${asset}: ${e.message}`
      );
      return this.ohlcvCache.get(asset) || [];
    }
  }

  async broadcastPriceUpdate(asset: string, price: number): Promise<void> {
    // This is handled internally; coast doesn't emit ripples directly
    // Other nodes read from priceCache
    console.log(
      `[${this.nodeName}] Price update: ${asset} = $${price.toLocaleString()}`
    );
  }

  async broadcastOHLCV(asset: string, candles: any[]): Promise<void> {
    console.log(
      `[${this.nodeName}] OHLCV update: ${asset} = ${candles.length} candles`
    );
  }

  startFeed(intervalMs: number = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(
      `[${this.nodeName}] Starting market feed (${intervalMs}ms)`
    );
    this.fetchPrices();
    this.feedInterval = setInterval(() => this.fetchPrices(), intervalMs);
  }

  stopFeed(): void {
    this.isRunning = false;
    if (this.feedInterval) {
      clearInterval(this.feedInterval);
      this.feedInterval = null;
    }
    console.log(`[${this.nodeName}] Market feed stopped`);
  }

  getPrice(asset: string): number {
    return this.priceCache.get(asset)?.price || 0;
  }

  getPriceCache(): MarketData[] {
    return Array.from(this.priceCache.values());
  }

  getOHLCV(asset: string): any[] {
    return this.ohlcvCache.get(asset) || [];
  }

  getStatus(): any {
    return {
      isRunning: this.isRunning,
      trackedAssets: this.trackedAssets,
      priceCacheSize: this.priceCache.size,
      ohlcvCacheSize: this.ohlcvCache.size,
      lastFetch: this.lastFetch,
      exchange: this.exchangeClient.getStatus(),
      basin: this.basin.snapshot(),
    };
  }

  getBasinSnapshot(): any {
    return this.basin.snapshot();
  }
}
