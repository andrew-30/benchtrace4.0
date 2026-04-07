import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

function tzFmt(dateStr) {
  if (!dateStr) return '—';
  const tz = localStorage.getItem('bt_tz') || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(dateStr));
  } catch(e) { return dateStr; }
}

const STATE_CONFIG = {
  signed:      { label: 'Signed',      bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' },
  completed:   { label: 'Completed',   bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  in_progress: { label: 'In Progress', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  abandoned:   { label: 'Abandoned',   bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
};

export default function Traceability() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('bt_org_id');

  const [searchType, setSearchType] = useState('lot');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const [selectedProtocolId, setSelectedProtocolId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    async function load() {
      const prots = await base44.entities.Protocol.filter({ organization_id: orgId });
      setProtocols(prots);
    }
    if (orgId) load();
  }, [orgId]);

  async function handleSearch() {
    if (searchType === 'lot' && !searchQuery.trim()) return;
    if (searchType === 'protocol' && !selectedProtocolId) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const allRuns = await base44.entities.Run.filter({ organization_id: orgId });

      if (searchType === 'lot') {
        const query = searchQuery.trim().toLowerCase();
        const matched = allRuns.filter(run => {
          const checklist = run.checklist_completed || {};
          return Object.values(checklist).some(item =>
            item.lot_number && item.lot_number.toLowerCase().includes(query)
          );
        });
        const prots = protocols.length > 0 ? protocols : await base44.entities.Protocol.filter({ organization_id: orgId });
        const enriched = matched.map(run => {
          const protocol = prots.find(p => p.id === run.protocol_id);
          const checklist = run.checklist_completed || {};
          const matchedLots = Object.values(checklist)
            .filter(item => item.lot_number && item.lot_number.toLowerCase().includes(query))
            .map(item => item.lot_number);
          return { ...run, protocolName: protocol?.name || '—', matchedLots: [...new Set(matchedLots)] };
        });
        setResults(enriched);
      } else {
        const matched = allRuns.filter(run => run.protocol_id === selectedProtocolId);
        const protocol = protocols.find(p => p.id === selectedProtocolId);
        const enriched = matched.map(run => ({
          ...run,
          protocolName: protocol?.name || '—',
          matchedLots: []
        }));
        setResults(enriched.sort((a, b) => new Date(b.run_started_at) - new Date(a.run_started_at)));
      }
    } catch(e) {
      console.error('Traceability search error:', e);
    } finally {
      setSearching(false);
    }
  }

  function resetSearch(type) {
    setSearchType(type);
    setResults([]);
    setHasSearched(false);
    setSearchQuery('');
    setSelectedProtocolId('');
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>
          Traceability Navigator
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          Track which runs used a specific lot number, or view all runs of a protocol
        </p>
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 24 }}>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[
            { value: 'lot', label: 'Search by Lot Number' },
            { value: 'protocol', label: 'Search by Protocol' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => resetSearch(opt.value)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: searchType === opt.value ? '#6366f1' : '#f1f5f9',
                color: searchType === opt.value ? 'white' : '#475569',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {searchType === 'lot' ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Enter lot number (e.g. ABC123)"
              autoFocus
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0',
                borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace'
              }}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              style={{
                padding: '10px 24px',
                background: searching || !searchQuery.trim() ? '#94a3b8' : '#6366f1',
                color: 'white', border: 'none', borderRadius: 8, fontSize: 13,
                fontWeight: 700, cursor: searching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {searching ? 'Searching...' : 'Search →'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              value={selectedProtocolId}
              onChange={e => setSelectedProtocolId(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0',
                borderRadius: 8, fontSize: 14, background: 'white', boxSizing: 'border-box'
              }}
            >
              <option value="">Select a protocol...</option>
              {protocols.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              disabled={searching || !selectedProtocolId}
              style={{
                padding: '10px 24px',
                background: searching || !selectedProtocolId ? '#94a3b8' : '#6366f1',
                color: 'white', border: 'none', borderRadius: 8, fontSize: 13,
                fontWeight: 700, cursor: searching || !selectedProtocolId ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {searching ? 'Searching...' : 'Search →'}
            </button>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
          {searchType === 'lot'
            ? 'Tip: Partial matches work — searching "ABC" will find "ABC123", "XABC"...'
            : 'Shows all runs of the selected protocol, most recent first'
          }
        </div>
      </div>

      {hasSearched && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              {results.length === 0
                ? 'No runs found'
                : `${results.length} run${results.length !== 1 ? 's' : ''} found`
              }
              {searchType === 'lot' && searchQuery && (
                <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginLeft: 8 }}>
                  matching lot "{searchQuery}"
                </span>
              )}
            </div>
            {results.length > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Click any run to view details</div>
            )}
          </div>

          {results.length === 0 && (
            <div style={{ padding: '40px 24px', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                {searchType === 'lot'
                  ? `No runs found using lot "${searchQuery}"`
                  : 'No runs found for this protocol'
                }
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {searchType === 'lot'
                  ? 'Try a partial search or check the lot number spelling'
                  : 'Start a run from the Protocol Detail page'
                }
              </div>
            </div>
          )}

          {results.map(run => {
            const badge = STATE_CONFIG[run.run_state] || STATE_CONFIG.completed;
            return (
              <div
                key={run.id}
                onClick={() => navigate(`/run-detail?id=${run.id}`)}
                style={{
                  background: 'white', borderRadius: 10, border: '1px solid #e2e8f0',
                  padding: '16px 18px', marginBottom: 10, cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{run.protocolName}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                        {badge.label}
                      </span>
                      {run.result_status && run.result_status !== 'pending' && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                          background: run.result_status === 'pass' ? '#f0fdf4' : '#fef2f2',
                          color: run.result_status === 'pass' ? '#16a34a' : '#dc2626',
                          border: `1px solid ${run.result_status === 'pass' ? '#bbf7d0' : '#fecaca'}`
                        }}>
                          {run.result_status === 'pass' ? '✓ Pass' : '✗ Fail'}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operator: </span>
                        <span style={{ fontSize: 12, color: '#475569' }}>{run.operator_name || '—'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Started: </span>
                        <span style={{ fontSize: 12, color: '#475569' }}>{tzFmt(run.run_started_at)}</span>
                      </div>
                      {run.signed_off_by_name && (
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signed by: </span>
                          <span style={{ fontSize: 12, color: '#475569' }}>{run.signed_off_by_name}</span>
                        </div>
                      )}
                    </div>
                    {searchType === 'lot' && run.matchedLots && run.matchedLots.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>MATCHED LOTS:</span>
                        {run.matchedLots.map(lot => (
                          <span key={lot} style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 4,
                            background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe',
                            fontFamily: 'monospace'
                          }}>
                            {lot}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 18, flexShrink: 0 }}>→</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasSearched && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Search your run history
          </div>
          <div style={{ fontSize: 13 }}>
            Find all runs using a specific lot number, or browse runs by protocol
          </div>
        </div>
      )}
    </div>
  );
}