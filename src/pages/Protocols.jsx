import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Upload, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const FILTER_TABS = ["All", "Active", "Draft", "Archived"];

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

function ProtocolCard({ protocol, stepCounts, onView, onArchive, onRestore, confirmArchiveId, setConfirmArchiveId, archivingId, activeRunCounts }) {
  const count = stepCounts[protocol.id] || 0;
  const sc = STATUS_CONFIG[protocol.status] || STATUS_CONFIG.draft;
  const isAdmin = localStorage.getItem('bt_role') === 'admin';

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
      </div>

      <div className="pt-1 border-t border-border flex flex-wrap justify-between items-center gap-2">
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

        <Button size="sm" variant="outline" onClick={() => onView(protocol.id)}>
          View
        </Button>
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

  const orgId = localStorage.getItem("bt_org_id");
  const isAdmin = localStorage.getItem('bt_role') === 'admin';

  useEffect(() => {
    async function load() {
      const [data, inProgressRuns] = await Promise.all([
        base44.entities.Protocol.filter({ organization_id: orgId }, "-created_date"),
        base44.entities.Run.filter({ organization_id: orgId, run_state: 'in_progress' }),
      ]);
      setProtocols(data);

      const runCounts = {};
      (inProgressRuns || []).forEach(run => {
        runCounts[run.protocol_id] = (runCounts[run.protocol_id] || 0) + 1;
      });
      setActiveRunCounts(runCounts);

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

  const filtered = protocols.filter(p => {
    if (activeFilter === 'All') return p.status !== 'archived';
    if (activeFilter === 'Active') return p.status === 'active';
    if (activeFilter === 'Draft') return p.status === 'draft';
    if (activeFilter === 'Archived') return p.status === 'archived';
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

      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeFilter === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
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
              onView={(id) => navigate(`/protocol-detail?id=${id}`)}
              onArchive={handleArchiveProtocol}
              onRestore={(id) => setProtocols(prev => prev.map(pr => pr.id === id ? { ...pr, status: 'draft' } : pr))}
              confirmArchiveId={confirmArchiveId}
              setConfirmArchiveId={setConfirmArchiveId}
              archivingId={archivingId}
              activeRunCounts={activeRunCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}