import { BasinSnapshot, TerrainType, TERRAIN_ABSORPTION } from '../types';
import { Ripple } from './ripple';

interface BasinConfig {
  nodeName: string;
  terrain: TerrainType;
  depth?: number;
  absorptionRate?: number;
  overflowThreshold?: number;
}

export class Basin {
  nodeName: string;
  terrain: TerrainType;
  depth: number;
  absorptionRate: number;
  overflowThreshold: number;
  currentFill: number;
  contents: Ripple[];
  overflowLog: Ripple[];

  constructor(config: BasinConfig) {
    this.nodeName = config.nodeName;
    this.terrain = config.terrain;
    this.depth = config.depth || 1000;
    this.absorptionRate = config.absorptionRate ?? TERRAIN_ABSORPTION[config.terrain];
    this.overflowThreshold = config.overflowThreshold || 0.8;
    this.currentFill = 0;
    this.contents = [];
    this.overflowLog = [];
  }

  receive(ripple: Ripple): { remaining: Ripple; absorbed: number; overflow: boolean; fillRatio: number } {
    const absorbed = ripple.absorb(this.absorptionRate);
    this.currentFill += absorbed;
    if (this.currentFill <= this.depth) {
      this.contents.push(ripple);
    }
    return {
      remaining: ripple,
      absorbed,
      overflow: this.checkOverflow(),
      fillRatio: this.currentFill / this.depth,
    };
  }

  checkOverflow(): boolean {
    return (this.currentFill / this.depth) >= this.overflowThreshold;
  }

  drain(): Ripple[] {
    if (!this.checkOverflow()) return [];
    const overflowAmount = this.currentFill - (this.depth * this.overflowThreshold);
    const overflowRipples: Ripple[] = [];
    let drained = 0;
    while (drained < overflowAmount && this.contents.length > 0) {
      const ripple = this.contents.shift()!;
      drained += ripple.intensity;
      overflowRipples.push(ripple);
    }
    this.currentFill -= drained;
    this.overflowLog.push(...overflowRipples);
    return overflowRipples;
  }

  compact(): Ripple[] {
    const now = Date.now();
    const maxAge = this.getMaxAge();
    const expired = this.contents.filter(r => (now - r.timestamp) > maxAge);
    this.contents = this.contents.filter(r => (now - r.timestamp) <= maxAge);
    this.currentFill = this.contents.reduce((sum, r) => sum + r.intensity, 0);
    return expired;
  }

  getMaxAge(): number {
    const ages: Record<TerrainType, number> = {
      ocean: 300000, river: 60000, lake: 600000, city: 300000,
      mountain: 60000, forest: 120000, coast: 300000, planetary: 600000, atmosphere: 600000,
    };
    return ages[this.terrain] || 300000;
  }

  snapshot(): BasinSnapshot {
    return {
      nodeName: this.nodeName,
      terrain: this.terrain,
      depth: this.depth,
      currentFill: this.currentFill,
      fillRatio: this.currentFill / this.depth,
      itemCount: this.contents.length,
      overflowThreshold: this.overflowThreshold,
      isOverflowing: this.checkOverflow(),
    };
  }
}