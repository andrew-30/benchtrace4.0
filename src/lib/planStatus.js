export function getPlanStatus(org) {
  if (!org) return { plan: 'starter', isBeta: true, isActive: true, daysLeft: null, trialExpired: false, showUpgradePrompt: false, urgentRenewal: false };

  const now = new Date();
  const trialExpiry = org.trial_expires_at ? new Date(org.trial_expires_at) : null;
  const trialStarted = org.trial_started_at ? new Date(org.trial_started_at) : null;
  const daysLeft = trialExpiry ? Math.ceil((trialExpiry - now) / (1000 * 60 * 60 * 24)) : null;
  const trialExpired = trialExpiry ? trialExpiry < now : false;
  const isBeta = org.beta_user === true || org.beta_user === undefined || org.beta_user === null;
  const totalTrialDays = (trialExpiry && trialStarted) ? Math.ceil((trialExpiry - trialStarted) / (1000 * 60 * 60 * 24)) : null;

  const PLAN_NAMES = {
    starter: 'Starter',
    lab: 'Lab',
    lab_pro: 'Lab Pro',
    enterprise: 'Enterprise',
    free: 'Starter',
    pro: 'Lab',
    team: 'Lab',
  };

  const PLAN_PRICES = {
    starter: '$19/mo',
    lab: '$79/mo',
    lab_pro: '$249/mo',
    enterprise: 'Custom',
  };

  return {
    plan: org.plan || 'starter',
    planName: PLAN_NAMES[org.plan] || 'Starter',
    planPrice: PLAN_PRICES[org.plan] || '$19/mo',
    isBeta,
    isActive: isBeta || !trialExpired,
    daysLeft,
    totalTrialDays,
    trialExpired,
    hasTrial: !!trialExpiry,
    showUpgradePrompt: trialExpired && !isBeta,
    urgentRenewal: daysLeft !== null && daysLeft <= 5 && !trialExpired && !isBeta,
    trialProgressPct: (totalTrialDays && daysLeft !== null) ? Math.round(((totalTrialDays - daysLeft) / totalTrialDays) * 100) : 0,
  };
}