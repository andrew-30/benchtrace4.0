import { getEffectivePlan, PLAN_TIER, FEATURE_TIERS, GATE_PLAN_CONFIG, setPreviewPlan, canAccess } from '@/lib/planGate';
import { useNavigate } from 'react-router-dom';

const FEATURE_LABELS = {
  ai_normaliser:        'AI Protocol Normaliser',
  audit_view:           'Audit View & PDF Reports',
  esignature:           'E-Signature (21 CFR Part 11)',
  protocol_versioning:  'Protocol Version Control',
  team_management:      'Team Management',
  pdf_reports:          'PDF Reports',
  audit_readiness:      'Audit Readiness Score',
  traceability:         'Traceability Navigator',
  deviation_center:     'Deviation Center',
  unlimited_protocols:  'Unlimited Protocols',
};

export default function FeatureGate({ feature, children }) {
  const navigate = useNavigate();
  const isBeta = localStorage.getItem('bt_beta') === 'true';

  if (canAccess(feature)) {
    return children ?? null;
  }

  const required = FEATURE_TIERS[feature] || 'starter';
  const reqConfig = GATE_PLAN_CONFIG[required] || GATE_PLAN_CONFIG.starter;
  const featureLabel = FEATURE_LABELS[feature] || `${reqConfig.name} Feature`;

  return (
    <div style={{
      padding: '40px 32px',
      background: '#f8fafc',
      border: '2px dashed #e2e8f0',
      borderRadius: 14,
      textAlign: 'center',
      margin: '16px 0',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: 480,
      marginLeft: 'auto',
      marginRight: 'auto',
    }}>
      <div style={{ fontSize: 36, marginBottom: 14 }}>🔒</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 14px', borderRadius: 99, marginBottom: 14,
        background: `${reqConfig.color}15`,
        border: `1px solid ${reqConfig.color}40`,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: reqConfig.color }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: reqConfig.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {reqConfig.name} Feature
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
        {featureLabel}
      </div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6, maxWidth: 340, margin: '0 auto 24px' }}>
        {isBeta
          ? `Click below to preview this feature as a ${reqConfig.name} user.`
          : `This feature requires the ${reqConfig.name} plan (€${reqConfig.price}/month).`
        }
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
            Switch Plan
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