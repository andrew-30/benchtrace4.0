import { useNavigate } from "react-router-dom";
import { PLAN_CONFIG } from "@/lib/planConfig";

export default function UpgradePrompt({ feature, planRequired, onClose }) {
  const navigate = useNavigate();
  const planCfg = PLAN_CONFIG[planRequired] || PLAN_CONFIG['lab'];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24, fontFamily: 'system-ui,sans-serif'
    }}>
      <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 420, padding: '32px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
          Upgrade to {planCfg.name}
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          <strong>{feature}</strong> requires the {planCfg.name} plan or higher.
          Your trial has ended — upgrade to continue.
        </p>
        <div style={{ padding: '12px 16px', background: planCfg.bg, border: `1px solid ${planCfg.border}`, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: planCfg.color }}>
            {planCfg.name} — ${planCfg.price}/month
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{planCfg.trialDays}-day free trial available</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#475569' }}>
            Not now
          </button>
          <button onClick={() => navigate('/pricing')}
            style={{ flex: 2, padding: '10px', background: planCfg.color, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            View Plans →
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
          Your existing data is safe and accessible
        </div>
      </div>
    </div>
  );
}