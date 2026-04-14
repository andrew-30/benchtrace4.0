// Plan tier hierarchy
export const PLAN_TIER = {
  free:     0,
  starter:  1,
  lab:      2,
  lab_pro:  3,
};

// Every feature MUST be in here with the correct minimum plan
export const FEATURE_TIERS = {
  // STARTER — basic functionality only
  basic_runs:           'starter',
  basic_protocols:      'starter',
  deviation_logging:    'starter',
  run_history:          'starter',

  // LAB — professional compliance features
  ai_normaliser:        'lab',
  audit_view:           'lab',
  esignature:           'lab',
  protocol_versioning:  'lab',
  team_management:      'lab',
  pdf_reports:          'lab',

  // LAB PRO — advanced compliance suite
  audit_readiness:      'lab_pro',
  traceability:         'lab_pro',
  deviation_center:     'lab_pro',
  unlimited_protocols:  'lab_pro',
};

export const GATE_PLAN_CONFIG = {
  free:     { name: 'Free',     price: 0,   color: '#94a3b8' },
  starter:  { name: 'Starter',  price: 19,  color: '#3b82f6' },
  lab:      { name: 'Lab',      price: 79,  color: '#6366f1' },
  lab_pro:  { name: 'Lab Pro',  price: 249, color: '#dc2626' },
};

// Get the effective plan — beta users use preview plan
export function getEffectivePlan() {
  const isBeta = localStorage.getItem('bt_beta') === 'true';
  if (isBeta) {
    const preview = localStorage.getItem('bt_preview_plan');
    if (preview) return preview;
  }
  return localStorage.getItem('bt_plan') || 'free';
}

// Check if current plan can access a feature
export function canAccess(feature) {
  const required = FEATURE_TIERS[feature];
  if (!required) return true;
  const effectivePlan = getEffectivePlan();
  return (PLAN_TIER[effectivePlan] ?? 0) >= (PLAN_TIER[required] ?? 0);
}

// Set preview plan for beta testers
export function setPreviewPlan(plan) {
  localStorage.setItem('bt_preview_plan', plan);
  window.location.reload();
}