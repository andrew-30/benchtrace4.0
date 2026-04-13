import { getEffectivePlan, PLAN_TIER, FEATURE_TIERS, GATE_PLAN_CONFIG, setPreviewPlan } from '@/lib/planGate';
import { useNavigate } from 'react-router-dom';

export default function FeatureGate({ feature, children }) {
  const navigate = useNavigate();
  const isBeta = localStorage.getItem('bt_beta') === 'true';
  const effectivePlan = getEffectivePlan();
  const required = FEATURE_TIERS[feature] || 'starter';
  const hasAccess = (PLAN_TIER[effectivePlan] || 0) >= (PLAN_TIER[required] || 0);

  if (hasAccess) {
    return children;
  }

  const reqConfig = GATE_PLAN_CONFIG[required] || GATE_PLAN_CONFIG.starter;

  const featureLabel =
    feature === 'ai_normaliser'        ? 'AI Protocol Normaliser' :
    feature === 'audit_view'           ? 'Audit View & PDF Reports' :
    feature === 'esignature'           ? 'E-Signature (21 CFR Part 11)' :
    feature === 'protocol_versioning'  ? 'Protocol Version Control' :
    feature === 'team_management'      ? 'Team Management' :
    feature === 'audit_readiness'      ? 'Audit Readiness Score' :
    feature === 'traceability'         ? 'Traceability Navigator' :
    feature === 'deviation_center'     ? 'Deviation Center' :
    `${reqConfig.name} Feature`;

  return (
    <div style={{
      padding: '32px 24px', background: '#f8fafc',
      border: '2px dashed #e2e8f0', borderRadius: 12,
      textAlign: 'center', margin: '16px 0',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 99, marginBottom: 12,
        background: `${reqConfig.color}15`,
        border: `1px solid ${reqConfig.color}40`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: reqConfig.color }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: reqConfig.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {reqConfig.name} Feature
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
        {featureLabel}
      </div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6, maxWidth: 320, margin: '0 auto 20px' }}>
        This feature is available on the <strong>{reqConfig.name}</strong> plan
        (€{reqConfig.price}/month). {isBeta ? 'Click below to preview it now.' : 'Upgrade to unlock access.'}
      </div>
      {isBeta ? (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setPreviewPlan(required)}
            style={{
              padding: '10px 24px', background: reqConfig.color,
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Preview as {reqConfig.name} →
          </button>
          <button
            onClick={() => navigate('/settings')}
            style={{
              padding: '10px 18px', background: 'white',
              color: '#475569', border: '1px solid #e2e8f0',
              borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Switch Plan in Settings
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate('/pricing')}
          style={{
            padding: '10px 24px', background: reqConfig.color,
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Upgrade to {reqConfig.name} →
        </button>
      )}
    </div>
  );
}