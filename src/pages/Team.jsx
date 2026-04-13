import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DismissibleNotification from "@/components/DismissibleNotification";
import FeatureGate from "@/components/FeatureGate";

export default function Team() {
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

  function showNotification(message, type = 'success') {
    setNotification({ message, type });
    if (type === 'success' || type === 'info') {
      setTimeout(() => setNotification(prev => prev?.message === message ? null : prev), 5000);
    }
  }
  const [confirmRevokeId, setConfirmRevokeId] = useState(null);

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
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    const existingUser = users.find(u => u.email?.toLowerCase() === inviteEmail.toLowerCase());
    if (existingUser) {
      const existingMembership = members.find(m => m.user_id === existingUser.id);
      if (existingMembership) {
        setInviteError('This user is already a member of your lab.');
        return;
      }
    }
    const existingInvite = invites.find(i => i.invited_email?.toLowerCase() === inviteEmail.toLowerCase() && i.status === 'pending');
    if (existingInvite) {
      setInviteError('A pending invite already exists for this email.');
      return;
    }

    setInviting(true);
    setInviteError('');
    try {
      const currentUser = await base44.auth.me();
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      const invite = await base44.entities.OrganizationInvite.create({
        organization_id: orgId,
        invited_email: inviteEmail.trim().toLowerCase(),
        invited_role: inviteRole,
        status: 'pending',
        invited_by_user_id: currentUser.id,
        invited_by_name: currentUser.full_name || currentUser.email,
        created_at: new Date().toISOString(),
        token,
      });
      setInvites(prev => [...prev, invite]);
      showNotification(`Invite created for ${inviteEmail}. Share the BenchTrace app URL with them.`, 'success');
      setInviteEmail('');
      setShowInviteForm(false);
    } catch(e) {
      setInviteError('Failed to create invite. Please try again.');
      showNotification('Failed to create invite. Please try again.', 'error');
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

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const pendingInvites = invites.filter(i => i.status === 'pending');

  return (
    <FeatureGate feature="team_management">
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
              {inviting ? 'Creating invite...' : 'Create Invite'}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #fde68a', fontSize: 18 }}>
                    ✉
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{invite.invited_email}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Invited by {invite.invited_by_name || '—'} · Role: {invite.invited_role}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>PENDING</span>
                  {isAdmin && (
                    <button onClick={() => setConfirmRevokeId(invite.id)} style={{ padding: '5px 12px', background: 'white', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Revoke</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, padding: '14px 16px', background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', marginBottom: 4 }}>How invitations work</div>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
          When you create an invite, share the BenchTrace app URL with your colleague and ask them to sign up. Once they create an account, their membership and role will be active. Full email-based invite delivery is coming in a future update.
        </div>
      </div>
    </div>
    </FeatureGate>
  );
}