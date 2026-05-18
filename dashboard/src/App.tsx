import { useState, useEffect } from 'react';

const API_URL = 'https://fractal-trading-v2-production.up.railway.app';

function App() {
  const [health, setHealth] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/health`).then(r => r.json()),
      fetch(`${API_URL}/api/state`).then(r => r.json()),
    ])
      .then(([h, s]) => { setHealth(h); setState(s); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleRefresh = () => { setLoading(true); setError(''); setRefreshKey(k => k + 1); };

  const createTestPosition = async () => {
    await fetch(`${API_URL}/api/commit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'POSITION_UPDATE', asset: 'BTC', position: { quantity: 0.5, entryPrice: 100000 } }),
    });
    handleRefresh();
  };

  const createDirective = async () => {
    await fetch(`${API_URL}/api/commit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'DIRECTIVE_CREATED', directiveId: `dir-${Date.now()}`, directive: { action: 'LIQUIDATE', asset: 'BTC', reason: 'stop_loss' } }),
    });
    handleRefresh();
  };

  const triggerHeartbeat = async () => {
    await fetch(`${API_URL}/api/heartbeat`, { method: 'POST' });
    handleRefresh();
  };

  const dropPrice = async () => {
    await fetch(`${API_URL}/api/test/set-price`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset: 'BTC', price: 94000 }),
    });
    handleRefresh();
  };

  if (loading) return <div className="loading"><h2>Loading Fractal Trading v2...</h2></div>;
  if (error) return <div className="error"><h2>Error: {error}</h2><button onClick={handleRefresh}>Retry</button></div>;

  const positions = Object.entries(state?.openPositions || {});
  const directives = Object.entries(state?.directives || {});
  const activeDirectives = directives.filter(([_, d]: [string, any]) => d.status === 'ACTIVE');
  const voidDirectives = directives.filter(([_, d]: [string, any]) => d.status === 'VOID');

  return (
    <div className="container">
      <header>
        <h1>Fractal Trading v2</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="badge">LIVE</span>
          <button onClick={handleRefresh}>Refresh</button>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Card title="Status" value={health?.status || '?'} color="#22c55e" />
        <Card title="Positions" value={positions.length} color="#3b82f6" />
        <Card title="Active Directives" value={activeDirectives.length} color="#f59e0b" />
        <Card title="Queue" value={health?.river?.queueSize || 0} color="#8b5cf6" />
      </div>

      <section>
        <h2>Actions</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={createTestPosition}>Add BTC Position</button>
          <button onClick={createDirective}>Add Directive</button>
          <button onClick={dropPrice}>Drop Price 6%</button>
          <button onClick={triggerHeartbeat}>Heartbeat</button>
        </div>
      </section>

      <section>
        <h2>Node Status</h2>
        {health?.nodes && Object.entries(health.nodes).map(([name, node]: [string, any]) => (
          <div key={name} className="row">
            <span className="name">{name}</span>
            <span className="terrain">{node.terrain}</span>
            <span className="meta">elev: {node.elevation}</span>
          </div>
        ))}
      </section>

      <section>
        <h2>Open Positions</h2>
        {positions.length === 0 ? <p className="empty">No open positions</p> :
          positions.map(([asset, pos]: [string, any]) => (
            <div key={asset} className="row">
              <span className="name">{asset}</span>
              <span>{pos.quantity} @ ${pos.entryPrice?.toLocaleString()}</span>
            </div>
          ))}
      </section>

      <section>
        <h2>Active Directives</h2>
        {activeDirectives.length === 0 ? <p className="empty">No active directives</p> :
          activeDirectives.map(([id, d]: [string, any]) => (
            <div key={id} className="row">
              <span className="name">{d.action} {d.asset}</span>
              <span className="meta">{id.slice(0, 8)}...</span>
            </div>
          ))}
      </section>

      {voidDirectives.length > 0 && (
        <section>
          <h2>Void Directives</h2>
          {voidDirectives.map(([id, d]: [string, any]) => (
            <div key={id} className="row"><span className="name">{d.action} {d.asset}</span><span className="meta">VOID</span></div>
          ))}
        </section>
      )}

      <section>
        <h2>Trading River</h2>
        <div className="row"><span>Queue Size</span><span>{health?.river?.queueSize || 0}</span></div>
        <div className="row"><span>Pending</span><span>{health?.river?.pending || 0}</span></div>
        <div className="row"><span>Sent</span><span>{health?.river?.sent || 0}</span></div>
        <div className="row"><span>Rejected</span><span>{health?.river?.rejected || 0}</span></div>
        <div className="row"><span>Routes Logged</span><span>{health?.river?.routesLogged || 0}</span></div>
      </section>

      <section>
        <h2>Lake Basin</h2>
        <div className="row"><span>Fill Ratio</span><span>{(health?.basin?.fillRatio || 0).toFixed(2)}</span></div>
        <div className="row"><span>Items</span><span>{health?.basin?.itemCount || 0}</span></div>
        <div className="row"><span>Overflowing</span><span>{health?.basin?.isOverflowing ? 'YES' : 'NO'}</span></div>
      </section>

      <footer><a href="https://github.com/Reign3418/fractal-trading-v2">GitHub</a></footer>
    </div>
  );
}

function Card({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div className="card" style={{ borderLeftColor: color }}>
      <div className="card-title">{title}</div>
      <div className="card-value" style={{ color }}>{value}</div>
    </div>
  );
}

export default App;