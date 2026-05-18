import { NodeRegistration } from '../types';
import { Ripple } from './ripple';

export class Watershed {
  nodes: Map<string, NodeRegistration>;

  constructor() {
    this.nodes = new Map();
  }

  register(nodeName: string, config: NodeRegistration): void {
    this.nodes.set(nodeName, config);
  }

  deregister(nodeName: string): void {
    this.nodes.delete(nodeName);
  }

  route(ripple: Ripple): Array<{ nodeName: string; node: NodeRegistration; ripple: Ripple }> {
    const candidates: Array<{ nodeName: string; node: NodeRegistration; ripple: Ripple }> = [];

    if (ripple.target && this.nodes.has(ripple.target)) {
      const node = this.nodes.get(ripple.target)!;
      if (this.canReceive(node, ripple)) {
        candidates.push({ nodeName: ripple.target, node, ripple });
      }
      return candidates;
    }

    for (const [nodeName, node] of this.nodes) {
      if (this.isDownhill(ripple.elevation, node.elevation) && this.scentMatch(ripple.scent, nodeName)) {
        candidates.push({ nodeName, node, ripple });
      }
    }

    candidates.sort((a, b) => b.node.elevation - a.node.elevation);
    return candidates;
  }

  canReceive(node: NodeRegistration, ripple: Ripple): boolean {
    return this.isDownhill(ripple.elevation, node.elevation) && node.terrain !== 'mountain';
  }

  isDownhill(rippleElevation: number, nodeElevation: number): boolean {
    return nodeElevation <= rippleElevation;
  }

  scentMatch(scent: Record<string, any>, nodeName: string): boolean {
    if (!scent || Object.keys(scent).length === 0) return true;
    if (scent.target && scent.target !== nodeName) return false;
    if (scent.asset && !nodeName.includes(scent.asset)) return false;
    return true;
  }

  getElevation(nodeName: string): number {
    return this.nodes.get(nodeName)?.elevation || 0;
  }

  getNodesByTerrain(terrain: string): string[] {
    const result: string[] = [];
    for (const [name, node] of this.nodes) {
      if (node.terrain === terrain) result.push(name);
    }
    return result;
  }

  snapshot(): Record<string, { elevation: number; terrain: string }> {
    const table: Record<string, { elevation: number; terrain: string }> = {};
    for (const [name, node] of this.nodes) {
      table[name] = { elevation: node.elevation, terrain: node.terrain };
    }
    return table;
  }
}