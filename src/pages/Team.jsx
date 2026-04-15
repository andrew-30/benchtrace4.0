import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DismissibleNotification from "@/components/DismissibleNotification";
import { usePlan, PlanGate } from "@/lib/PlanContext";

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export default function Team() {
  const { canAccess, org } = usePlan();
  const orgId = localStorage.getItem('bt_org_id');
  const isAdmin = localStorage.getItem('bt_role') === 'admin';

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [notification, setNotification] = useState(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState(null);

  // Link modal state
  const [createdInviteLink, setCreatedInviteLink] = useState('');
  const [createdInviteEmail, setCreatedInviteEmail] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState(null);

  function showNotification(message, type = 'success') {
    setNotification({ message, type });
    if (type === 'success' || type === 'info') {
      setTimeout(() => setNotification(prev => prev?.message === message ? null : prev), 5000);
    }
  }

  async function loadInvites() {
    const inviteData = await base44.entities.OrganizationInvite.filter({ organization_id: orgId });
    setInvites((inviteData || []).filter(i => i.status !== 'revoked'));
  }

  useEffect(() => {
    async function load() {
      try {
        const [memberships, inviteData, allUsers] = await Promise.all([
          base44.entities.OrganizationMembership.filter({ organization_id: orgId }),
          base44.entities.OrganizationInvite.filter({ organization_id: orgId }),
          base44.entities.User.list(),
        ]);
        setMembers(memberships || []);
        setInvites((inviteData || []).filter(i => i.status !== 'revoked'));
        setUsers(allUsers || []);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    }
    if (orgId) load();
  }, [orgId]);

  function getUserForMembership(membership) {
    return users.find(u => u.id === membership.user_id);
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim()) { setInviteError('Please enter an email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) { setInviteError('Please enter a valid email address.'); return; }

    const existingUser = users.find(u => u.email?.toLowerCase() === inviteEmail.toLowerCase());
    if (existingUser) {
      const existingMembership = members.find(m => m.user_id === existingUser.id);
      if (existingMembership) { setInviteError('This user is already a member of your lab.'); return; }
    }
    const existingInvite = invites.find(i => i.invited_email?.toLowerCase() === inviteEmail.toLowerCase() && i.status === 'pending');
    if (existingInvite) { setInviteError('A pending invite already exists for this email.'); return; }

    setInviting(true);
    setInviteError('');
    try {
      const user = await base44.auth.me();
      const token = generateToken();
      await base44.entities.OrganizationInvite.create({
        organization_id: orgId,
        invited_email: inviteEmail.trim().toLowerCase(),
        invited_role: inviteRole,
        status: 'pending',
        invited_by_user_id: user.id,
        invited_by_name: user.full_name || user.email,
        token: token,
        created_at: new Date().toISOString(),
      });

      const inviteLink = `${window.location.origin}/?invite_token=${token}`;
      setCreatedInviteLink(inviteLink);
      setCreatedInviteEmail(inviteEmail.trim());
      setInviteEmail('');
      setShowInviteForm(false);
      setShowLinkModal(true);

      await loadInvites();

      await base44.entities.AuditLog.create({
        organization_id: orgId,
        event_type: 'team_invite_sent',
        actor_user_id: user.id,
        actor_email: user.email,
        metadata: { invited_email: inviteEmail.trim(), invited_role: inviteRole },
        created_at: new Date().toISOString(),
      });
    } catch(e) {
      console.error('Invite failed:', e);
      setInviteError(e.message || 'Failed to create invite. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(inviteId) {
    try {
      await base44.entities.OrganizationInvite.update(inviteId, { status: 'revoked' });
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      setConfirmRevokeId(null);
    } catch(e) { console.error(e); }
  }

  if (!org) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
      <div style={{ color: '#6366f1', fontSize: 13 }}>Loading...</div>
    </div>
  );

  if (!canAccess('team_management')) return <PlanGate feature="team_management" />;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const pendingInvites = invites.filter(i => i.status === 'pending');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '8px 0' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Team</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            {members.length} member{members.length !== 1 ? 's' : ''} · {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && !showInviteForm && (
          <button
            onClick={() => setShowInviteForm(true)}
            style={{ padding: '9px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            + Invite Member
          </button>
        )}
      </div>

      <DismissibleNotification
        message={notification?.message}
        type={notification?.type}
        onDismiss={() => setNotification(null)}
      />

      {showInviteForm && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #c7d2fe', borderTop: '3px solid #6366f1', padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>Invite a Team Member</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
              placeholder="colleague@lab.com"
              type="email"
              autoFocus
              style={{ flex: 2, minWidth: 200, padding: '9px 12px', border: `1px solid ${inviteError ? '#ef4444' : '#e2e8f0'}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: 'white', boxSizing: 'border-box' }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {inviteError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{inviteError}</div>}
          <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
            <strong>Admin:</strong> Can edit protocols, manage team, view all data.<br />
            <strong>Member:</strong> Can execute runs, log deviations, view all data. Cannot edit protocols.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowInviteForm(false); setInviteError(''); setInviteEmail(''); }} style={{ padding: '8px 18px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#475569' }}>Cancel</button>
            <button
              onClick={handleSendInvite}
              disabled={inviting || !inviteEmail.trim()}
              style={{ padding: '8px 20px', background: inviting || !inviteEmail.trim() ? '#94a3b8' : '#6366f1', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer' }}
            >
              {inviting ? 'Creating invite...' : 'Create Invite & Get Link'}
            </button>
          </div>
        </div>
      )}

      {/* Current members */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Current Members ({members.length})
        </div>
        {members.map(membership => {
          const user = getUserForMembership(membership);
          return (
            <div key={membership.id} style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>
                  {((user?.full_name || user?.email || '?')[0] || '?').toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{user?.full_name || '—'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{user?.email || '—'}</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                background: membership.role === 'admin' ? '#eef2ff' : '#f1f5f9',
                color: membership.role === 'admin' ? '#4338ca' : '#64748b',
                border: `1px solid ${membership.role === 'admin' ? '#c7d2fe' : '#e2e8f0'}`
              }}>
                {(membership.role || 'member').toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Pending Invites ({pendingInvites.length})
          </div>
          {pendingInvites.map(invite => (
            <div key={invite.id} style={{ background: 'white', borderRadius: 10, border: '1px solid #fde68a', padding: '14px 18px', marginBottom: 8 }}>
              {confirmRevokeId === invite.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Revoke invite for {invite.invited_email}?</span>
                  <button onClick={() => handleRevokeInvite(invite.id)} style={{ padding: '5px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Revoke</button>
                  <button onClick={() => setConfirmRevokeId(null)} style={{ padding: '5px 12px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{invite.invited_email}</div>
                    <div style={{ fontSize: 11, color: '#92400e' }}>
                      {(invite.invited_role || 'member').toUpperCase()} · Pending · Sent {invite.created_at ? new Date(invite.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </div>
                  </div>
                  {invite.token && (
                    <button
                      onMouseDown={() => {
                        const link = `${window.location.origin}/?invite_token=${invite.token}`;
                        navigator.clipboard.writeText(link).then(() => {
                          setCopiedInviteId(invite.id);
                          setTimeout(() => setCopiedInviteId(null), 3000);
                        });
                      }}
                      style={{ padding: '5px 12px', background: copiedInviteId === invite.id ? '#16a34a' : 'white', color: copiedInviteId === invite.id ? 'white' : '#6366f1', border: '1px solid', borderColor: copiedInviteId === invite.id ? '#16a34a' : '#6366f1', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {copiedInviteId === invite.id ? '✓ Copied' : '📋 Copy Link'}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => setConfirmRevokeId(invite.id)} style={{ padding: '5px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#dc2626', whiteSpace: 'nowrap' }}>
                      Revoke
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite Link Modal */}
      {showLinkModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 24, fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            background: 'white', borderRadius: 14, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ background: '#f0fdf4', padding: '20px 24px', borderBottom: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'white', fontWeight: 700 }}>✓</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d' }}>Invite Created!</div>
                  <div style={{ fontSize: 12, color: '#16a34a' }}>Share this link with {createdInviteEmail}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {/* How it works */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>How it works</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { step: '1', text: 'Copy the link below and send it to ' + createdInviteEmail },
                    { step: '2', text: 'They click the link and sign up using that exact email address' },
                    { step: '3', text: 'They are automatically added to your team' },
                  ].map(s => (
                    <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#6366f1', color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.step}</div>
                      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{s.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite link */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Invite Link</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{
                    flex: 1, padding: '10px 12px', background: '#f8fafc',
                    border: '1px solid #e2e8f0', borderRadius: 8,
                    fontSize: 12, color: '#64748b', wordBreak: 'break-all',
                    lineHeight: 1.5, fontFamily: 'monospace',
                  }}>
                    {createdInviteLink}
                  </div>
                  <button
                    onMouseDown={() => {
                      navigator.clipboard.writeText(createdInviteLink).then(() => {
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 3000);
                      });
                    }}
                    style={{
                      padding: '10px 16px', flexShrink: 0,
                      background: linkCopied ? '#16a34a' : '#6366f1',
                      color: 'white', border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    {linkCopied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>

              {/* Share options */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Share via</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onMouseDown={() => {
                      const subject = 'Join my team on BenchTrace';
                      const body = `Hi,\n\nI've invited you to join my team on BenchTrace — a lab protocol and QC compliance platform.\n\nClick this link to accept your invitation:\n${createdInviteLink}\n\nImportant: You must sign up using this email address: ${createdInviteEmail}\n\nThe link expires in 7 days.\n\nSee you on BenchTrace!`;
                      window.open(`mailto:${createdInviteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                    }}
                    style={{ flex: 1, padding: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }}
                  >
                    ✉ Email
                  </button>
                  <button
                    onMouseDown={() => {
                      const text = `You've been invited to join BenchTrace! Click to accept: ${createdInviteLink} (Use email: ${createdInviteEmail})`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
                    }}
                    style={{ flex: 1, padding: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#16a34a', fontWeight: 600 }}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    onMouseDown={() => {
                      navigator.clipboard.writeText(createdInviteLink).then(() => {
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 3000);
                      });
                    }}
                    style={{ flex: 1, padding: '8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#4338ca', fontWeight: 600 }}
                  >
                    🔗 Copy Link
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                ⚠ The invited person must sign up using <strong>{createdInviteEmail}</strong> exactly. The link expires in 7 days.
              </div>

              <button
                onMouseDown={() => setShowLinkModal(false)}
                style={{ width: '100%', padding: '11px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}