import { Ripple } from '../lib/ripple';
import { Basin } from '../lib/basin';
import { Watershed } from '../lib/watershed';
import { BasinSnapshot, Strategy, BacktestResult } from '../types';

interface StrategyCityConfig {
  nodeName?: string;
  watershed: Watershed;
}

interface SignalEvaluation {
  action: string;
  side: string;
  confidence: number;
  reason: string;
}

interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  side: string;
  pnl: number;
}

export class StrategyCity {
  nodeName: string = 'strategy-city';
  elevation = 600;
  terrain = 'city' as const;
  basin: Basin;
  watershed: Watershed;
  strategies: Map<string, Strategy>;
  backtests: Map<string, BacktestResult>;
  signalLog: any[];

  constructor(config: StrategyCityConfig) {
    this.nodeName = config.nodeName || 'strategy-city';
    this.watershed = config.watershed;
    this.basin = new Basin({
      nodeName: this.nodeName,
      terrain: 'city',
      depth: 2000,
      absorptionRate: 0.05,
      overflowThreshold: 0.85,
    });
    this.strategies = new Map<string, Strategy>();
    this.backtests = new Map<string, BacktestResult>();
    this.signalLog = [];
    console.log(`[${this.nodeName}] StrategyCity initialized at elevation ${this.elevation}`);
  }

  // Core: handle incoming ripples
  async receive(ripple: Ripple): Promise<any> {
    const result = this.basin.receive(ripple);
    console.log(`[${this.nodeName}] Received ripple type=${ripple.type} from=${ripple.source}`);

    if (ripple.type === 'ANALYSIS') {
      const analysis = ripple.payload;
      const signals: Ripple[] = [];

      for (const strategy of this.strategies.values()) {
        if (strategy.status !== 'active') continue;

        const signalRipple = this.generateSignal(strategy, analysis);
        if (signalRipple) {
          signals.push(signalRipple);
          strategy.signalsGenerated += 1;
          strategy.lastSignalAt = Date.now();
          this.signalLog.push({
            timestamp: Date.now(),
            strategyId: strategy.id,
            strategyName: strategy.name,
            asset: strategy.asset,
            signal: signalRipple.payload,
          });
          if (this.signalLog.length > 10000) {
            this.signalLog = this.signalLog.slice(-5000);
          }
          console.log(`[${this.nodeName}] Generated ${signalRipple.payload.side} signal for ${strategy.asset} via ${strategy.type} strategy`);
        }
      }

      return { basinResult: result, signalsGenerated: signals.length, signals };
    }

    if (ripple.type === 'SIGNAL') {
      this.signalLog.push({
        timestamp: Date.now(),
        forwarded: true,
        source: ripple.source,
        payload: ripple.payload,
      });
      if (this.signalLog.length > 10000) {
        this.signalLog = this.signalLog.slice(-5000);
      }
      console.log(`[${this.nodeName}] Logged incoming SIGNAL ripple from ${ripple.source}`);
      return { basinResult: result, logged: true };
    }

    if (ripple.type === 'OVERFLOW') {
      console.log(`[${this.nodeName}] Received OVERFLOW ripple from ${ripple.source}`);
    }

    if (ripple.type === 'HEARTBEAT') {
      console.log(`[${this.nodeName}] Received HEARTBEAT from ${ripple.source}`);
    }

    return result;
  }

  // Strategy CRUD
  createStrategy(params: Partial<Strategy>): Strategy {
    const id = params.id || `stg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const strategy: Strategy = {
      id,
      name: params.name || `Strategy ${id}`,
      asset: params.asset || 'BTC-USD',
      type: params.type || 'momentum',
      parameters: params.parameters || {},
      status: params.status || 'paused',
      createdAt: params.createdAt || Date.now(),
      lastSignalAt: params.lastSignalAt ?? null,
      signalsGenerated: params.signalsGenerated || 0,
      winCount: params.winCount || 0,
      lossCount: params.lossCount || 0,
    };
    this.strategies.set(id, strategy);
    console.log(`[${this.nodeName}] Created strategy "${strategy.name}" (${id}) type=${strategy.type} asset=${strategy.asset}`);
    return strategy;
  }

  activateStrategy(id: string): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      console.log(`[${this.nodeName}] activateStrategy failed: strategy ${id} not found`);
      return false;
    }
    strategy.status = 'active';
    console.log(`[${this.nodeName}] Activated strategy "${strategy.name}" (${id})`);
    return true;
  }

  pauseStrategy(id: string): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      console.log(`[${this.nodeName}] pauseStrategy failed: strategy ${id} not found`);
      return false;
    }
    strategy.status = 'paused';
    console.log(`[${this.nodeName}] Paused strategy "${strategy.name}" (${id})`);
    return true;
  }

  deleteStrategy(id: string): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      console.log(`[${this.nodeName}] deleteStrategy failed: strategy ${id} not found`);
      return false;
    }
    this.strategies.delete(id);
    console.log(`[${this.nodeName}] Deleted strategy "${strategy.name}" (${id})`);
    return true;
  }

  updateStrategyParams(id: string, params: Record<string, number>): boolean {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      console.log(`[${this.nodeName}] updateStrategyParams failed: strategy ${id} not found`);
      return false;
    }
    strategy.parameters = { ...strategy.parameters, ...params };
    console.log(`[${this.nodeName}] Updated parameters for strategy "${strategy.name}" (${id})`);
    return true;
  }

  // Signal generation
  generateSignal(strategy: Strategy, analysis: any): Ripple | null {
    let evaluation: SignalEvaluation | null = null;

    switch (strategy.type) {
      case 'momentum':
        evaluation = this.evaluateMomentum(analysis);
        break;
      case 'mean_reversion':
        evaluation = this.evaluateMeanReversion(analysis);
        break;
      case 'breakout':
        evaluation = this.evaluateBreakout(analysis);
        break;
      case 'trend_following':
        evaluation = this.evaluateTrendFollowing(analysis);
        break;
      default:
        return null;
    }

    if (!evaluation) {
      return null;
    }

    const signalRipple = new Ripple({
      source: this.nodeName,
      type: 'SIGNAL',
      payload: {
        strategyId: strategy.id,
        strategyName: strategy.name,
        strategyType: strategy.type,
        asset: strategy.asset,
        action: evaluation.action,
        side: evaluation.side,
        confidence: evaluation.confidence,
        reason: evaluation.reason,
        timestamp: Date.now(),
      },
      scent: { type: 'signal', asset: strategy.asset, strategy: strategy.type },
      intensity: evaluation.confidence,
      elevation: this.elevation,
    });

    return signalRipple;
  }

  evaluateMomentum(analysis: any): SignalEvaluation | null {
    const indicators = analysis?.indicators || [];
    const price = analysis?.price;

    if (!price || !Array.isArray(indicators)) {
      return null;
    }

    const rsiIndicator = indicators.find((i: any) => i.name?.toLowerCase() === 'rsi');
    if (!rsiIndicator) {
      return null;
    }

    const rsi = rsiIndicator.value;

    if (rsi < 30) {
      return {
        action: 'enter_long',
        side: 'BUY',
        confidence: 0.7,
        reason: `RSI oversold at ${rsi.toFixed(2)}`,
      };
    }

    if (rsi > 70) {
      return {
        action: 'enter_short',
        side: 'SELL',
        confidence: 0.7,
        reason: `RSI overbought at ${rsi.toFixed(2)}`,
      };
    }

    return null;
  }

  evaluateMeanReversion(analysis: any): SignalEvaluation | null {
    const indicators = analysis?.indicators || [];
    const price = analysis?.price;

    if (!price || !Array.isArray(indicators)) {
      return null;
    }

    const bbIndicator = indicators.find((i: any) => i.name?.toLowerCase() === 'bollingerbands');
    if (!bbIndicator) {
      return null;
    }

    const lower = bbIndicator.lower;
    const upper = bbIndicator.upper;

    if (lower === undefined || upper === undefined) {
      return null;
    }

    if (price < lower) {
      return {
        action: 'enter_long',
        side: 'BUY',
        confidence: 0.65,
        reason: `Price ${price.toFixed(2)} below Bollinger lower band ${lower.toFixed(2)}`,
      };
    }

    if (price > upper) {
      return {
        action: 'enter_short',
        side: 'SELL',
        confidence: 0.65,
        reason: `Price ${price.toFixed(2)} above Bollinger upper band ${upper.toFixed(2)}`,
      };
    }

    return null;
  }

  evaluateBreakout(analysis: any): SignalEvaluation | null {
    const indicators = analysis?.indicators || [];
    const price = analysis?.price;

    if (!price || !Array.isArray(indicators)) {
      return null;
    }

    const supportResistance = indicators.find((i: any) => i.name?.toLowerCase() === 'supportresistance');
    if (!supportResistance) {
      return null;
    }

    const resistance = supportResistance.resistance;
    const support = supportResistance.support;

    if (resistance === undefined || support === undefined) {
      return null;
    }

    if (price > resistance) {
      return {
        action: 'enter_long',
        side: 'BUY',
        confidence: 0.6,
        reason: `Price ${price.toFixed(2)} broke above resistance ${resistance.toFixed(2)}`,
      };
    }

    if (price < support) {
      return {
        action: 'enter_short',
        side: 'SELL',
        confidence: 0.6,
        reason: `Price ${price.toFixed(2)} broke below support ${support.toFixed(2)}`,
      };
    }

    return null;
  }

  evaluateTrendFollowing(analysis: any): SignalEvaluation | null {
    const indicators = analysis?.indicators || [];
    const price = analysis?.price;

    if (!price || !Array.isArray(indicators)) {
      return null;
    }

    const ema20Indicator = indicators.find((i: any) => i.name?.toLowerCase() === 'ema20');
    const ema50Indicator = indicators.find((i: any) => i.name?.toLowerCase() === 'ema50');
    const macdIndicator = indicators.find((i: any) => i.name?.toLowerCase() === 'macd');

    if (!ema20Indicator || !ema50Indicator || !macdIndicator) {
      return null;
    }

    const ema20 = ema20Indicator.value;
    const ema50 = ema50Indicator.value;
    const macd = macdIndicator.value;
    const macdSignal = macdIndicator.signal;

    if (ema20 === undefined || ema50 === undefined || macd === undefined || macdSignal === undefined) {
      return null;
    }

    if (ema20 > ema50 && macd > macdSignal) {
      return {
        action: 'enter_long',
        side: 'BUY',
        confidence: 0.75,
        reason: `EMA20 (${ema20.toFixed(2)}) > EMA50 (${ema50.toFixed(2)}) and MACD (${macd.toFixed(4)}) > Signal (${macdSignal.toFixed(4)})`,
      };
    }

    if (ema20 < ema50 && macd < macdSignal) {
      return {
        action: 'enter_short',
        side: 'SELL',
        confidence: 0.75,
        reason: `EMA20 (${ema20.toFixed(2)}) < EMA50 (${ema50.toFixed(2)}) and MACD (${macd.toFixed(4)}) < Signal (${macdSignal.toFixed(4)})`,
      };
    }

    return null;
  }

  // Backtesting
  runBacktest(strategyId: string, candles: any[]): BacktestResult {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    console.log(`[${this.nodeName}] Running backtest for strategy "${strategy.name}" (${strategyId}) with ${candles.length} candles`);

    const startTime = Date.now();
    strategy.status = 'backtesting';

    const { trades, pnl, maxDrawdown } = this.simulateBacktest(strategy, candles);

    const endTime = Date.now();
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

    // Simplified Sharpe ratio: mean return / std dev
    const returns = trades.map((t) => t.pnl);
    const meanReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const variance = returns.length > 0
      ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

    const backtest: BacktestResult = {
      id: `bt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      strategyId: strategy.id,
      asset: strategy.asset,
      startTime: candles.length > 0 ? candles[0].timestamp : startTime,
      endTime: candles.length > 0 ? candles[candles.length - 1].timestamp : endTime,
      totalTrades,
      winRate,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      pnl,
    };

    this.backtests.set(backtest.id, backtest);
    strategy.status = 'paused';

    console.log(`[${this.nodeName}] Backtest complete: ${totalTrades} trades, PnL=${pnl.toFixed(4)}, WinRate=${(winRate * 100).toFixed(1)}%, MaxDD=${(maxDrawdown * 100).toFixed(2)}%`);

    return backtest;
  }

  simulateBacktest(
    strategy: Strategy,
    candles: any[],
  ): { trades: BacktestTrade[]; pnl: number; maxDrawdown: number } {
    const trades: BacktestTrade[] = [];
    let currentPosition: { side: string; entryPrice: number; entryTime: number } | null = null;
    let runningPnl = 0;
    let peakPnl = 0;
    let maxDrawdown = 0;

    for (const candle of candles) {
      const analysis = {
        price: candle.close,
        indicators: candle.indicators || [],
      };

      const signal = this.generateSignal(strategy, analysis);

      if (signal) {
        const side = signal.payload.side as string;
        const action = signal.payload.action as string;

        // If we have an open position, close it first if signal is opposite
        if (currentPosition) {
          if (
            (currentPosition.side === 'BUY' && side === 'SELL') ||
            (currentPosition.side === 'SELL' && side === 'BUY')
          ) {
            const tradePnl =
              currentPosition.side === 'BUY'
                ? candle.close - currentPosition.entryPrice
                : currentPosition.entryPrice - candle.close;

            trades.push({
              entryTime: currentPosition.entryTime,
              exitTime: candle.timestamp,
              entryPrice: currentPosition.entryPrice,
              exitPrice: candle.close,
              side: currentPosition.side,
              pnl: tradePnl,
            });

            runningPnl += tradePnl;

            if (tradePnl > 0) {
              strategy.winCount += 1;
            } else {
              strategy.lossCount += 1;
            }

            // Update peak and drawdown
            if (runningPnl > peakPnl) {
              peakPnl = runningPnl;
            }
            const drawdown = peakPnl - runningPnl;
            if (drawdown > maxDrawdown) {
              maxDrawdown = drawdown;
            }

            currentPosition = null;
          }
        }

        // Open new position if we don't have one
        if (!currentPosition && action.startsWith('enter_')) {
          currentPosition = {
            side,
            entryPrice: candle.close,
            entryTime: candle.timestamp,
          };
        }
      }
    }

    // Close any open position at the last candle
    if (currentPosition && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const tradePnl =
        currentPosition.side === 'BUY'
          ? lastCandle.close - currentPosition.entryPrice
          : currentPosition.entryPrice - lastCandle.close;

      trades.push({
        entryTime: currentPosition.entryTime,
        exitTime: lastCandle.timestamp,
        entryPrice: currentPosition.entryPrice,
        exitPrice: lastCandle.close,
        side: currentPosition.side,
        pnl: tradePnl,
      });

      runningPnl += tradePnl;

      if (tradePnl > 0) {
        strategy.winCount += 1;
      } else {
        strategy.lossCount += 1;
      }

      const drawdown = peakPnl - runningPnl;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return { trades, pnl: runningPnl, maxDrawdown };
  }

  // Stats
  getStrategies(): Strategy[] {
    return Array.from(this.strategies.values());
  }

  getBacktests(): BacktestResult[] {
    return Array.from(this.backtests.values());
  }

  getSignalLog(limit?: number): any[] {
    if (limit && limit > 0) {
      return this.signalLog.slice(-limit);
    }
    return [...this.signalLog];
  }

  getStats(): any {
    const strategies = this.getStrategies();
    const activeStrategies = strategies.filter((s) => s.status === 'active');
    const totalSignals = strategies.reduce((sum, s) => sum + s.signalsGenerated, 0);
    const totalWins = strategies.reduce((sum, s) => sum + s.winCount, 0);
    const totalLosses = strategies.reduce((sum, s) => sum + s.lossCount, 0);

    return {
      nodeName: this.nodeName,
      elevation: this.elevation,
      terrain: this.terrain,
      strategyCount: strategies.length,
      activeStrategies: activeStrategies.length,
      pausedStrategies: strategies.filter((s) => s.status === 'paused').length,
      backtestingStrategies: strategies.filter((s) => s.status === 'backtesting').length,
      totalSignalsGenerated: totalSignals,
      totalTradesExecuted: totalWins + totalLosses,
      totalWins,
      totalLosses,
      winRate: totalWins + totalLosses > 0 ? totalWins / (totalWins + totalLosses) : 0,
      backtestCount: this.backtests.size,
      signalLogSize: this.signalLog.length,
      basinSnapshot: this.basin.snapshot(),
    };
  }

  getBasinSnapshot(): BasinSnapshot {
    return this.basin.snapshot();
  }
}
