import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePlan, PlanGate } from "@/lib/PlanContext";

function calculateReadinessScore(protocols, runs, deviations, protocolVersions) {
  const checks = [];

  const published = protocols.filter(p => protocolVersions.some(v => v.protocol_id === p.id));
  checks.push({
    label: 'Protocols published',
    description: 'All protocols have at least one published version snapshot',
    score: protocols.length === 0 ? 100 : (published.length / protocols.length) * 100,
    detail: protocols.length === 0
      ? 'No protocols yet — import your first protocol to get started'
      : `${published.length} of ${protocols.length} protocol${protocols.length !== 1 ? 's' : ''} published`,
    passed: protocols.length === 0 || published.length === protocols.length,
    weight: 20,
    action: 'Publish protocols via Protocol Detail → Publish Version',
  });

  const doneRuns = runs.filter(r => ['completed', 'signed'].includes(r.run_state)); // abandoned excluded
  const signedRuns = runs.filter(r => r.run_state === 'signed');
  checks.push({
    label: 'Runs signed off',
    description: 'All completed runs have been reviewed and signed off',
    score: doneRuns.length > 0 ? (signedRuns.length / doneRuns.length) * 100 : 100,
    detail: doneRuns.length === 0
      ? 'No completed runs yet — execute and sign off your first run'
      : `${signedRuns.length} of ${doneRuns.length} signed`,
    passed: doneRuns.length === 0 || signedRuns.length === doneRuns.length,
    weight: 25,
    action: 'Open each completed run and sign off with Pass/Fail',
  });

  const openDevs = deviations.filter(d => d.status === 'open' && !d.archived);
  const totalDevs = deviations.filter(d => !d.archived);
  checks.push({
    label: 'Deviations resolved',
    description: 'All logged deviations reviewed and resolved',
    score: totalDevs.length === 0 ? 100 : ((totalDevs.length - openDevs.length) / totalDevs.length) * 100,
    detail: totalDevs.length === 0
      ? 'No deviations recorded — deviations are auto-flagged during runs'
      : openDevs.length === 0 ? `All ${totalDevs.length} resolved` : `${openDevs.length} open`,
    passed: openDevs.length === 0,
    weight: 25,
    action: 'Resolve open deviations via Deviation Center',
  });

  const signedWithResult = signedRuns.filter(r => r.result_status && r.result_status !== 'pending');
  checks.push({
    label: 'Run results recorded',
    description: 'All signed runs have Pass or Fail result',
    score: signedRuns.length > 0 ? (signedWithResult.length / signedRuns.length) * 100 : 100,
    detail: signedRuns.length === 0
      ? 'No signed runs yet — sign off a run with Pass or Fail result'
      : `${signedWithResult.length} of ${signedRuns.length} have result`,
    passed: signedRuns.length === 0 || signedWithResult.length === signedRuns.length,
    weight: 15,
    action: 'Re-sign runs and select Pass or Fail result',
  });

  const runsWithLots = runs.filter(r => Object.values(r.checklist_completed || {}).some(i => i.lot_number?.trim()));
  checks.push({
    label: 'Lot numbers recorded',
    description: 'Runs have reagent lot numbers captured at pre-run time',
    score: runs.length === 0 ? 100 : (runsWithLots.length / runs.length) * 100,
    detail: runs.length === 0
      ? 'No runs yet — start your first run to track lot numbers'
      : `${runsWithLots.length} of ${runs.length} run${runs.length !== 1 ? 's' : ''} have lot numbers`,
    passed: runs.length === 0 || runsWithLots.length === runs.length,
    weight: 15,
    action: 'Record lot numbers in Pre-Run checklist when starting runs',
  });

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const weightedScore = checks.reduce((s, c) => s + (c.score * c.weight / 100), 0);
  return { checks, overallScore: Math.round(weightedScore / totalWeight * 100) };
}

export default function AuditReadiness() {
  const { canAccess, org } = usePlan();
  const navigate = useNavigate();
  const orgId = localStorage.getItem('bt_org_id');
  const [protocols, setProtocols] = useState([]);
  const [runs, setRuns] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [protocolVersions, setProtocolVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !org) return;
    const load = async () => {
      try {
        const [p, r, d, v] = await Promise.all([
          base44.entities.Protocol.filter({ organization_id: orgId }),
          base44.entities.Run.filter({ organization_id: orgId }),
          base44.entities.Deviation.filter({ organization_id: orgId }),
          base44.entities.ProtocolVersion.filter({ organization_id: orgId }),
        ]);
        setProtocols(p || []); setRuns(r || []); setDeviations(d || []); setProtocolVersions(v || []);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [orgId, org]);

  if (!org) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ color: '#6366f1' }}>Loading...</div>
    </div>
  );

  if (!canAccess('audit_readiness')) return <PlanGate feature="audit_readiness" />;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ color: '#6366f1' }}>Calculating readiness...</div>
    </div>
  );

  const { checks, overallScore } = calculateReadinessScore(protocols, runs, deviations, protocolVersions);
  const sc = overallScore >= 90 ? '#16a34a' : overallScore >= 70 ? '#6366f1' : overallScore >= 50 ? '#d97706' : '#dc2626';
  const sl = overallScore >= 90 ? '✓ Audit ready' : overallScore >= 70 ? '⚠ Minor items to address' : overallScore >= 50 ? '⚠ Several items need attention' : '✗ Not audit ready';
  const passedCount = checks.filter(c => c.passed).length;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 0 40px', fontFamily: 'system-ui,sans-serif' }}>

      {protocols.length === 0 && runs.length === 0 && (
        <div style={{ padding: '16px 20px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4338ca', marginBottom: 6 }}>Welcome to BenchTrace! 🎉</div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
            Your audit readiness score starts at 100% — it tracks compliance gaps as you use BenchTrace. Start by importing your first protocol to begin tracking.
          </div>
          <button
            onClick={() => navigate('/import')}
            style={{ marginTop: 10, padding: '6px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Import First Protocol →
          </button>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Audit Readiness</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{passedCount}/{checks.length} checks passing · Compliance status for your laboratory</p>
      </div>

      {/* Overall score card */}
      <div style={{ background: 'white', borderRadius: 12, padding: '24px 28px', border: '1px solid #e2e8f0', marginBottom: 24, borderTop: `4px solid ${sc}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: sc, lineHeight: 1 }}>{overallScore}%</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 500 }}>{sl}</div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ height: '100%', borderRadius: 5, background: sc, width: `${overallScore}%` }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{c.passed ? '✅' : '⚠️'}</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#475569' }}>{c.label}</span>
                  <div style={{ width: 60, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: c.score >= 100 ? '#16a34a' : c.score >= 70 ? '#d97706' : '#dc2626', width: `${Math.min(100, c.score)}%` }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.score >= 100 ? '#16a34a' : c.score >= 70 ? '#d97706' : '#dc2626', width: 34, textAlign: 'right', flexShrink: 0 }}>{Math.round(c.score)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Individual check cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {checks.map((check, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 10, padding: '16px 18px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${check.passed ? '#16a34a' : '#f59e0b'}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15 }}>{check.passed ? '✅' : '⚠️'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{check.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 7px', borderRadius: 99 }}>{check.weight}% weight</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{check.description}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: check.passed ? '#16a34a' : '#d97706' }}>{check.detail}</div>
                {!check.passed && (
                  <div style={{ fontSize: 11, color: '#92400e', marginTop: 6, padding: '4px 8px', background: '#fffbeb', borderRadius: 5, border: '1px solid #fde68a' }}>
                    → {check.action}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: check.score >= 100 ? '#16a34a' : check.score >= 70 ? '#d97706' : '#dc2626' }}>{Math.round(check.score)}%</div>
                <div style={{ height: 4, width: 80, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: check.score >= 100 ? '#16a34a' : check.score >= 70 ? '#d97706' : '#dc2626', width: `${Math.min(100, check.score)}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Score legend */}
      <div style={{ padding: '12px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', width: '100%' }}>SCORE GUIDE</div>
        {[['90-100%', 'Audit ready', '#16a34a'], ['70-89%', 'Minor items', '#6366f1'], ['50-69%', 'Needs attention', '#d97706'], ['0-49%', 'Not ready', '#dc2626']].map(([range, label, color]) => (
          <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#475569' }}><strong>{range}</strong> — {label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}