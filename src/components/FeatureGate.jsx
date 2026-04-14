import { canAccess, getCurrentOrg, FEATURE_TIERS, GATE_PLAN_CONFIG } from '@/lib/planGate';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

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
  const org = getCurrentOrg();
  const isBeta = org?.beta_user === true;

  if (canAccess(feature)) return children ?? null;

  const required = FEATURE_TIERS[feature] || 'starter';
  const meta = GATE_PLAN_CONFIG[required] || GATE_PLAN_CONFIG.starter;
  const featureLabel = FEATURE_LABELS[feature] || `${meta.name} Feature`;

  const handlePreview = async () => {
    const orgId = localStorage.getItem('bt_org_id');
    if (!orgId) return;
    await base44.entities.Organization.update(orgId, { preview_plan: required });
    window.location.reload();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 300, padding: 32,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 99, marginBottom: 14,
          background: `${meta.color}15`, border: `1px solid ${meta.color}40`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {meta.name} Feature
          </span>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>
          {featureLabel}
        </h3>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
          This feature is included in the <strong>{meta.name}</strong> plan (€{meta.price}/month).{' '}
          {isBeta
            ? 'As a beta tester, you can preview it right now.'
            : 'Upgrade your plan to unlock access.'
          }
        </p>
        {isBeta ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <button
              onClick={handlePreview}
              style={{
                padding: '12px 28px', background: meta.color,
                color: 'white', border: 'none', borderRadius: 9,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 4px 14px ${meta.color}40`,
              }}
            >
              Preview as {meta.name} →
            </button>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
              Switch plans anytime in Settings
            </p>
          </div>
        ) : (
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '12px 28px', background: meta.color,
              color: 'white', border: 'none', borderRadius: 9,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Upgrade to {meta.name} →
          </button>
        )}
      </div>
    </div>
  );
}