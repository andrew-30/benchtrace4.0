import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PLAN_CONFIG } from "@/lib/planConfig";

const FAQ = [
  {
    q: 'What happens to my data when the trial ends?',
    a: 'Your data is always safe and accessible. After your trial ends, you can view existing protocols and runs but cannot create new ones until you upgrade. Nothing is ever deleted.',
  },
  {
    q: 'Can I switch between plans?',
    a: 'Yes — you can upgrade at any time. Your data and audit trail carry over seamlessly. Downgrades take effect at the end of your billing period.',
  },
  {
    q: 'Is there a student or academic discount?',
    a: 'Yes. PhD students and postdocs with a valid institutional email (.edu, .ac.uk etc) get 40% off the Starter plan. Contact us after signing up.',
  },
  {
    q: 'What does "21 CFR Part 11 compliant" mean?',
    a: 'Lab Pro includes electronic signature workflows with SHA-256 cryptographic hashing, full audit trails, and sign-off certification statements — all required for FDA-regulated environments.',
  },
  {
    q: 'How does the beta period work?',
    a: "During beta, all features are free regardless of your selected plan. When beta ends, you'll be notified and given 30 days to choose a paid plan. Early beta users get 3 months free.",
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes — annual billing saves you up to 25%. Starter: $15/mo ($180/yr), Lab: $59/mo ($708/yr), Lab Pro: $199/mo ($2,388/yr).',
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const orgId = localStorage.getItem('bt_org_id');
  const [annual, setAnnual] = useState(false);
  const [org, setOrg] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    base44.entities.Organization.filter({ id: orgId }).then(data => {
      setOrg(data?.[0] || null);
    }).catch(e => console.error(e));
  }, [orgId]);

  const currentPlan = org?.plan || localStorage.getItem('bt_plan') || 'starter';
  const isBeta = org?.beta_user === true || org?.beta_user === undefined || org?.beta_user === null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Beta banner */}
      <div style={{ background: 'linear-gradient(90deg, #1e1b4b, #312e81)', padding: '12px 24px', textAlign: 'center' }}>
        <span style={{ color: '#a5b4fc', fontSize: 13, fontWeight: 600 }}>
          🎉 BenchTrace is <strong>free during beta</strong>. Pricing below applies after launch. Early adopters get <strong>3 months free</strong> when we go live.
        </span>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, background: '#6366f1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: 16, fontWeight: 800 }}>B</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>BenchTrace</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe' }}>BETA</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', margin: '0 0 12px', lineHeight: 1.2 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 28px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Choose the plan that fits your lab. All plans include a free trial — no credit card required.
          </p>

          {/* Monthly/Annual toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 99, padding: '4px 6px' }}>
            <button
              onClick={() => setAnnual(false)}
              style={{ padding: '6px 18px', borderRadius: 99, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: !annual ? '#6366f1' : 'transparent', color: !annual ? 'white' : '#64748b' }}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              style={{ padding: '6px 18px', borderRadius: 99, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: annual ? '#6366f1' : 'transparent', color: annual ? 'white' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Annual
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>Save 25%</span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 48 }}>
          {Object.entries(PLAN_CONFIG).map(([planKey, plan]) => {
            const isCurrentPlan = currentPlan === planKey || (currentPlan === 'free' && planKey === 'starter');
            const displayPrice = annual ? plan.annualPrice : plan.price;

            return (
              <div key={planKey} style={{
                background: 'white', borderRadius: 14,
                border: `2px solid ${plan.popular ? plan.color : isCurrentPlan ? plan.color : '#e2e8f0'}`,
                padding: '28px 24px', position: 'relative',
                boxShadow: plan.popular ? '0 8px 32px rgba(99,102,241,0.15)' : 'none',
              }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: 'white', fontSize: 11, fontWeight: 800, padding: '4px 16px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
                    ★ MOST POPULAR
                  </div>
                )}
                {isCurrentPlan && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: plan.bg, color: plan.color, border: `1px solid ${plan.border}`, fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.06em' }}>
                    YOUR PLAN
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 24 }}>{plan.icon}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{plan.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>{plan.target}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 40, fontWeight: 900, color: plan.color }}>${displayPrice}</span>
                    <span style={{ fontSize: 13, color: '#64748b' }}>/month</span>
                  </div>
                  {annual ? (
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                      ${(plan.price - plan.annualPrice) * 12} saved annually
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      or ${plan.annualPrice}/mo billed annually
                    </div>
                  )}
                </div>

                <div style={{ padding: '6px 12px', background: plan.bg, border: `1px solid ${plan.border}`, borderRadius: 7, fontSize: 11, color: plan.color, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>
                  {plan.trialDays}-day free trial · No credit card required
                </div>

                <button
                  onClick={() => navigate(orgId ? '/settings' : '/onboarding')}
                  style={{
                    width: '100%', padding: '11px', marginBottom: 20,
                    background: isCurrentPlan ? plan.bg : plan.color,
                    color: isCurrentPlan ? plan.color : 'white',
                    border: `2px solid ${plan.color}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {isCurrentPlan ? `Current Plan${isBeta ? ' (Beta)' : ''}` : isBeta ? 'Start Free Trial →' : 'Get Started →'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.features.map((feature, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: feature.included ? '#16a34a' : '#cbd5e1', flexShrink: 0, fontWeight: 700 }}>
                        {feature.included ? '✓' : '✗'}
                      </span>
                      <span style={{ fontSize: 12, color: feature.included ? '#374151' : '#94a3b8' }}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Enterprise card */}
          <div style={{ background: '#1e293b', borderRadius: 14, border: '2px solid #334155', padding: '28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>🏢</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>Enterprise</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16, lineHeight: 1.5 }}>Multi-site pharma, large CROs, hospital networks</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#94a3b8', marginBottom: 4 }}>Custom</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 20 }}>Contact us for pricing</div>
            <a
              href="mailto:hello@benchtrace.app"
              style={{ display: 'block', width: '100%', padding: '11px', background: 'transparent', color: '#94a3b8', border: '2px solid #334155', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box', marginBottom: 20 }}
            >
              Talk to Us →
            </a>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Everything in Lab Pro +','Unlimited labs & sites','SOC 2 / ISO 27001 (coming)','SSO / LDAP integration (coming)','Dedicated customer success','Custom SLA + uptime guarantee','Custom compliance templates','Procurement & legal support'].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 640, margin: '0 auto', marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', textAlign: 'center', marginBottom: 28 }}>
            Frequently Asked Questions
          </h2>
          {FAQ.map((item, i) => (
            <div key={i} style={{ borderBottom: '1px solid #f1f5f9', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.q}</span>
                <span style={{ color: '#6366f1', fontSize: 18, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ paddingBottom: 16, fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>{item.a}</div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', padding: '40px 24px', background: 'linear-gradient(135deg, #eef2ff, #f0fdf4)', borderRadius: 16, border: '1px solid #e0e7ff' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
            Ready to bring compliance to your bench?
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Join labs using BenchTrace to execute protocols, track deviations, and generate audit-ready reports.
          </p>
          <button
            onClick={() => navigate(orgId ? '/dashboard' : '/onboarding')}
            style={{ padding: '12px 32px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {orgId ? 'Go to Dashboard →' : 'Start Free Trial →'}
          </button>
        </div>

      </div>
    </div>
  );
}