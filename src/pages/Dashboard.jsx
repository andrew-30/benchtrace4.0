import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

function useDeviceType() {
  const [device, setDevice] = useState(() => { const w = window.innerWidth; return { isMobile: w < 768, isTablet: w >= 768 && w < 1200 }; });
  useEffect(() => {
    const update = () => { const w = window.innerWidth; setDevice({ isMobile: w < 768, isTablet: w >= 768 && w < 1200 }); };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return device;
}

function getWeeklyRunData(runs) {
  const now = new Date();
  const weeks = [];
  for (let i = 5; i >= 0; i--) {
    const weekStart = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const count = runs.filter(r => {
      const d = new Date(r.run_started_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    const label = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    weeks.push({ label, count });
  }
  return weeks;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const device = useDeviceType();
  const orgId = localStorage.getItem('bt_org_id');
  const isAdmin = localStorage.getItem('bt_role') === 'admin';

  const [org, setOrg] = useState(null);
  const [runs, setRuns] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [orgsData, runsData, protsData, devsData] = await Promise.all([
          base44.entities.Organization.filter({ id: orgId }),
          base44.entities.Run.filter({ organization_id: orgId }),
          base44.entities.Protocol.filter({ organization_id: orgId }),
          base44.entities.Deviation.filter({ organization_id: orgId }),
        ]);
        setOrg(orgsData?.[0] || null);
        setRuns((runsData || []).sort((a, b) => new Date(b.run_started_at) - new Date(a.run_started_at)));
        setProtocols(protsData || []);
        setDeviations(devsData || []);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    }
    if (orgId) load();
  }, [orgId]);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeRuns = runs.filter(r => r.run_state === 'in_progress').length;
  const passRuns = runs.filter(r => r.result_status === 'pass').length;
  const failRuns = runs.filter(r => r.result_status === 'fail').length;
  const runsThisMonth = runs.filter(r => new Date(r.run_started_at) >= thisMonthStart).length;
  const openDeviations = deviations.filter(d => d.status === 'open' && !d.archived).length;
  const resolvedDeviations = deviations.filter(d => d.status === 'resolved').length;
  const passRate = (passRuns + failRuns) > 0 ? Math.round((passRuns / (passRuns + failRuns)) * 100) : null;
  const signedRuns = runs.filter(r => r.run_state === 'signed').length;

  const pendingProtocols = protocols.filter(p => p.has_unpublished_changes && p.status === 'active');

  if (device.isMobile) {
    return (
      <div style={{ paddingBottom: 80 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>{org?.name || 'Dashboard'}</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>
        {!loading && pendingProtocols.length > 0 && (
          <div onClick={() => navigate('/protocols?filter=Pending')} style={{ cursor: 'pointer', padding: '12px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', borderTop: '3px solid #f59e0b', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#78350f', fontWeight: 600 }}>⚠️ {pendingProtocols.length} protocol{pendingProtocols.length !== 1 ? 's have' : ' has'} unpublished edits</div>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b' }}>{pendingProtocols.length}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Active Runs', value: activeRuns, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Protocols', value: protocols.length, color: '#6366f1', bg: '#eef2ff' },
            { label: 'Open Deviations', value: openDeviations, color: openDeviations > 0 ? '#dc2626' : '#16a34a', bg: openDeviations > 0 ? '#fef2f2' : '#f0fdf4' },
            { label: 'Pass Rate', value: passRate !== null ? `${passRate}%` : '—', color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Total Runs', value: runs.length, color: '#0891b2', bg: '#ecfeff' },
            { label: 'Signed Runs', value: signedRuns, color: '#6366f1', bg: '#eef2ff' },
          ].map((stat, i) => (
            <div key={i} style={{ background: stat.bg, borderRadius: 10, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: stat.color }}>{loading ? '...' : stat.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Recent Runs</div>
          {runs.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No runs yet.</div>
          ) : runs.slice(0, 5).map(run => {
            const proto = protocols.find(p => p.id === run.protocol_id);
            return (
              <div key={run.id}
                onClick={() => navigate(run.run_state === 'in_progress' ? `/run-execution?id=${run.id}` : `/run-detail?id=${run.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 6, cursor: 'pointer', minHeight: 52 }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: run.run_state === 'in_progress' ? '#3b82f6' : run.run_state === 'signed' ? '#6366f1' : run.run_state === 'abandoned' ? '#94a3b8' : '#16a34a' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proto?.name || 'Protocol'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(run.run_started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · {run.operator_name}</div>
                </div>
                {run.run_state === 'in_progress' ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '3px 8px', borderRadius: 99, flexShrink: 0 }}>Resume →</span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0, background: run.result_status === 'pass' ? '#f0fdf4' : run.result_status === 'fail' ? '#fef2f2' : '#f8fafc', color: run.result_status === 'pass' ? '#16a34a' : run.result_status === 'fail' ? '#dc2626' : '#94a3b8', border: `1px solid ${run.result_status === 'pass' ? '#bbf7d0' : run.result_status === 'fail' ? '#fecaca' : '#e2e8f0'}` }}>
                    {run.result_status === 'pass' ? 'PASS' : run.result_status === 'fail' ? 'FAIL' : run.result_status === 'abandoned' ? 'ABD' : 'PEND'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Quick actions — 2x2 grid, full-width tappable cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Protocols', sub: `${protocols.length} total`, color: '#6366f1', path: '/protocols' },
            { label: 'Start Run', sub: 'Begin execution', color: '#16a34a', path: '/protocols' },
            { label: 'Deviations', sub: `${openDeviations} open`, color: openDeviations > 0 ? '#dc2626' : '#64748b', path: '/deviations' },
            { label: 'Audit', sub: 'Readiness check', color: '#8b5cf6', path: '/audit-readiness' },
          ].map((action, i) => (
            <div key={i} onClick={() => navigate(action.path)}
              style={{ padding: '16px', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${action.color}`, cursor: 'pointer', minHeight: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{action.label}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{action.sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const weekData = getWeeklyRunData(runs);
  const maxCount = Math.max(...weekData.map(w => w.count), 1);

  const statCards = [
    { label: 'Active Runs', value: activeRuns, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Protocols', value: protocols.length, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
    { label: 'Open Deviations', value: openDeviations, color: openDeviations > 0 ? '#dc2626' : '#16a34a', bg: openDeviations > 0 ? '#fef2f2' : '#f0fdf4', border: openDeviations > 0 ? '#fecaca' : '#bbf7d0' },
    { label: 'Pass Rate', value: passRate !== null ? `${passRate}%` : '\u2014', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { label: 'Total Runs', value: runs.length, color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
    { label: 'Signed Runs', value: signedRuns, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  ];

  const quickLinks = [
    { label: 'Protocols', sub: `${protocols.length} total`, color: '#6366f1', path: '/protocols' },
    { label: 'Start Run', sub: 'Begin execution', color: '#16a34a', path: '/protocols' },
    { label: 'Deviations', sub: `${openDeviations} open`, color: openDeviations > 0 ? '#dc2626' : '#64748b', path: '/deviations' },
    { label: 'Audit', sub: 'Readiness check', color: '#8b5cf6', path: '/audit-readiness' },
    { label: 'Traceability', sub: 'Lot tracking', color: '#0891b2', path: '/traceability' },
    { label: 'Team', sub: 'Members', color: '#f59e0b', path: '/team' },
  ];

  return (
    <div style={{ paddingBottom: window.innerWidth < 768 ? 80 : 0 }}>
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>
          {org?.name || 'Dashboard'}
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          {org?.sector || 'Laboratory'} · {now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Pending publish alert */}
      {!loading && pendingProtocols.length > 0 && (
        <div
          onClick={() => navigate('/protocols?filter=Pending')}
          style={{ cursor: 'pointer', padding: '14px 18px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a', borderTop: '3px solid #f59e0b', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(245,158,11,0.15)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Pending Publish</div>
            <div style={{ fontSize: 13, color: '#78350f' }}><strong>{pendingProtocols.length}</strong> protocol{pendingProtocols.length !== 1 ? 's have' : ' has'} unpublished edits</div>
          </div>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>{pendingProtocols.length}</span>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {statCards.map((stat, i) => (
          <div key={i} style={{ background: stat.bg, borderRadius: 10, padding: '16px 18px', border: `1px solid ${stat.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: stat.color, lineHeight: 1 }}>
              {loading ? '...' : stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

        {/* Weekly bar chart */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>Runs per Week</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Last 6 weeks</div>
          {loading ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {weekData.map((week, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', minHeight: 14 }}>{week.count > 0 ? week.count : ''}</div>
                  <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: week.count > 0 ? '#6366f1' : '#f1f5f9', height: `${Math.max((week.count / maxCount) * 90, week.count > 0 ? 8 : 4)}px`, minHeight: 4 }} />
                  <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', lineHeight: 1.2 }}>{week.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pass/fail breakdown */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>Run Results</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>All time breakdown</div>
          {loading ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>Loading...</div>
          ) : (
            <div>
              {[
                { label: 'Pass', count: passRuns, color: '#16a34a' },
                { label: 'Fail', count: failRuns, color: '#dc2626' },
                { label: 'Pending', count: runs.filter(r => r.result_status === 'pending').length, color: '#d97706' },
                { label: 'In Progress', count: activeRuns, color: '#3b82f6' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 64, fontSize: 12, fontWeight: 600, color: '#475569', flexShrink: 0 }}>{item.label}</div>
                  <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: item.color, width: runs.length > 0 ? `${(item.count / runs.length) * 100}%` : '0%' }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: item.color, width: 22, textAlign: 'right' }}>{item.count}</div>
                </div>
              ))}
              {passRate !== null && (
                <div style={{ marginTop: 10, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  Pass rate: {passRate}%
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deviation summary */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>Deviations</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Status overview</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Open', count: openDeviations, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
              { label: 'Resolved', count: resolvedDeviations, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
              { label: 'Total', count: deviations.length, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: '10px 8px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {openDeviations > 0 ? (
            <button onClick={() => navigate('/deviations')} style={{ width: '100%', padding: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              View {openDeviations} open deviation{openDeviations !== 1 ? 's' : ''} →
            </button>
          ) : (
            <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 7, fontSize: 12, color: '#16a34a', fontWeight: 500 }}>✓ All deviations resolved</div>
          )}
        </div>

        {/* Recent runs */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Recent Runs</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Last 5 runs</div>
            </div>
            <button onClick={() => navigate('/runs')} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Loading...</div>
          ) : runs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No runs yet. Select a protocol to start.</div>
          ) : runs.slice(0, 5).map(run => {
            const proto = protocols.find(p => p.id === run.protocol_id);
            const STATE_COLOR = { signed: '#6366f1', completed: '#16a34a', in_progress: '#3b82f6', abandoned: '#64748b' };
            return (
              <div key={run.id}
                onClick={() => run.run_state !== 'in_progress' && navigate(`/run-detail?id=${run.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: '1px solid #f1f5f9', cursor: run.run_state !== 'in_progress' ? 'pointer' : 'default', borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATE_COLOR[run.run_state] || '#94a3b8', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proto?.name || 'Protocol'}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(run.run_started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                {run.run_state === 'in_progress' ? (
                  <button onClick={() => navigate(`/run-execution?id=${run.id}`)} style={{ padding: '3px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>▶ Resume</button>
                ) : run.run_state === 'abandoned' ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', flexShrink: 0 }}>ABANDONED</span>
                ) : (
                  run.result_status && run.result_status !== 'pending' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: run.result_status === 'pass' ? '#f0fdf4' : '#fef2f2', color: run.result_status === 'pass' ? '#16a34a' : '#dc2626', border: `1px solid ${run.result_status === 'pass' ? '#bbf7d0' : '#fecaca'}`, flexShrink: 0 }}>
                      {run.result_status === 'pass' ? 'PASS' : 'FAIL'}
                    </span>
                  )
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Quick action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {quickLinks.map((card, i) => (
          <div key={i} onClick={() => navigate(card.path)}
            style={{ background: 'white', borderRadius: 10, padding: '14px 16px', border: '1px solid #e2e8f0', cursor: 'pointer', borderTop: `3px solid ${card.color}` }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{card.label}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}