import { RippleData } from '../types';

export class Ripple {
  id: string;
  source: string;
  target: string | null;
  type: RippleData['type'];
  payload: Record<string, any>;
  scent: Record<string, any>;
  intensity: number;
  elevation: number;
  trace: string[];
  timestamp: number;
  ttl: number;
  hopCount: number;

  constructor(data: Partial<RippleData>) {
    this.id = data.id || generateId();
    this.source = data.source || 'unknown';
    this.target = data.target ?? null;
    this.type = data.type || 'FLOW';
    this.payload = data.payload || {};
    this.scent = data.scent || {};
    this.intensity = data.intensity ?? 1.0;
    this.elevation = data.elevation ?? 500;
    this.trace = [...(data.trace || []), this.source];
    this.timestamp = data.timestamp || Date.now();
    this.ttl = data.ttl ?? 10;
    this.hopCount = data.trace?.length || 0;
  }

  absorb(absorptionRate: number): number {
    const absorbed = this.intensity * absorptionRate;
    this.intensity -= absorbed;
    return absorbed;
  }

  decay(): boolean {
    this.ttl -= 1;
    this.hopCount += 1;
    return this.ttl > 0;
  }

  visit(nodeName: string): void {
    this.trace.push(nodeName);
  }

  matchesScent(filter: Record<string, any>): boolean {
    return Object.entries(filter).every(([key, value]) => {
      if (Array.isArray(value)) return value.includes(this.scent[key]);
      return this.scent[key] === value;
    });
  }

  spawn({ source, type, payload, intensity }: { source: string; type: RippleData['type']; payload: Record<string, any>; intensity?: number }): Ripple {
    return new Ripple({
      source,
      type,
      payload,
      scent: { ...this.scent },
      intensity: intensity ?? this.intensity,
      elevation: this.elevation,
      trace: [...this.trace],
      ttl: this.ttl,
    });
  }

  toJSON(): RippleData {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      payload: this.payload,
      scent: this.scent,
      intensity: this.intensity,
      elevation: this.elevation,
      trace: this.trace,
      timestamp: this.timestamp,
      ttl: this.ttl,
      hopCount: this.hopCount,
    };
  }
}

function generateId(): string {
  return `rpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}