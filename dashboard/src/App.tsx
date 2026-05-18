import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

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
      .then(([h, s]) => {
        setHealth(h);
        setState(s);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setError('');
    setRefreshKey(k => k + 1);
  };

  const createTestPosition = async () => {
    await fetch(`${API_URL}/api/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'POSITION_UPDATE',
        asset: 'BTC',
        position: { quantity: 0.5, entryPrice: 65000 },
      }),
    });
    handleRefresh();
  };

  const liquidatePosition = async () => {
    await fetch(`${API_URL}/api/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'LIQUIDATION_COMPLETE',
        asset: 'BTC',
        directiveId: 'test-123',
      }),
    });
    handleRefresh();
  };

  const createDirective = async () => {
    await fetch(`${API_URL}/api/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'DIRECTIVE_CREATED',
        directiveId: `dir-${Date.now()}`,
        directive: { action: 'LIQUIDATE', asset: 'ETH', reason: 'stop_loss' },
      }),
    });
    handleRefresh();
  };

  if (loading) return <div className="loading"><h2>Loading Fractal Trading v2...</h2></div>;
  if (error) return (
    <div className="error">
      <h2>Error: {error}</h2>
      <p>Is the backend running at {API_URL || 'same origin'}?</p>
      <button onClick={handleRefresh}>Retry</button>
    </div>
  );

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

      <div className="grid">
        <Card title="Status" value={health?.status || '?'} color="#22c55e" />
        <Card title="Positions" value={positions.length} color="#3b82f6" />
        <Card title="Active Directives" value={activeDirectives.length} color="#f59e0b" />
      </div>

      <section>
        <h2>Actions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={createTestPosition}>Add BTC Position</button>
          <button onClick={createDirective}>Add Directive</button>
          <button onClick={liquidatePosition}>Liquidate BTC</button>
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
        {!health?.nodes && <p className="empty">No nodes registered</p>}
      </section>

      <section>
        <h2>Open Positions</h2>
        {positions.length === 0 ? (
          <p className="empty">No open positions</p>
        ) : (
          positions.map(([asset, pos]: [string, any]) => (
            <div key={asset} className="row">
              <span className="name">{asset}</span>
              <span>{pos.quantity} @ ${pos.entryPrice?.toLocaleString()}</span>
              <span className="meta">{new Date(pos.updatedAt).toLocaleTimeString()}</span>
            </div>
          ))
        )}
      </section>

      <section>
        <h2>Active Directives</h2>
        {activeDirectives.length === 0 ? (
          <p className="empty">No active directives</p>
        ) : (
          activeDirectives.map(([id, d]: [string, any]) => (
            <div key={id} className="row">
              <span className="name">{d.action} {d.asset}</span>
              <span>{d.reason}</span>
              <span className="meta">{id.slice(0, 8)}...</span>
            </div>
          ))
        )}
      </section>

      {voidDirectives.length > 0 && (
        <section>
          <h2>Void Directives</h2>
          {voidDirectives.map(([id, d]: [string, any]) => (
            <div key={id} className="row">
              <span className="name">{d.action} {d.asset}</span>
              <span className="meta">VOID</span>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>Lake Basin</h2>
        <div className="row"><span>Fill Ratio</span><span>{(health?.basin?.fillRatio || 0).toFixed(2)}</span></div>
        <div className="row"><span>Items</span><span>{health?.basin?.itemCount || 0}</span></div>
        <div className="row"><span>Overflowing</span><span>{health?.basin?.isOverflowing ? 'YES' : 'NO'}</span></div>
      </section>

      <section>
        <h2>Raw State</h2>
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </section>

      <footer>
        <a href="https://github.com/Reign3418/fractal-trading-v2" target="_blank" rel="noreferrer">
          github.com/Reign3418/fractal-trading-v2
        </a>
      </footer>
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