import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Upload, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const FILTER_TABS = ["All", "Active", "Draft", "Archived", "Pending"];

const STATUS_CONFIG = {
  active:   { label: 'Active',   bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  draft:    { label: 'Draft',    bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  archived: { label: 'Archived', bg: '#f1f5f9', color: '#94a3b8', border: '#e2e8f0' },
};

const CLASS_STYLES = {
  "Academic Research": "bg-violet-50 text-violet-700",
  "Clinical Diagnostic": "bg-cyan-50 text-cyan-700",
  "GMP Manufacturing": "bg-orange-50 text-orange-700",
  "ISO Accredited": "bg-blue-50 text-blue-700",
  "CRO Study": "bg-teal-50 text-teal-700",
  "Biotech Startup": "bg-fuchsia-50 text-fuchsia-700",
  "General": "bg-gray-100 text-gray-600",
};

// DEVICE RULE: Adjust SIZE and LAYOUT per device, never HIDE functionality
function ProtocolCard({
  protocol, stepCounts, onView,
  onArchive, onRestore, onDelete,
  confirmArchiveId, setConfirmArchiveId, archivingId, activeRunCounts,
  confirmDeleteId, setConfirmDeleteId, deletingId, runCountsByProtocol,
}) {
  const isAdmin = localStorage.getItem('bt_role') === 'admin';
  const runCount = runCountsByProtocol[protocol.id] || 0;
  const sc = STATUS_CONFIG[protocol.status] || STATUS_CONFIG.draft;

  return (
    <div
      style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${protocol.status === 'active' ? '#6366f1' : protocol.status === 'draft' ? '#f59e0b' : '#94a3b8'}`, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', opacity: protocol.status === 'archived' ? 0.75 : 1 }}
      onClick={() => onView(protocol.id)}
    >
      {/* Name + status row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4, lineHeight: 1.3 }}>{protocol.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label} v{protocol.version || 1}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{protocol.classification}</span>
            {protocol.has_unpublished_changes && protocol.status === 'active' && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>⚠ Unpublished</span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons — all devices, touch-friendly */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
        {/* View/Start Run */}
        {protocol.status === 'active' && (
          <button onClick={() => onView(protocol.id)}
            style={{ padding: '8px 16px', minHeight: 36, background: '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Start Run →
          </button>
        )}
        {protocol.status !== 'active' && (
          <button onClick={() => onView(protocol.id)}
            style={{ padding: '8px 14px', minHeight: 36, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600, flexShrink: 0 }}>
            View
          </button>
        )}

        {/* Publish pending */}
        {protocol.has_unpublished_changes && protocol.status === 'active' && isAdmin && (
          <button onClick={() => onView(protocol.id, true)}
            style={{ padding: '8px 14px', minHeight: 36, background: '#f59e0b', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Publish →
          </button>
        )}

        {/* Archive */}
        {(protocol.status === 'active' || protocol.status === 'draft') && isAdmin && (
          confirmArchiveId === protocol.id ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7 }}>
              {activeRunCounts[protocol.id] > 0 && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>⚠ {activeRunCounts[protocol.id]} active run{activeRunCounts[protocol.id] !== 1 ? 's' : ''}</span>}
              <button onClick={() => onArchive(protocol.id)} disabled={archivingId === protocol.id}
                style={{ padding: '5px 12px', minHeight: 30, background: '#ef4444', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {archivingId === protocol.id ? 'Archiving...' : 'Confirm'}
              </button>
              <button onClick={() => setConfirmArchiveId(null)}
                style={{ padding: '5px 10px', minHeight: 30, background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmArchiveId(protocol.id)}
              style={{ padding: '8px 12px', minHeight: 36, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
              Archive
            </button>
          )
        )}

        {/* Delete — draft with no runs */}
        {protocol.status === 'draft' && isAdmin && runCount === 0 && (
          confirmDeleteId === protocol.id ? (
            <div style={{ display: 'flex', gap: 6, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7 }}>
              <button onClick={() => onDelete(protocol.id)} disabled={deletingId === protocol.id}
                style={{ padding: '5px 12px', minHeight: 30, background: '#ef4444', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {deletingId === protocol.id ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button onClick={() => setConfirmDeleteId(null)}
                style={{ padding: '5px 10px', minHeight: 30, background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDeleteId(protocol.id)}
              style={{ padding: '8px 12px', minHeight: 36, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#94a3b8', fontWeight: 600 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
              Delete
            </button>
          )
        )}

        {/* Restore archived */}
        {protocol.status === 'archived' && isAdmin && (
          <button onClick={async () => { await base44.entities.Protocol.update(protocol.id, { status: 'draft' }); onRestore(protocol.id); }}
            style={{ padding: '8px 14px', minHeight: 36, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#16a34a', fontWeight: 600 }}>
            Restore to Draft
          </button>
        )}
      </div>
    </div>
  );
}

export default function Protocols() {
  const navigate = useNavigate();
  const [protocols, setProtocols] = useState([]);
  const [stepCounts, setStepCounts] = useState({});
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [activeRunCounts, setActiveRunCounts] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [runCountsByProtocol, setRunCountsByProtocol] = useState({});

  const orgId = localStorage.getItem("bt_org_id");
  const isAdmin = localStorage.getItem('bt_role') === 'admin';

  useEffect(() => {
    async function load() {
      const [data, allRuns] = await Promise.all([
        base44.entities.Protocol.filter({ organization_id: orgId }, "-created_date"),
        base44.entities.Run.filter({ organization_id: orgId }),
      ]);
      setProtocols(data);

      // All run counts per protocol
      const allCounts = {};
      const activeCounts = {};
      (allRuns || []).forEach(run => {
        allCounts[run.protocol_id] = (allCounts[run.protocol_id] || 0) + 1;
        if (run.run_state === 'in_progress') {
          activeCounts[run.protocol_id] = (activeCounts[run.protocol_id] || 0) + 1;
        }
      });
      setRunCountsByProtocol(allCounts);
      setActiveRunCounts(activeCounts);

      if (data.length > 0) {
        const steps = await base44.entities.ProtocolStep.filter({ organization_id: orgId });
        const counts = {};
        for (const s of steps) {
          counts[s.protocol_id] = (counts[s.protocol_id] || 0) + 1;
        }
        setStepCounts(counts);
      }

      setLoading(false);
    }
    load();
  }, [orgId]);

  const handleArchiveProtocol = async (protocolId) => {
    setArchivingId(protocolId);
    setConfirmArchiveId(null);
    try {
      await base44.entities.Protocol.update(protocolId, { status: 'archived' });
      setProtocols(prev => prev.map(p => p.id === protocolId ? { ...p, status: 'archived' } : p));
    } catch(err) {
      console.error('Archive failed:', err);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDeleteProtocol = async (protocolId) => {
    setDeletingId(protocolId);
    setConfirmDeleteId(null);
    try {
      // Final safety check
      const linkedRuns = await base44.entities.Run.filter({ protocol_id: protocolId, organization_id: orgId });
      if (linkedRuns.length > 0) {
        alert('Cannot delete — this protocol has linked runs. Archive it instead.');
        setDeletingId(null);
        return;
      }

      const [steps, items, versions] = await Promise.all([
        base44.entities.ProtocolStep.filter({ protocol_id: protocolId, organization_id: orgId }),
        base44.entities.ProtocolChecklistItem.filter({ protocol_id: protocolId, organization_id: orgId }),
        base44.entities.ProtocolVersion.filter({ protocol_id: protocolId, organization_id: orgId }),
      ]);

      await Promise.all([
        ...steps.map(s => base44.entities.ProtocolStep.delete(s.id)),
        ...items.map(i => base44.entities.ProtocolChecklistItem.delete(i.id)),
        ...versions.map(v => base44.entities.ProtocolVersion.delete(v.id)),
      ]);

      await base44.entities.Protocol.delete(protocolId);
      setProtocols(prev => prev.filter(p => p.id !== protocolId));
    } catch(err) {
      console.error('Delete protocol failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const pendingCount = protocols.filter(p => p.has_unpublished_changes && p.status === 'active').length;

  const filtered = protocols.filter(p => {
    if (activeFilter === 'All') return p.status !== 'archived';
    if (activeFilter === 'Active') return p.status === 'active';
    if (activeFilter === 'Draft') return p.status === 'draft';
    if (activeFilter === 'Archived') return p.status === 'archived';
    if (activeFilter === 'Pending') return p.has_unpublished_changes === true && p.status === 'active';
    return p.status !== 'archived';
  });

  return (
    <div className="space-y-6" style={{ paddingBottom: window.innerWidth < 768 ? 80 : 0 }}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Protocols</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate("/import")}>
                <Upload className="w-4 h-4 mr-1.5" />
                Import SOP
              </Button>
              <Button size="sm" onClick={() => navigate("/import")}>
                <Plus className="w-4 h-4 mr-1.5" />
                New Protocol
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: activeFilter === tab ? (tab === 'Pending' ? '#f59e0b' : '#6366f1') : '#f1f5f9', color: activeFilter === tab ? 'white' : '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {tab}
            {tab === 'Pending' && pendingCount > 0 && (
              <span style={{ fontSize: 9, fontWeight: 800, background: activeFilter === 'Pending' ? 'rgba(255,255,255,0.3)' : '#f59e0b', color: 'white', padding: '1px 5px', borderRadius: 99 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && activeFilter === 'Archived' ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No archived protocols.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <FlaskConical className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No protocols yet</p>
          <Button size="sm" className="mt-4" onClick={() => navigate("/import")}>
            <Plus className="w-4 h-4 mr-1.5" />Import SOP
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => (
            <ProtocolCard
              key={p.id}
              protocol={p}
              stepCounts={stepCounts}
              onView={(id, publish) => navigate(`/protocol-detail?id=${id}${publish ? '&publish=true' : ''}`)}
              onArchive={handleArchiveProtocol}
              onRestore={(id) => setProtocols(prev => prev.map(pr => pr.id === id ? { ...pr, status: 'draft' } : pr))}
              onDelete={handleDeleteProtocol}
              confirmArchiveId={confirmArchiveId}
              setConfirmArchiveId={setConfirmArchiveId}
              archivingId={archivingId}
              activeRunCounts={activeRunCounts}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              deletingId={deletingId}
              runCountsByProtocol={runCountsByProtocol}
            />
          ))}
        </div>
      )}
    </div>
  );
}