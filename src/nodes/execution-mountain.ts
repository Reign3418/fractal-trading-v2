import { Ripple } from '../lib/ripple';
import { Basin } from '../lib/basin';
import { ExchangeClient } from '../lib/exchange';
import { PerformanceTracker } from '../lib/tracker';
import { Trade } from '../types';

interface ExecutionMountainConfig {
  nodeName?: string;
  exchangeClient: ExchangeClient;
  tracker: PerformanceTracker;
}

export class ExecutionMountain {
  nodeName: string = 'execution-mountain';
  elevation = 300;
  terrain = 'mountain' as const;
  basin: Basin;
  exchangeClient: ExchangeClient;
  tracker: PerformanceTracker;
  orderLog: any[];
  pendingOrders: Map<string, any>;

  constructor(config: ExecutionMountainConfig) {
    this.nodeName = config.nodeName || 'execution-mountain';
    this.exchangeClient = config.exchangeClient;
    this.tracker = config.tracker;
    this.basin = new Basin({
      nodeName: this.nodeName,
      terrain: 'mountain',
      depth: 1000,
      absorptionRate: 0.90,
      overflowThreshold: 0.80,
    });
    this.orderLog = [];
    this.pendingOrders = new Map();
  }

  async receive(ripple: Ripple): Promise<any> {
    const result = this.basin.receive(ripple);

    if (ripple.scent.type === 'signal') {
      return await this.executeSignal(ripple);
    }

    if (ripple.scent.type === 'order') {
      return await this.executeOrder(ripple);
    }

    if (ripple.type === 'INVALIDATION' && ripple.payload.event === 'LIQUIDATION_COMPLETE') {
      return await this.handleLiquidation(ripple);
    }

    return result;
  }

  async executeSignal(ripple: Ripple): Promise<any> {
    const signal = ripple.payload;
    console.log(`[${this.nodeName}] Executing signal: ${signal.side} ${signal.asset}`);

    // Calculate position size (1% of balance per trade)
    const balance = await this.exchangeClient.getBalance();
    const usdtBalance = balance['USDT'] || 100000;
    const positionSize = usdtBalance * 0.01;

    const order = await this.exchangeClient.createOrder({
      asset: signal.asset,
      side: signal.side === 'BUY' ? 'buy' : 'sell',
      type: 'market',
      amount: positionSize / (signal.price || 1),
    });

    // Record in tracker
    const trade = this.tracker.recordEntry({
      asset: signal.asset,
      side: signal.side,
      quantity: positionSize / (signal.price || 1),
      price: signal.price || await this.exchangeClient.getPrice(signal.asset),
      strategyId: signal.strategyId,
    });

    this.orderLog.push({
      type: 'SIGNAL_EXECUTED',
      orderId: order.id,
      tradeId: trade.id,
      asset: signal.asset,
      side: signal.side,
      timestamp: Date.now(),
    });

    return { executed: true, orderId: order.id, tradeId: trade.id };
  }

  async executeOrder(ripple: Ripple): Promise<any> {
    const order = ripple.payload;
    console.log(`[${this.nodeName}] Executing order: ${order.side} ${order.asset}`);

    const result = await this.exchangeClient.createOrder({
      asset: order.asset,
      side: order.side,
      type: order.type || 'market',
      amount: order.quantity,
      price: order.price,
    });

    const side: 'BUY' | 'SELL' = order.side.toUpperCase() === 'BUY' ? 'BUY' : 'SELL';
    const trade = this.tracker.recordEntry({
      asset: order.asset,
      side,
      quantity: order.quantity,
      price: order.price || await this.exchangeClient.getPrice(order.asset),
    });

    return { executed: true, orderId: result.id, tradeId: trade.id };
  }

  async handleLiquidation(ripple: Ripple): Promise<any> {
    const { asset, exitPrice } = ripple.payload;
    console.log(`[${this.nodeName}] Handling liquidation: ${asset}`);

    const closed = this.tracker.closeAllForAsset(asset, exitPrice, 'liquidation');
    return { liquidated: true, tradesClosed: closed.length, asset };
  }

  async closePosition(asset: string, price: number, reason?: string): Promise<Trade[]> {
    const closed = this.tracker.closeAllForAsset(asset, price, (reason || 'signal') as Trade['closeReason']);
    return closed;
  }

  getStats(): any {
    return {
      ordersExecuted: this.orderLog.length,
      pendingOrders: this.pendingOrders.size,
      basin: this.basin.snapshot(),
      tracker: this.tracker.getSnapshot(),
    };
  }

  getBasinSnapshot(): any {
    return this.basin.snapshot();
  }
}
