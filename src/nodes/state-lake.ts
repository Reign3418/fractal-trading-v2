import { Ripple } from '../lib/ripple';
import { Basin } from '../lib/basin';
import { CanonicalState } from '../types';

interface StateLakeConfig {
  nodeName?: string;
  exchangeClient: any;
  stateStore: { save(state: any): Promise<void>; load(): Promise<any> };
  depth?: number;
}

export class StateLake {
  nodeName: string;
  exchangeClient: any;
  stateStore: any;
  basin: Basin;
  canonicalState: CanonicalState;
  decisionLog: any[];

  constructor(config: StateLakeConfig) {
    this.nodeName = config.nodeName || 'state-lake';
    this.exchangeClient = config.exchangeClient;
    this.stateStore = config.stateStore;
    this.basin = new Basin({
      nodeName: this.nodeName,
      terrain: 'lake',
      depth: config.depth || 1000,
      absorptionRate: 0.5,
      overflowThreshold: 0.8,
    });
    this.canonicalState = {
      openPositions: {},
      closedPositions: [],
      directives: {},
      lastCommit: null,
      lastExchangeSync: null,
    };
    this.decisionLog = [];
  }

  async receive(ripple: Ripple): Promise<any> {
    const result = this.basin.receive(ripple);

    if (ripple.type === 'STATE_PROPOSAL' || ripple.type === 'INVALIDATION') {
      const commitResult = await this.handleProposal(ripple);
      if (commitResult.committed) {
        return this.createOverflowRipple(ripple, commitResult);
      }
    }

    if (ripple.type === 'SYNC') {
      await this.syncFromExchange();
    }

    return result;
  }

  async handleProposal(ripple: Ripple): Promise<{ committed: boolean; reason?: string; state?: CanonicalState }> {
    const proposal = ripple.payload;

    if (proposal.event === 'LIQUIDATION_COMPLETE') {
      const exchangePositions = await this.exchangeClient.getPositions();
      if (exchangePositions[proposal.asset] !== undefined) {
        this.logDecision('REJECT', proposal, 'Ground truth shows position still open');
        return { committed: false, reason: 'ground_truth_contradiction' };
      }
    }

    if (proposal.event === 'DIRECTIVE_INVALIDATED') {
      const directive = this.canonicalState.directives[proposal.directiveId];
      if (!directive) {
        this.logDecision('REJECT', proposal, 'Directive not found');
        return { committed: false, reason: 'directive_not_found' };
      }
    }

    if (proposal.event === 'DIRECTIVE_CREATED') {
      const existing = this.canonicalState.directives[proposal.directiveId];
      if (existing && existing.status === 'ACTIVE') {
        this.logDecision('REJECT', proposal, 'Conflicting active directive');
        return { committed: false, reason: 'conflicting_directive' };
      }
    }

    await this.commitState(proposal);
    this.logDecision('COMMIT', proposal);
    return { committed: true, state: this.canonicalState };
  }

  async commitState(proposal: any): Promise<void> {
    const now = Date.now();

    switch (proposal.event) {
      case 'LIQUIDATION_COMPLETE':
        delete this.canonicalState.openPositions[proposal.asset];
        this.canonicalState.closedPositions.push({
          asset: proposal.asset,
          closedAt: now,
          reason: proposal.liquidationReason || 'liquidation',
          liquidatedBy: proposal.liquidatedBy,
          realizedPnl: proposal.realizedPnl || 0,
        });
        break;

      case 'DIRECTIVE_CREATED':
        this.canonicalState.directives[proposal.directiveId] = {
          ...proposal.directive,
          status: 'ACTIVE',
          createdAt: now,
        };
        break;

      case 'DIRECTIVE_INVALIDATED':
        if (this.canonicalState.directives[proposal.directiveId]) {
          this.canonicalState.directives[proposal.directiveId].status = 'VOID';
          this.canonicalState.directives[proposal.directiveId].invalidatedAt = now;
          this.canonicalState.directives[proposal.directiveId].invalidationReason = proposal.reason;
        }
        break;

      case 'DIRECTIVE_EXECUTED':
        if (this.canonicalState.directives[proposal.directiveId]) {
          this.canonicalState.directives[proposal.directiveId].status = 'EXECUTED';
          this.canonicalState.directives[proposal.directiveId].executedAt = now;
        }
        break;

      case 'POSITION_UPDATE':
        this.canonicalState.openPositions[proposal.asset] = {
          ...proposal.position,
          updatedAt: now,
        };
        break;

      case 'SYNC':
        break;
    }

    this.canonicalState.lastCommit = now;
    await this.stateStore.save(this.canonicalState);
  }

  async syncFromExchange(): Promise<boolean> {
    try {
      const exchangePositions = await this.exchangeClient.getPositions();
      for (const [asset, position] of Object.entries(exchangePositions)) {
        this.canonicalState.openPositions[asset] = {
          quantity: (position as any).quantity,
          entryPrice: (position as any).entryPrice,
          currentPrice: (position as any).currentPrice,
          unrealizedPnl: (position as any).unrealizedPnl,
          updatedAt: Date.now(),
        };
      }
      for (const asset of Object.keys(this.canonicalState.openPositions)) {
        if (!exchangePositions[asset]) {
          delete this.canonicalState.openPositions[asset];
        }
      }
      this.canonicalState.lastExchangeSync = Date.now();
      await this.stateStore.save(this.canonicalState);
      this.logDecision('SYNC', { source: 'exchange', positions: exchangePositions });
      return true;
    } catch (err: any) {
      this.logDecision('SYNC_FAILED', { error: err.message });
      return false;
    }
  }

  createOverflowRipple(originalRipple: Ripple, commitResult: any): Ripple {
    return new Ripple({
      source: this.nodeName,
      type: 'OVERFLOW',
      payload: {
        event: 'STATE_COMMITTED',
        directiveId: originalRipple.payload.directiveId,
        asset: originalRipple.payload.asset,
        canonicalState: this.canonicalState,
        commitResult,
      },
      scent: { type: 'state', asset: originalRipple.payload.asset },
      intensity: 0.9,
      elevation: 100,
    });
  }

  logDecision(type: string, proposal: any, reason?: string): void {
    const entry = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      timestamp: Date.now(),
      proposal: JSON.parse(JSON.stringify(proposal)),
      reason,
    };
    this.decisionLog.push(entry);
    if (this.decisionLog.length > 10000) {
      this.decisionLog = this.decisionLog.slice(-5000);
    }
  }

  getState(): CanonicalState {
    return JSON.parse(JSON.stringify(this.canonicalState));
  }

  getPosition(asset: string): any {
    return this.canonicalState.openPositions[asset] || null;
  }

  getDirective(directiveId: string): any {
    return this.canonicalState.directives[directiveId] || null;
  }

  getBasinSnapshot(): any {
    return this.basin.snapshot();
  }

  getDecisionLog(limit: number = 100): any[] {
    return this.decisionLog.slice(-limit);
  }

  isHealthy(): boolean {
    const syncAge = Date.now() - (this.canonicalState.lastExchangeSync || 0);
    return syncAge < 300000;
  }
}