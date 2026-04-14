import { createContext, useContext, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';

// ── Plan tiers & feature map ─────────────────────────────────────────────────
export const PLAN_TIER = { free: 0, starter: 1, lab: 2, lab_pro: 3 };

export const FEATURE_TIERS = {
  ai_normaliser:       'lab',
  audit_view:          'lab',
  esignature:          'lab',
  protocol_versioning: 'lab',
  team_management:     'lab',
  pdf_reports:         'lab',
  audit_readiness:     'lab_pro',
  traceability:        'lab_pro',
  deviation_center:    'lab_pro',
  unlimited_protocols: 'lab_pro',
};

export const PLAN_META = {
  free:     { name: 'Free',     price: 0,   color: '#94a3b8' },
  starter:  { name: 'Starter',  price: 19,  color: '#3b82f6' },
  lab:      { name: 'Lab',      price: 79,  color: '#6366f1' },
  lab_pro:  { name: 'Lab Pro',  price: 249, color: '#dc2626' },
};

const FEATURE_NAMES = {
  ai_normaliser:       'AI Protocol Normaliser',
  audit_view:          'Audit View & PDF Reports',
  esignature:          'E-Signature (21 CFR Part 11)',
  protocol_versioning: 'Protocol Version Control',
  team_management:     'Team Management',
  pdf_reports:         'PDF Reports',
  audit_readiness:     'Audit Readiness Score',
  traceability:        'Traceability Navigator',
  deviation_center:    'Deviation Center',
  unlimited_protocols: 'Unlimited Protocols',
};

// ── Context ──────────────────────────────────────────────────────────────────
export const PlanContext = createContext({
  org: null,
  activePlan: 'free',
  isBeta: false,
  canAccess: () => true,
  switchPreviewPlan: async () => {},
  refreshOrg: async () => {},
});

export function usePlan() {
  return useContext(PlanContext);
}

// ── PlanGate component ───────────────────────────────────────────────────────
export function PlanGate({ feature }) {
  const { isBeta, switchPreviewPlan } = usePlan();
  const navigate = useNavigate();

  const required = FEATURE_TIERS[feature] || 'starter';
  const meta = PLAN_META[required] || PLAN_META.starter;
  const featureName = FEATURE_NAMES[feature] || feature;

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 32,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 99, marginBottom: 14,
          background: `${meta.color}18`, border: `1px solid ${meta.color}50`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {meta.name} Feature
          </span>
        </div>

        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
          {featureName}
        </div>

        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 28 }}>
          This feature is included in the <strong>{meta.name}</strong> plan
          (€{meta.price}/month).
          {isBeta
            ? ' As a beta tester, click below to preview it now — no payment required.'
            : ' Upgrade your plan to unlock access.'
          }
        </div>

        {isBeta ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => switchPreviewPlan(required)}
              style={{
                padding: '12px 32px',
                background: meta.color, color: 'white',
                border: 'none', borderRadius: 9,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 4px 14px ${meta.color}50`,
              }}
            >
              Preview as {meta.name} →
            </button>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Switch anytime in Settings → Plan
            </span>
          </div>
        ) : (
          <button
            onClick={() => navigate('/pricing')}
            style={{
              padding: '12px 32px', background: meta.color,
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

// ── usePlanProvider — call inside AppLayout to build context value ─────────────
export function usePlanProvider() {
  const [org, setOrg] = useState(null);

  const loadOrg = useCallback(async () => {
    const orgId = localStorage.getItem('bt_org_id');
    if (!orgId) return null;
    try {
      const orgs = await base44.entities.Organization.filter({ id: orgId });
      const loaded = orgs?.[0];
      if (loaded) { setOrg(loaded); return loaded; }
    } catch(e) {
      console.error('PlanContext: failed to load org', e);
    }
    return null;
  }, []);

  const isBeta = org?.beta_user === true;
  const actualPlan = org?.plan || 'starter';
  const previewPlan = org?.preview_plan;
  const activePlan = isBeta && previewPlan && PLAN_TIER[previewPlan] !== undefined
    ? previewPlan
    : actualPlan;

  const canAccess = useCallback((feature) => {
    const required = FEATURE_TIERS[feature];
    if (!required) return true;
    return (PLAN_TIER[activePlan] ?? 0) >= (PLAN_TIER[required] ?? 0);
  }, [activePlan]);

  const switchPreviewPlan = useCallback(async (plan) => {
    const orgId = localStorage.getItem('bt_org_id');
    if (!orgId) return;
    await base44.entities.Organization.update(orgId, { preview_plan: plan });
    window.location.reload();
  }, []);

  return { org, setOrg, activePlan, isBeta, canAccess, switchPreviewPlan, refreshOrg: loadOrg, loadOrg };
}