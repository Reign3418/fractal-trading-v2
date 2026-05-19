import { Trade, EquityPoint, PerformanceSnapshot } from '../types';

export class PerformanceTracker {
  trades: Map<string, Trade>;
  equityHistory: EquityPoint[];
  peakEquity: number;
  startingBalance: number;

  constructor(startingBalance: number = 100000) {
    this.trades = new Map();
    this.equityHistory = [];
    this.peakEquity = startingBalance;
    this.startingBalance = startingBalance;
  }

  // Record a new trade entry
  recordEntry(params: {
    id?: string;
    asset: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    strategyId?: string;
  }): Trade {
    const trade: Trade = {
      id: params.id || `trade-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      asset: params.asset,
      side: params.side,
      type: 'OPEN',
      quantity: params.quantity,
      entryPrice: params.price,
      status: 'OPEN',
      openedAt: Date.now(),
      strategyId: params.strategyId,
    };
    this.trades.set(trade.id, trade);
    this.recordEquity();
    return trade;
  }

  // Record a trade exit
  recordExit(params: {
    tradeId: string;
    exitPrice: number;
    reason?: Trade['closeReason'];
  }): Trade | null {
    const trade = this.trades.get(params.tradeId);
    if (!trade || trade.status === 'CLOSED') return null;

    trade.status = 'CLOSED';
    trade.closedAt = Date.now();
    trade.type = 'CLOSE';
    trade.exitPrice = params.exitPrice;
    trade.closeReason = params.reason || 'signal';

    // Calculate PnL
    if (trade.side === 'BUY') {
      trade.pnl = (params.exitPrice - trade.entryPrice) * trade.quantity;
      trade.pnlPercent = ((params.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
    } else {
      trade.pnl = (trade.entryPrice - params.exitPrice) * trade.quantity;
      trade.pnlPercent = ((trade.entryPrice - params.exitPrice) / trade.entryPrice) * 100;
    }

    this.recordEquity();
    return trade;
  }

  // Close all open trades for an asset (e.g. liquidation)
  closeAllForAsset(asset: string, exitPrice: number, reason: Trade['closeReason']): Trade[] {
    const closed: Trade[] = [];
    for (const trade of this.trades.values()) {
      if (trade.asset === asset && trade.status === 'OPEN') {
        this.recordExit({ tradeId: trade.id, exitPrice, reason });
        closed.push(trade);
      }
    }
    return closed;
  }

  // Record equity snapshot
  recordEquity(balance?: number, openPnl?: number): void {
    const openTrades = this.getOpenTrades();
    const unrealizedPnl = openPnl || openTrades.reduce((sum, t) => {
      // Approximate with last known prices
      return sum + (t.pnl || 0);
    }, 0);
    const equity = (balance || this.startingBalance) + this.getTotalPnl() + unrealizedPnl;

    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }

    this.equityHistory.push({
      timestamp: Date.now(),
      balance: balance || this.startingBalance,
      equity,
      openPositions: openTrades.length,
    });

    // Trim history to last 10k points
    if (this.equityHistory.length > 10000) {
      this.equityHistory = this.equityHistory.slice(-5000);
    }
  }

  // Get all trades
  getTrades(filter?: { asset?: string; status?: 'OPEN' | 'CLOSED'; limit?: number }): Trade[] {
    let trades = Array.from(this.trades.values());
    if (filter?.asset) trades = trades.filter(t => t.asset === filter.asset);
    if (filter?.status) trades = trades.filter(t => t.status === filter.status);
    trades.sort((a, b) => b.openedAt - a.openedAt);
    if (filter?.limit) trades = trades.slice(0, filter.limit);
    return trades;
  }

  getOpenTrades(): Trade[] {
    return this.getTrades({ status: 'OPEN' });
  }

  getClosedTrades(): Trade[] {
    return this.getTrades({ status: 'CLOSED' });
  }

  getTotalPnl(): number {
    return this.getClosedTrades().reduce((sum, t) => sum + (t.pnl || 0), 0);
  }

  getUnrealizedPnl(currentPrices: Record<string, number>): number {
    let pnl = 0;
    for (const trade of this.getOpenTrades()) {
      const currentPrice = currentPrices[trade.asset] || trade.entryPrice;
      if (trade.side === 'BUY') {
        pnl += (currentPrice - trade.entryPrice) * trade.quantity;
      } else {
        pnl += (trade.entryPrice - currentPrice) * trade.quantity;
      }
    }
    return pnl;
  }

  // Full performance snapshot
  getSnapshot(currentPrices?: Record<string, number>): PerformanceSnapshot {
    const allClosed = this.getClosedTrades();
    const allOpen = this.getOpenTrades();
    const winners = allClosed.filter(t => (t.pnl || 0) > 0);
    const losers = allClosed.filter(t => (t.pnl || 0) <= 0);
    const totalPnl = this.getTotalPnl();
    const unrealizedPnl = currentPrices ? this.getUnrealizedPnl(currentPrices) : 0;
    const currentEquity = this.startingBalance + totalPnl + unrealizedPnl;

    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = todayStart - (new Date().getDay() * 86400000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const tradesToday = allClosed.filter(t => t.closedAt && t.closedAt >= todayStart);
    const tradesWeek = allClosed.filter(t => t.closedAt && t.closedAt >= weekStart);
    const tradesMonth = allClosed.filter(t => t.closedAt && t.closedAt >= monthStart);

    const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + (t.pnl || 0), 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + (t.pnl || 0), 0) / losers.length : 0;

    const grossProfit = winners.reduce((s, t) => s + Math.max(0, t.pnl || 0), 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + Math.min(0, t.pnl || 0), 0));

    const durations = allClosed.filter(t => t.closedAt).map(t => (t.closedAt || 0) - t.openedAt);

    // Max drawdown from equity history
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peak = this.startingBalance;
    for (const point of this.equityHistory) {
      if (point.equity > peak) peak = point.equity;
      const dd = peak - point.equity;
      if (dd > maxDrawdown) maxDrawdown = dd;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
      if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;
    }

    // Sharpe ratio (simplified)
    const returns = [];
    for (let i = 1; i < this.equityHistory.length; i++) {
      const prev = this.equityHistory[i - 1].equity;
      const curr = this.equityHistory[i].equity;
      if (prev > 0) returns.push((curr - prev) / prev);
    }
    const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
    const returnStd = this.stdDev(returns);
    const sharpe = returnStd > 0 ? (avgReturn / returnStd) * Math.sqrt(365) : 0;

    return {
      totalTrades: allClosed.length + allOpen.length,
      openTrades: allOpen.length,
      closedTrades: allClosed.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      winRate: allClosed.length > 0 ? winners.length / allClosed.length : 0,
      totalPnl,
      avgWin,
      avgLoss,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio: sharpe,
      currentBalance: this.startingBalance,
      currentEquity,
      bestTrade: allClosed.length > 0 ? allClosed.reduce((best, t) => (t.pnl || 0) > (best.pnl || 0) ? t : best) : null,
      worstTrade: allClosed.length > 0 ? allClosed.reduce((worst, t) => (t.pnl || 0) < (worst.pnl || 0) ? t : worst) : null,
      avgTradeDuration: durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : 0,
      tradesToday: tradesToday.length,
      pnlToday: tradesToday.reduce((s, t) => s + (t.pnl || 0), 0),
      tradesThisWeek: tradesWeek.length,
      pnlThisWeek: tradesWeek.reduce((s, t) => s + (t.pnl || 0), 0),
      tradesThisMonth: tradesMonth.length,
      pnlThisMonth: tradesMonth.reduce((s, t) => s + (t.pnl || 0), 0),
    };
  }

  getEquityHistory(): EquityPoint[] {
    return [...this.equityHistory];
  }

  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  }
}
