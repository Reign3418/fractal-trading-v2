import { describe, it, expect } from 'vitest';
import { Ripple } from '../src/lib/ripple';
import { StateLake } from '../src/nodes/state-lake';
import { ValidationForest } from '../src/nodes/validation-forest';

const mockExchange = {
  positions: { DOGE: { quantity: 100, entryPrice: 0.10, currentPrice: 0.10 } },
  async getPositions() { return { ...this.positions }; },
  async getPrice(asset: string) { return this.positions[asset]?.currentPrice || 0; },
  liquidate(asset: string) { delete this.positions[asset]; },
  triggerStopLoss(asset: string) {
    if (this.positions[asset]) this.positions[asset].currentPrice = this.positions[asset].entryPrice * 0.94;
  },
};

const mockStore = {
  data: null as any,
  async save(state: any) { this.data = JSON.parse(JSON.stringify(state)); },
  async load() { return this.data; },
};

describe('DOGE Ghost Test', () => {
  it('kills the ghost within 1 cycle', async () => {
    const lake = new StateLake({ exchangeClient: mockExchange, stateStore: mockStore });
    const forest = new ValidationForest({ stateLake: lake, exchangeClient: mockExchange });

    // Step 1: Initial sync
    await lake.syncFromExchange();
    expect(lake.getPosition('DOGE')).not.toBeNull();

    // Step 2: Create directive
    const directiveId = 'tank-20260519-LIQUIDATE_DOGE';
    const dirRipple = new Ripple({
      source: 'strategy-city', target: 'state-lake', type: 'STATE_PROPOSAL',
      payload: { event: 'DIRECTIVE_CREATED', directiveId, directive: { action: 'LIQUIDATE', asset: 'DOGE', reason: 'stop_loss' } },
      scent: { type: 'state', asset: 'DOGE' }, intensity: 1, elevation: 500,
    });
    await lake.receive(dirRipple);
    expect(lake.getDirective(directiveId)?.status).toBe('ACTIVE');

    // Step 3: Exchange liquidates
    mockExchange.triggerStopLoss('DOGE');
    mockExchange.liquidate('DOGE');
    expect(lake.getPosition('DOGE')).not.toBeNull(); // Lake hasn't synced yet

    // Step 4: Forest heartbeat detects liquidation
    const hb = new Ripple({ source: 'trading-planet', target: 'validation-forest', type: 'HEARTBEAT', payload: {}, scent: { type: 'state' }, elevation: 900 });
    await forest.receive(hb);
    const liquidations = await forest.checkLiquidations();
    expect(liquidations.length).toBe(1);

    // Step 5: Lake receives invalidation
    await lake.receive(liquidations[0]);

    // VALIDATION
    expect(lake.getPosition('DOGE')).toBeNull();
    expect(lake.getDirective(directiveId)?.status).toBe('VOID');
    console.log('Ghost eliminated in 1 cycle');
  });
});