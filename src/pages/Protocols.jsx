import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, Upload, Plus, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const FILTER_TABS = ["All", "Active", "Draft", "Archived"];

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  draft: "bg-gray-100 text-gray-600 border border-gray-200",
  archived: "bg-slate-100 text-slate-500 border border-slate-200",
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

function ProtocolCard({ protocol, stepCounts, onView }) {
  const count = stepCounts[protocol.id] || 0;

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 flex-1">
          {protocol.name}
        </h3>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[protocol.status] || STATUS_STYLES.draft}`}>
          {protocol.status}
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

      <div className="pt-1 border-t border-border flex justify-between items-center">
        {protocol.status === 'draft' && localStorage.getItem('bt_role') === 'admin' && onArchive && (
          <button
            onClick={async (e) => { e.stopPropagation(); onArchive(protocol.id); }}
            style={{ padding: '4px 10px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
          >
            Archive
          </button>
        )}
        <Button size="sm" variant="outline" onClick={() => onView(protocol.id)} className="ml-auto">
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
  const [archivingId, setArchivingId] = useState(null);

  const orgId = localStorage.getItem("bt_org_id");
  const isAdmin = localStorage.getItem('bt_role') === 'admin';

  useEffect(() => {
    async function load() {
      const data = await base44.entities.Protocol.filter({ organization_id: orgId }, "-created_date");
      setProtocols(data);

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

  const filtered = protocols.filter(p => {
    if (activeFilter === 'All') return p.status !== 'archived';
    if (activeFilter === 'Active') return p.status === 'active';
    if (activeFilter === 'Draft') return p.status === 'draft';
    if (activeFilter === 'Archived') return p.status === 'archived';
    return true;
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
              onArchive={async (id) => {
                setArchivingId(id);
                await base44.entities.Protocol.update(id, { status: 'archived' });
                setProtocols(prev => prev.map(pr => pr.id === id ? { ...pr, status: 'archived' } : pr));
                setArchivingId(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}