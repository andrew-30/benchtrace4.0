export default function DismissibleNotification({ message, type, onDismiss }) {
  if (!message) return null;

  const config = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', icon: '✓' },
    error:   { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: '✗' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
    warning: { bg: '#fffbeb', border: '#fde68a', color: '#d97706', icon: '⚠' },
  };
  const c = config[type] || config.info;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      style={{
        padding: '10px 14px', background: c.bg,
        border: `1px solid ${c.border}`, borderRadius: 8,
        marginBottom: 14, display: 'flex',
        alignItems: 'flex-start', justifyContent: 'space-between', gap: 10
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
        <span style={{ fontSize: 14, color: c.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
        <span style={{ fontSize: 13, color: c.color, fontWeight: 600, lineHeight: 1.5 }}>{message}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDismiss(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: c.color, fontSize: 20, fontWeight: 700,
          lineHeight: 1, padding: '0 2px', flexShrink: 0, opacity: 0.7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 4
        }}
      >
        ×
      </button>
    </div>
  );
}