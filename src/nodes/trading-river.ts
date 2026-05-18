import { Ripple } from '../lib/ripple';
import { Basin } from '../lib/basin';
import { Watershed } from '../lib/watershed';

interface ExecutionRequest {
  id: string;
  directiveId: string;
  asset: string;
  action: string;
  quantity: number;
  status: 'pending' | 'sent' | 'filled' | 'rejected';
  createdAt: number;
  routedTo?: string;
}

interface TradingRiverConfig {
  nodeName?: string;
  watershed: Watershed;
  onRoute?: (route: any) => void;
}

export class TradingRiver {
  nodeName: string;
  terrain = 'river' as const;
  elevation = 400;
  basin: Basin;
  watershed: Watershed;
  executionQueue: ExecutionRequest[];
  routingLog: any[];
  onRoute?: (route: any) => void;

  constructor(config: TradingRiverConfig) {
    this.nodeName = config.nodeName || 'trading-river';
    this.watershed = config.watershed;
    this.basin = new Basin({
      nodeName: this.nodeName,
      terrain: 'river',
      depth: 2000,
      absorptionRate: 0.10,
      overflowThreshold: 0.9,
    });
    this.executionQueue = [];
    this.routingLog = [];
    this.onRoute = config.onRoute;
  }

  async receive(ripple: Ripple): Promise<any> {
    const result = this.basin.receive(ripple);

    // Route signals from strategy cities
    if (ripple.type === 'SIGNAL' || ripple.scent.type === 'signal') {
      return await this.routeSignal(ripple);
    }

    // Route invalidations from Lake back to strategy cities
    if (ripple.type === 'OVERFLOW' && ripple.payload.event === 'STATE_COMMITTED') {
      return await this.routeInvalidation(ripple);
    }

    // Route liquidations from Forest
    if (ripple.type === 'INVALIDATION') {
      return await this.routeLiquidation(ripple);
    }

    return result;
  }

  // Strategy City → Forest → Execution City
  async routeSignal(ripple: Ripple): Promise<any> {
    const signal = ripple.payload;
    console.log(`[${this.nodeName}] Routing SIGNAL: ${signal.action} ${signal.asset}`);

    // Step 1: Validate through Forest
    const forestRoute = this.watershed.route(
      new Ripple({
        source: this.nodeName,
        target: 'validation-forest',
        type: 'FLOW',
        payload: signal,
        scent: { type: 'signal', asset: signal.asset },
        intensity: 1.0,
        elevation: 700,
      })
    );

    if (forestRoute.length === 0) {
      this.logRoute('SIGNAL', signal, 'rejected', 'no forest route');
      return { routed: false, reason: 'validation-forest unreachable' };
    }

    // Step 2: Queue execution request
    const request: ExecutionRequest = {
      id: `exec-${Date.now()}`,
      directiveId: signal.directiveId || `dir-${Date.now()}`,
      asset: signal.asset,
      action: signal.action,
      quantity: signal.quantity || 0,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.executionQueue.push(request);

    // Step 3: Route to execution city
    const execRoute = this.watershed.route(
      new Ripple({
        source: this.nodeName,
        target: 'execution-city',
        type: 'FLOW',
        payload: { ...signal, requestId: request.id },
        scent: { type: 'order', asset: signal.asset },
        intensity: 1.0,
        elevation: 300,
      })
    );

    if (execRoute.length > 0) {
      request.status = 'sent';
      request.routedTo = 'execution-city';
      this.logRoute('SIGNAL', signal, 'routed', 'execution-city');
      return {
        routed: true,
        path: ['strategy-city', this.nodeName, 'validation-forest', 'execution-city'],
        requestId: request.id,
      };
    }

    // Fallback: route to Lake for state commit
    const lakeRoute = this.watershed.route(
      new Ripple({
        source: this.nodeName,
        target: 'state-lake',
        type: 'STATE_PROPOSAL',
        payload: {
          event: 'DIRECTIVE_CREATED',
          directiveId: request.directiveId,
          directive: { action: signal.action, asset: signal.asset, reason: signal.reason },
        },
        scent: { type: 'state', asset: signal.asset },
        intensity: 1.0,
        elevation: 100,
      })
    );

    if (lakeRoute.length > 0) {
      request.status = 'sent';
      request.routedTo = 'state-lake';
      this.logRoute('SIGNAL', signal, 'routed', 'state-lake (fallback)');
      return {
        routed: true,
        path: ['strategy-city', this.nodeName, 'state-lake'],
        requestId: request.id,
      };
    }

    request.status = 'rejected';
    this.logRoute('SIGNAL', signal, 'rejected', 'no route to execution');
    return { routed: false, reason: 'no execution route available' };
  }

  // Lake → Strategy City (invalidation notification)
  async routeInvalidation(ripple: Ripple): Promise<any> {
    const { directiveId, asset } = ripple.payload;
    console.log(`[${this.nodeName}] Routing INVALIDATION: ${directiveId} ${asset}`);

    // Route to strategy cities that own this directive
    const routes = this.watershed.route(
      new Ripple({
        source: this.nodeName,
        type: 'ALERT',
        payload: {
          event: 'DIRECTIVE_INVALIDATED',
          directiveId,
          asset,
          reason: 'liquidated by validation-forest',
        },
        scent: { type: 'alert', asset, target: 'strategy' },
        intensity: 0.8,
        elevation: 600,
      })
    );

    // Also update execution queue
    const queued = this.executionQueue.find(
      (r) => r.directiveId === directiveId && r.status === 'pending'
    );
    if (queued) {
      queued.status = 'rejected';
    }

    this.logRoute('INVALIDATION', { directiveId, asset }, 'routed', `to ${routes.length} nodes`);
    return { routed: true, notified: routes.map((r) => r.nodeName) };
  }

  // Forest → Lake (liquidation direct route)
  async routeLiquidation(ripple: Ripple): Promise<any> {
    console.log(`[${this.nodeName}] Routing LIQUIDATION: ${ripple.payload.asset}`);

    const lakeRoute = this.watershed.route(
      new Ripple({
        source: this.nodeName,
        target: 'state-lake',
        type: 'INVALIDATION',
        payload: ripple.payload,
        scent: { type: 'state', asset: ripple.payload.asset, urgency: 'critical' },
        intensity: 1.0,
        elevation: 100,
      })
    );

    if (lakeRoute.length > 0) {
      this.logRoute('LIQUIDATION', ripple.payload, 'routed', 'state-lake');
      return { routed: true, path: ['validation-forest', this.nodeName, 'state-lake'] };
    }

    return { routed: false, reason: 'lake unreachable' };
  }

  logRoute(type: string, payload: any, status: string, detail: string): void {
    this.routingLog.push({ type, payload, status, detail, timestamp: Date.now() });
    if (this.routingLog.length > 5000) this.routingLog = this.routingLog.slice(-2500);
  }

  getQueue(): ExecutionRequest[] {
    return [...this.executionQueue];
  }

  getStats(): any {
    return {
      queueSize: this.executionQueue.length,
      pending: this.executionQueue.filter((r) => r.status === 'pending').length,
      sent: this.executionQueue.filter((r) => r.status === 'sent').length,
      filled: this.executionQueue.filter((r) => r.status === 'filled').length,
      rejected: this.executionQueue.filter((r) => r.status === 'rejected').length,
      routesLogged: this.routingLog.length,
      basin: this.basin.snapshot(),
    };
  }

  getRoutingLog(limit: number = 50): any[] {
    return this.routingLog.slice(-limit);
  }
}