export interface RippleData {
  id: string;
  source: string;
  target?: string | null;
  type: 'FLOW' | 'INLET' | 'OVERFLOW' | 'EVAPORATION' | 'ALERT' | 'INVALIDATION' | 'STATE_PROPOSAL' | 'HEARTBEAT' | 'SYNC' | 'SIGNAL' | 'ANALYSIS';
  payload: Record<string, any>;
  scent: Record<string, any>;
  intensity: number;
  elevation: number;
  trace: string[];
  timestamp: number;
  ttl: number;
  hopCount: number;
}

export interface BasinSnapshot {
  nodeName: string;
  terrain: string;
  depth: number;
  currentFill: number;
  fillRatio: number;
  itemCount: number;
  overflowThreshold: number;
  isOverflowing: boolean;
}

export interface NodeRegistration {
  elevation: number;
  terrain: string;
  handler: any;
}

export interface CanonicalState {
  openPositions: Record<string, any>;
  closedPositions: any[];
  directives: Record<string, any>;
  lastCommit: number | null;
  lastExchangeSync: number | null;
}

export interface DecisionLogEntry {
  id: string;
  type: string;
  timestamp: number;
  proposal: any;
  reason?: string | null;
}

export type TerrainType = 'ocean' | 'river' | 'lake' | 'city' | 'mountain' | 'forest' | 'coast' | 'planetary' | 'atmosphere';

export const TERRAIN_ABSORPTION: Record<TerrainType, number> = {
  ocean: 0.80,
  river: 0.10,
  lake: 0.50,
  city: 0.05,
  mountain: 0.90,
  forest: 0.40,
  coast: 0.30,
  planetary: 0.60,
  atmosphere: 0.20,
};

// === Strategy City Types ===
export interface Strategy {
  id: string;
  name: string;
  asset: string;
  type: 'momentum' | 'mean_reversion' | 'breakout' | 'trend_following';
  parameters: Record<string, number>;
  status: 'active' | 'paused' | 'backtesting';
  createdAt: number;
  lastSignalAt: number | null;
  signalsGenerated: number;
  winCount: number;
  lossCount: number;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  asset: string;
  startTime: number;
  endTime: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  pnl: number;
}

// === Analysis Ocean Types ===
export interface IndicatorValue {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  timestamp: number;
}

export interface DetectorReading {
  name: string;
  status: 'normal' | 'warning' | 'critical';
  value: number;
  threshold: number;
  message: string;
}

export interface AnalysisResult {
  asset: string;
  timestamp: number;
  indicators: IndicatorValue[];
  detectors: DetectorReading[];
  overallSignal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  confidence: number;
  price: number;
}

// === Exchange Types ===
export interface ExchangeConfig {
  mode: 'paper' | 'live';
  exchangeId: string;
  apiKey?: string;
  secret?: string;
  sandbox?: boolean;
  trackedAssets: string[];
  feedIntervalMs: number;
}

export interface MarketData {
  asset: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}
