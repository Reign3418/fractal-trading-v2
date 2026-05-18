export interface RippleData {
  id: string;
  source: string;
  target?: string | null;
  type: 'FLOW' | 'INLET' | 'OVERFLOW' | 'EVAPORATION' | 'ALERT' | 'INVALIDATION' | 'STATE_PROPOSAL' | 'HEARTBEAT' | 'SYNC';
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
