import { Ripple } from '../lib/ripple';
import { Basin } from '../lib/basin';
import { StateLake } from './state-lake';
import { ExchangeClient } from '../lib/exchange';

interface ValidationForestConfig {
  nodeName?: string;
  stateLake: StateLake;
  exchangeClient: ExchangeClient | any;
}

export class ValidationForest {
  nodeName: string;
  stateLake: StateLake;
  exchangeClient: any;
  basin: Basin;
  rules: Record<string, any>;
  rejectionLog: any[];
  liquidationLog: any[];

  constructor(config: ValidationForestConfig) {
    this.nodeName = config.nodeName || 'validation-forest';
    this.stateLake = config.stateLake;
    this.exchangeClient = config.exchangeClient;
    this.basin = new Basin({
      nodeName: this.nodeName,
      terrain: 'forest',
      depth: 500,
      absorptionRate: 0.4,
      overflowThreshold: 0.85,
    });
    this.rules = {
      maxPositionSize: 10000,
      maxDrawdown: 0.10,
      stopLoss: 0.05,
      allowedAssets: ['BTC', 'ETH', 'SOL', 'DOGE'],
      maxDailyTrades: 50,
    };
    this.rejectionLog = [];
    this.liquidationLog = [];
  }

  async receive(ripple: Ripple): Promise<any> {
    const result = this.basin.receive(ripple);

    if (ripple.scent.type === 'signal' || ripple.scent.type === 'order') {
      const validation = await this.validateSignal(ripple);
      if (!validation.passed) {
        this.rejectionLog.push({ rippleId: ripple.id, reason: validation.reason, timestamp: Date.now() });
        return this.createRejectionRipple(ripple, validation.reason || 'unknown');
      }
    }

    if (ripple.type === 'HEARTBEAT' || ripple.scent.type === 'state') {
      return await this.checkLiquidations();
    }

    return result;
  }

  async validateSignal(ripple: Ripple): Promise<{ passed: boolean; reason?: string }> {
    const signal = ripple.payload;
    const state = this.stateLake.getState();

    if (!this.rules.allowedAssets.includes(signal.asset)) {
      return { passed: false, reason: `Asset ${signal.asset} not allowed` };
    }

    if (signal.positionSize > this.rules.maxPositionSize) {
      return { passed: false, reason: `Position size exceeds max ${this.rules.maxPositionSize}` };
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyTrades = state.closedPositions.filter((p: any) =>
      new Date(p.closedAt).toISOString().startsWith(today)
    ).length;
    if (dailyTrades >= this.rules.maxDailyTrades) {
      return { passed: false, reason: `Daily trade limit ${this.rules.maxDailyTrades} reached` };
    }

    const activeForAsset = Object.values(state.directives).filter((d: any) =>
      d.status === 'ACTIVE' && d.asset === signal.asset
    );
    if (activeForAsset.length > 0 && signal.action === 'OPEN') {
      return { passed: false, reason: `Active directive exists for ${signal.asset}` };
    }

    return { passed: true };
  }

  async checkLiquidations(): Promise<Ripple[]> {
    const state = this.stateLake.getState();
    const liquidations: Ripple[] = [];

    for (const [asset, position] of Object.entries(state.openPositions)) {
      const currentPrice = await this.exchangeClient.getPrice(asset);
      const entryPrice = (position as any).entryPrice;
      const drawdown = (entryPrice - currentPrice) / entryPrice;

      if (drawdown >= this.rules.stopLoss) {
        const directiveId = this.findDirectiveForAsset(asset, state);
        const liq = new Ripple({
          source: this.nodeName,
          target: 'state-lake',
          type: 'INVALIDATION',
          payload: {
            event: 'LIQUIDATION_COMPLETE',
            directiveId,
            asset,
            liquidationReason: 'stop_loss',
            liquidatedBy: this.nodeName,
            realizedPnl: (currentPrice - entryPrice) * (position as any).quantity,
            entryPrice,
            exitPrice: currentPrice,
            drawdown,
          },
          scent: { type: 'state', asset, urgency: 'critical' },
          intensity: 1.0,
          elevation: 800,
        });
        liquidations.push(liq);
        this.liquidationLog.push({ asset, entryPrice, exitPrice: currentPrice, drawdown, timestamp: Date.now() });
      }
    }

    return liquidations;
  }

  findDirectiveForAsset(asset: string, state: any): string {
    const directives = Object.entries(state.directives);
    const match = directives.find(([id, d]: [string, any]) => d.asset === asset && d.status === 'ACTIVE');
    return match ? match[0] : `unknown-${asset}`;
  }

  createRejectionRipple(originalRipple: Ripple, reason: string): Ripple {
    return new Ripple({
      source: this.nodeName,
      target: originalRipple.source,
      type: 'ALERT',
      payload: { event: 'SIGNAL_REJECTED', originalRippleId: originalRipple.id, reason },
      scent: { type: 'alert', severity: 'warning' },
      intensity: 0.7,
      elevation: 600,
    });
  }

  getStats(): any {
    return {
      rejections: this.rejectionLog.length,
      liquidations: this.liquidationLog.length,
      basin: this.basin.snapshot(),
    };
  }
}