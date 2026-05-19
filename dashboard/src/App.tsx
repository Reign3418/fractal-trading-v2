import { useState, useEffect } from 'react';

const API_URL = 'https://fractal-trading-v2-production.up.railway.app';

interface Strategy {
  id: string;
  name: string;
  asset: string;
  type: string;
  status: 'active' | 'paused' | 'backtesting';
  params: Record<string, number>;
  signals: number;
  wins: number;
  losses: number;
  createdAt: number;
  activatedAt?: number;
}

interface BacktestResult {
  id: string;
  strategyId: string;
  strategyName: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  trades: number;
  candlesAnalyzed: number;
}

interface AnalysisResult {
  asset: string;
  timestamp: number;
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  price: number;
  indicators: Record<string, number>;
  detectors: DetectorResult[];
}

interface DetectorResult {
  name: string;
  status: 'active' | 'warning' | 'neutral';
  signal: 'bullish' | 'bearish' | 'neutral';
  value: number;
}

interface SignalLogEntry {
  id: string;
  strategyId: string;
  strategyName: string;
  asset: string;
  signal: 'buy' | 'sell' | 'hold';
  price: number;
  timestamp: number;
  confidence: number;
}

function App() {
  const [health, setHealth] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [signals, setSignals] = useState<SignalLogEntry[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult[]>([]);
  const [analysisStats, setAnalysisStats] = useState<any>(null);
  const [cityStats, setCityStats] = useState<any>(null);
  const [backtests, setBacktests] = useState<BacktestResult[]>([]);
  const [modalOpen, setModalOpen] = useState('');
  const [modalData, setModalData] = useState<any>({});

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/health`).then(r => r.json()),
      fetch(`${API_URL}/api/state`).then(r => r.json()),
      fetch(`${API_URL}/api/strategies`).then(r => r.json().catch(() => [])).catch(() => []),
      fetch(`${API_URL}/api/signals`).then(r => r.json().catch(() => [])).catch(() => []),
      fetch(`${API_URL}/api/analysis`).then(r => r.json().catch(() => null)).catch(() => null),
      fetch(`${API_URL}/api/analysis/BTC`).then(r => r.json().catch(() => [])).catch(() => []),
    ])
      .then(([h, s, strat, sig, ast, btcAnalysis]) => {
        setHealth(h);
        setState(s);
        setStrategies(strat);
        setSignals(sig);
        setAnalysisStats(ast);
        setCityStats(h?.city || null);
        setAnalysis(btcAnalysis);
        // Fetch backtests if city data available
        if (h?.city?.backtests > 0) {
          // Backtests are embedded in city stats, no separate endpoint
          setBacktests([]);
        }
      })
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

  const createStrategy = async () => {
    const name = modalData.name || 'New Strategy';
    const asset = modalData.asset || 'BTC';
    const type = modalData.type || 'trend';
    await fetch(`${API_URL}/api/strategies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, asset, type, params: { timeframe: 15, risk: 1.0 } }),
    });
    setModalOpen('');
    setModalData({});
    handleRefresh();
  };

  const activateStrategy = async (id?: string) => {
    const stratId = id || modalData.strategyId;
    if (!stratId) return;
    await fetch(`${API_URL}/api/strategies/${stratId}/activate`, { method: 'POST' });
    setModalOpen('');
    setModalData({});
    handleRefresh();
  };

  const pauseStrategy = async (id: string) => {
    await fetch(`${API_URL}/api/strategies/${id}/pause`, { method: 'POST' });
    handleRefresh();
  };

  const runAnalysis = async () => {
    const asset = modalData.asset || 'BTC';
    await fetch(`${API_URL}/api/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset }),
    });
    setModalOpen('');
    setModalData({});
    handleRefresh();
  };

  const oceanScan = async () => {
    await fetch(`${API_URL}/api/heartbeat`, { method: 'POST' });
    handleRefresh();
  };

  const openModal = (type: string) => { setModalOpen(type); setModalData({}); };
  const closeModal = () => { setModalOpen(''); setModalData({}); };

  if (loading) return <div className="loading"><h2>Loading Fractal Trading v2...</h2></div>;
  if (error) return <div className="error"><h2>Error: {error}</h2><button onClick={handleRefresh}>Retry</button></div>;

  const positions = Object.entries(state?.openPositions || {});
  const directives = Object.entries(state?.directives || {});
  const activeDirectives = directives.filter(([_, d]: [string, any]) => d.status === 'ACTIVE');
  const voidDirectives = directives.filter(([_, d]: [string, any]) => d.status === 'VOID');

  const signalColor = (s: string) => {
    if (s === 'bullish' || s === 'buy') return '#22c55e';
    if (s === 'bearish' || s === 'sell') return '#ef4444';
    return '#94a3b8';
  };

  const statusBadgeStyle = (status: string) => {
    const colors: Record<string, string> = {
      active: '#22c55e',
      paused: '#f59e0b',
      backtesting: '#8b5cf6',
      VOID: '#ef4444',
    };
    return {
      background: colors[status] || '#64748b',
      color: '#000',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: 'bold',
    };
  };

  return (
    <div className="container">
      <header>
        <h1>Fractal Trading v2</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="badge">LIVE</span>
          <button onClick={handleRefresh}>Refresh</button>
        </div>
      </header>

      {/* ===== TOP SUMMARY CARDS ===== */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <Card title="Status" value={health?.status || '?'} color="#22c55e" />
        <Card title="Positions" value={positions.length} color="#3b82f6" />
        <Card title="Active Directives" value={activeDirectives.length} color="#f59e0b" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <Card title="Queue" value={health?.river?.queueSize || 0} color="#8b5cf6" />
        <Card title="Strategies" value={cityStats?.strategies || 0} color="#06b6d4" />
        <Card title="Analysis Signals" value={signals.length} color="#ec4899" />
      </div>

      {/* ===== ACTION BUTTONS ===== */}
      <section>
        <h2>Actions</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={createTestPosition}>Add BTC Position</button>
          <button onClick={createDirective}>Add Directive</button>
          <button onClick={dropPrice}>Drop Price 6%</button>
          <button onClick={triggerHeartbeat}>Heartbeat</button>
          <button onClick={() => openModal('create-strategy')} style={{ background: '#06b6d4' }}>Create Strategy</button>
          <button onClick={() => openModal('activate-strategy')} style={{ background: '#06b6d4' }}>Activate Strategy</button>
          <button onClick={() => openModal('run-analysis')} style={{ background: '#ec4899' }}>Run Analysis</button>
          <button onClick={oceanScan} style={{ background: '#ec4899' }}>Ocean Scan</button>
        </div>
      </section>

      {/* ===== MODALS ===== */}
      {modalOpen === 'create-strategy' && (
        <section style={{ position: 'relative' }}>
          <h2>Create Strategy</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Strategy name" value={modalData.name || ''} onChange={e => setModalData({ ...modalData, name: e.target.value })} style={{ padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }} />
            <select value={modalData.asset || 'BTC'} onChange={e => setModalData({ ...modalData, asset: e.target.value })} style={{ padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
              <option>BTC</option><option>ETH</option><option>SOL</option><option>DOGE</option>
            </select>
            <select value={modalData.type || 'trend'} onChange={e => setModalData({ ...modalData, type: e.target.value })} style={{ padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
              <option>trend</option><option>mean_reversion</option><option>momentum</option><option>breakout</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createStrategy}>Create</button>
              <button onClick={closeModal} style={{ background: '#64748b' }}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      {modalOpen === 'activate-strategy' && (
        <section>
          <h2>Activate Strategy</h2>
          {strategies.length === 0 ? <p className="empty">No strategies available</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {strategies.map((s: Strategy) => (
                <div key={s.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><span className="name">{s.name}</span> <span style={statusBadgeStyle(s.status)}>{s.status}</span></span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.status === 'active' ? (
                      <button onClick={() => pauseStrategy(s.id)} style={{ background: '#f59e0b', padding: '4px 10px', fontSize: 12 }}>Pause</button>
                    ) : (
                      <button onClick={() => activateStrategy(s.id)} style={{ background: '#22c55e', padding: '4px 10px', fontSize: 12 }}>Activate</button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={closeModal} style={{ background: '#64748b', marginTop: 8 }}>Close</button>
            </div>
          )}
        </section>
      )}

      {modalOpen === 'run-analysis' && (
        <section>
          <h2>Run Analysis</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={modalData.asset || 'BTC'} onChange={e => setModalData({ ...modalData, asset: e.target.value })} style={{ padding: 8, borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}>
              <option>BTC</option><option>ETH</option><option>SOL</option><option>DOGE</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={runAnalysis}>Run</button>
              <button onClick={closeModal} style={{ background: '#64748b' }}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      {/* ===== NODE STATUS ===== */}
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

      {/* ===== OPEN POSITIONS ===== */}
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

      {/* ===== ACTIVE DIRECTIVES ===== */}
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

      {/* ===== VOID DIRECTIVES ===== */}
      {voidDirectives.length > 0 && (
        <section>
          <h2>Void Directives</h2>
          {voidDirectives.map(([id, d]: [string, any]) => (
            <div key={id} className="row"><span className="name">{d.action} {d.asset}</span><span className="meta">VOID</span></div>
          ))}
        </section>
      )}

      {/* ===== TRADING RIVER ===== */}
      <section>
        <h2>Trading River</h2>
        <div className="row"><span>Queue Size</span><span>{health?.river?.queueSize || 0}</span></div>
        <div className="row"><span>Pending</span><span>{health?.river?.pending || 0}</span></div>
        <div className="row"><span>Sent</span><span>{health?.river?.sent || 0}</span></div>
        <div className="row"><span>Rejected</span><span>{health?.river?.rejected || 0}</span></div>
        <div className="row"><span>Routes Logged</span><span>{health?.river?.routesLogged || 0}</span></div>
      </section>

      {/* ===== STRATEGY CITY PANEL ===== */}
      <section>
        <h2>Strategy City</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
          <Card title="Strategies" value={cityStats?.strategies || 0} color="#06b6d4" />
          <Card title="Active" value={cityStats?.active || 0} color="#22c55e" />
          <Card title="Signals" value={cityStats?.signalsGenerated || 0} color="#f59e0b" />
          <Card title="Backtests" value={cityStats?.backtests || 0} color="#8b5cf6" />
        </div>
        <h3 style={{ margin: '12px 0 8px', fontSize: 13, color: '#94a3b8', textTransform: 'uppercase' }}>Strategies</h3>
        {strategies.length === 0 ? <p className="empty">No strategies</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Asset</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px' }}>Signals</th>
                  <th style={{ textAlign: 'right', padding: '6px 4px' }}>W/L</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s: Strategy) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '6px 4px' }} className="name">{s.name}</td>
                    <td style={{ padding: '6px 4px' }}>{s.asset}</td>
                    <td style={{ padding: '6px 4px' }}>{s.type}</td>
                    <td style={{ padding: '6px 4px' }}><span style={statusBadgeStyle(s.status)}>{s.status}</span></td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{s.signals}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{s.wins}/{s.losses}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      {s.status === 'active' ? (
                        <button onClick={() => pauseStrategy(s.id)} style={{ background: '#f59e0b', padding: '3px 8px', fontSize: 11, margin: 0 }}>Pause</button>
                      ) : (
                        <button onClick={() => activateStrategy(s.id)} style={{ background: '#22c55e', padding: '3px 8px', fontSize: 11, margin: 0 }}>Activate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {signals.length > 0 && (
          <>
            <h3 style={{ margin: '16px 0 8px', fontSize: 13, color: '#94a3b8', textTransform: 'uppercase' }}>Recent Signals</h3>
            {signals.slice(-10).reverse().map((sig: SignalLogEntry) => (
              <div key={sig.id} className="row">
                <span className="name">{sig.strategyName}</span>
                <span style={{ color: signalColor(sig.signal), fontWeight: 'bold' }}>{sig.signal.toUpperCase()}</span>
                <span>{sig.asset} @ ${sig.price?.toLocaleString()}</span>
                <span className="meta">{sig.confidence?.toFixed(2)}</span>
              </div>
            ))}
          </>
        )}
      </section>

      {/* ===== ANALYSIS OCEAN PANEL ===== */}
      <section>
        <h2>Analysis Ocean</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 12 }}>
          <Card title="Analyses Run" value={analysisStats?.analysesRun || 0} color="#3b82f6" />
          <Card title="Assets Tracked" value={analysisStats?.assetsTracked || 0} color="#06b6d4" />
          <Card title="Indicators" value={analysisStats?.indicators || 0} color="#8b5cf6" />
        </div>

        <h3 style={{ margin: '12px 0 8px', fontSize: 13, color: '#94a3b8', textTransform: 'uppercase' }}>Latest Analysis</h3>
        {analysis.length === 0 ? <p className="empty">No analysis data — run an analysis</p> : (
          <>
            {analysis.slice(-5).reverse().map((a: AnalysisResult) => (
              <div key={`${a.asset}-${a.timestamp}`} className="row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span className="name">{a.asset}</span>
                  <span style={{ color: signalColor(a.overallSignal), fontWeight: 'bold' }}>{a.overallSignal.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 12 }}>
                  <span>Price: ${a.price?.toLocaleString()}</span>
                  <span>Confidence: {(a.confidence * 100).toFixed(0)}%</span>
                </div>
                {/* Confidence bar */}
                <div style={{ width: '100%', height: 4, background: '#334155', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${a.confidence * 100}%`, height: '100%', background: signalColor(a.overallSignal), borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* 5-Detector Grid */}
        {analysis.length > 0 && analysis[analysis.length - 1]?.detectors && (
          <>
            <h3 style={{ margin: '16px 0 8px', fontSize: 13, color: '#94a3b8', textTransform: 'uppercase' }}>Detector Grid</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {analysis[analysis.length - 1].detectors.map((d: DetectorResult) => (
                <div key={d.name} className="card" style={{ textAlign: 'center', padding: 10 }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: d.status === 'active' ? '#22c55e' : d.status === 'warning' ? '#f59e0b' : '#94a3b8', fontWeight: 'bold' }}>
                    {d.status}
                  </div>
                  <div style={{ fontSize: 10, color: signalColor(d.signal) }}>{d.signal}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Indicators Table */}
        {analysis.length > 0 && analysis[analysis.length - 1]?.indicators && (
          <>
            <h3 style={{ margin: '16px 0 8px', fontSize: 13, color: '#94a3b8', textTransform: 'uppercase' }}>Indicators</h3>
            {Object.entries(analysis[analysis.length - 1].indicators).map(([key, value]: [string, any]) => (
              <div key={key} className="row">
                <span className="name">{key}</span>
                <span>{typeof value === 'number' ? value.toFixed(2) : value}</span>
              </div>
            ))}
          </>
        )}

        {/* Run Analysis buttons per asset */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {['BTC', 'ETH', 'SOL'].map(asset => (
            <button key={asset} onClick={async () => {
              await fetch(`${API_URL}/api/analyze`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asset }),
              });
              handleRefresh();
            }} style={{ background: '#ec4899', padding: '4px 10px', fontSize: 12 }}>Analyze {asset}</button>
          ))}
        </div>
      </section>

      {/* ===== LAKE BASIN ===== */}
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
