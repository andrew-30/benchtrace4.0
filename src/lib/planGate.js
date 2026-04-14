// ─── PLAN TIER SYSTEM (DB-backed) ─────────────────────────────────────────────
// preview_plan lives on the Organization entity in DB, not in localStorage.
// _currentOrg is set once on boot by AppLayout via setCurrentOrg().

export const PLAN_TIER = { free: 0, starter: 1, lab: 2, lab_pro: 3 };

export const FEATURE_TIERS = {
  // LAB features
  ai_normaliser:       'lab',
  audit_view:          'lab',
  esignature:          'lab',
  protocol_versioning: 'lab',
  team_management:     'lab',
  pdf_reports:         'lab',
  // LAB PRO features
  audit_readiness:     'lab_pro',
  traceability:        'lab_pro',
  deviation_center:    'lab_pro',
  unlimited_protocols: 'lab_pro',
};

export const GATE_PLAN_CONFIG = {
  free:    { name: 'Free',    price: 0,   color: '#94a3b8' },
  starter: { name: 'Starter', price: 19,  color: '#3b82f6' },
  lab:     { name: 'Lab',     price: 79,  color: '#6366f1' },
  lab_pro: { name: 'Lab Pro', price: 249, color: '#dc2626' },
};

// Module-level org reference — set once on boot
let _currentOrg = null;

export function setCurrentOrg(org) {
  _currentOrg = org;
}

export function getCurrentOrg() {
  return _currentOrg;
}

// Get the plan to use for feature checks
// Beta users: use preview_plan if set, else actual plan
// Live users: always use actual plan
export function getActivePlan() {
  const org = _currentOrg;
  if (!org) return localStorage.getItem('bt_plan') || 'free';
  const isBeta = org.beta_user === true;
  if (isBeta && org.preview_plan) return org.preview_plan;
  return org.plan || 'free';
}

// Alias for compatibility
export const getEffectivePlan = getActivePlan;

// Check if a feature is accessible under the current plan
export function canAccess(feature) {
  const required = FEATURE_TIERS[feature];
  if (!required) return true;
  const activePlan = getActivePlan();
  return (PLAN_TIER[activePlan] ?? 0) >= (PLAN_TIER[required] ?? 0);
}