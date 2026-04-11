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

function ProtocolCard({
  protocol, stepCounts, onView,
  onArchive, onRestore, onDelete,
  confirmArchiveId, setConfirmArchiveId, archivingId, activeRunCounts,
  confirmDeleteId, setConfirmDeleteId, deletingId, runCountsByProtocol,
}) {
  const count = stepCounts[protocol.id] || 0;
  const sc = STATUS_CONFIG[protocol.status] || STATUS_CONFIG.draft;
  const isAdmin = localStorage.getItem('bt_role') === 'admin';
  const runCount = runCountsByProtocol[protocol.id] || 0;

  return (
    <div
      className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
      style={{ opacity: protocol.status === 'archived' ? 0.7 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 flex-1">
          {protocol.name}
        </h3>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
          {sc.label}
        </span>
      </div>
      {protocol.has_unpublished_changes && protocol.status === 'active' && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          ⚠ Unpublished edits
        </span>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${CLASS_STYLES[protocol.classification] || CLASS_STYLES.General}`}>
          {protocol.classification}
        </span>
        {(protocol.compliance_tags || []).map(tag => (
          <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            {tag}
          </span>
        ))}
      </div>

      {protocol.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{protocol.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{count} step{count !== 1 ? "s" : ""}</span>
        {protocol.estimated_duration_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {protocol.estimated_duration_minutes}m
          </span>
        )}
        {/* Run count badge for draft protocols */}
        {protocol.status === 'draft' && isAdmin && (
          <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
            {runCount > 0
              ? `${runCount} run${runCount !== 1 ? 's' : ''} linked — archive only`
              : 'No runs — can delete'}
          </span>
        )}
      </div>

      <div className="pt-1 border-t border-border flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">

            {/* Archive control — active or draft, admin only */}
            {(protocol.status === 'active' || protocol.status === 'draft') && isAdmin && (
              <>
                {confirmArchiveId === protocol.id ? (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {activeRunCounts[protocol.id] > 0 ? (
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                        ⚠ {activeRunCounts[protocol.id]} run{activeRunCounts[protocol.id] !== 1 ? 's' : ''} in progress — new runs will be blocked
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                        Archive this protocol?
                      </span>
                    )}
                    <button
                      onClick={() => onArchive(protocol.id)}
                      disabled={archivingId === protocol.id}
                      style={{ padding: '3px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {archivingId === protocol.id ? 'Archiving...' : 'Yes, Archive'}
                    </button>
                    <button
                      onClick={() => setConfirmArchiveId(null)}
                      style={{ padding: '3px 10px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmArchiveId(protocol.id); }}
                    style={{ padding: '4px 10px', background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                  >
                    Archive
                  </button>
                )}
              </>
            )}

            {/* Delete button — ONLY for draft protocols with zero runs, admin only */}
            {protocol.status === 'draft' && isAdmin && runCount === 0 && (
              <>
                {confirmDeleteId === protocol.id ? (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>
                        Permanently delete this draft?
                      </div>
                      <div style={{ fontSize: 11, color: '#ef4444' }}>
                        This will also delete all steps, checklist items, and versions. This cannot be undone.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => onDelete(protocol.id)}
                        disabled={deletingId === protocol.id}
                        style={{ padding: '5px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: deletingId === protocol.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {deletingId === protocol.id ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ padding: '5px 12px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(protocol.id); }}
                    style={{ padding: '4px 10px', background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
                  >
                    Delete
                  </button>
                )}
              </>
            )}

            {/* Draft with runs — greyed-out delete with tooltip */}
            {protocol.status === 'draft' && isAdmin && runCount > 0 && (
              <span
                title={`Cannot delete — ${runCount} run${runCount !== 1 ? 's' : ''} reference this protocol. Archive it instead.`}
                style={{ padding: '4px 10px', background: '#f8fafc', color: '#cbd5e1', border: '1px solid #f1f5f9', borderRadius: 6, fontSize: 11, cursor: 'not-allowed', fontWeight: 600, userSelect: 'none' }}
              >
                Delete
              </span>
            )}

            {/* Restore button — archived, admin only */}
            {protocol.status === 'archived' && isAdmin && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await base44.entities.Protocol.update(protocol.id, { status: 'draft' });
                    onRestore(protocol.id);
                  } catch(err) {
                    console.error('Restore failed:', err);
                  }
                }}
                style={{ padding: '4px 10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
              >
                Restore to Draft
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {protocol.has_unpublished_changes && protocol.status === 'active' && isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onView(protocol.id, true); }}
                style={{ padding: '4px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Publish →
              </button>
            )}
            <Button size="sm" variant="outline" onClick={() => onView(protocol.id)}>
              View
            </Button>
          </div>
        </div>
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
    <div className="space-y-6">
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
          No archived protocols. Archive a draft or active protocol to store it here.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <FlaskConical className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">No protocols yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Import an SOP or create one manually to get started.
          </p>
          <Button size="sm" className="mt-4" onClick={() => navigate("/import")}>
            <Plus className="w-4 h-4 mr-1.5" />
            Import SOP
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