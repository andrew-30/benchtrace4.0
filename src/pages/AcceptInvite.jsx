import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | valid | invalid | expired | already_member | success | error
  const [invite, setInvite] = useState(null);
  const [org, setOrg] = useState(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    // Check sessionStorage for pending invite (set before login redirect)
    const pendingToken = sessionStorage.getItem('bt_pending_invite');
    if (pendingToken && !token) {
      sessionStorage.removeItem('bt_pending_invite');
      navigate(`/accept-invite?token=${pendingToken}`);
      return;
    }

    const validateToken = async () => {
      if (!token) { setStatus('invalid'); return; }
      try {
        const invites = await base44.entities.OrganizationInvite.filter({ token: token });
        const foundInvite = invites?.[0];

        if (!foundInvite) { setStatus('invalid'); return; }
        if (foundInvite.status === 'revoked') { setStatus('invalid'); return; }
        if (foundInvite.status === 'accepted') { setStatus('already_member'); return; }

        if (foundInvite.created_at) {
          const created = new Date(foundInvite.created_at);
          const now = new Date();
          const diffDays = (now - created) / (1000 * 60 * 60 * 24);
          if (diffDays > 7) { setStatus('expired'); return; }
        }

        const orgs = await base44.entities.Organization.filter({ id: foundInvite.organization_id });
        const foundOrg = orgs?.[0];

        setInvite(foundInvite);
        setOrg(foundOrg);
        setStatus('valid');
      } catch(e) {
        console.error('Token validation failed:', e);
        setStatus('error');
        setError(e.message || 'Failed to validate invite link');
      }
    };
    validateToken();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      let currentUser = null;
      try {
        currentUser = await base44.auth.me();
      } catch(e) {
        // Not logged in — store token and redirect to login
        sessionStorage.setItem('bt_pending_invite', token);
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      if (currentUser.email.toLowerCase() !== invite.invited_email.toLowerCase()) {
        setStatus('error');
        setError(`This invite is for ${invite.invited_email}. You are logged in as ${currentUser.email}. Please log out and sign in with the correct account.`);
        setAccepting(false);
        return;
      }

      const existingMemberships = await base44.entities.OrganizationMembership.filter({
        organization_id: invite.organization_id,
        user_id: currentUser.id,
      });

      if (existingMemberships && existingMemberships.length > 0) {
        localStorage.setItem('bt_org_id', invite.organization_id);
        localStorage.setItem('bt_role', existingMemberships[0].role);
        await base44.entities.OrganizationInvite.update(invite.id, { status: 'accepted', accepted_at: new Date().toISOString() });
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 2000);
        return;
      }

      await base44.entities.OrganizationMembership.create({
        organization_id: invite.organization_id,
        user_id: currentUser.id,
        role: invite.invited_role || 'member',
        joined_at: new Date().toISOString(),
      });

      await base44.entities.OrganizationInvite.update(invite.id, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      });

      await base44.entities.AuditLog.create({
        organization_id: invite.organization_id,
        event_type: 'team_member_joined',
        actor_user_id: currentUser.id,
        actor_email: currentUser.email,
        metadata: { role: invite.invited_role, invited_by: invite.invited_by_name },
        created_at: new Date().toISOString(),
      });

      localStorage.setItem('bt_org_id', invite.organization_id);
      localStorage.setItem('bt_role', invite.invited_role || 'member');

      setStatus('success');
      setTimeout(() => navigate('/dashboard'), 2500);

    } catch(e) {
      console.error('Accept invite failed:', e);
      setError(e.message || 'Failed to accept invite. Please try again.');
      setStatus('error');
    } finally {
      setAccepting(false);
    }
  };

  const containerStyle = {
    minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc, #eef2ff)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: 'system-ui, sans-serif',
  };

  const cardStyle = {
    background: 'white', borderRadius: 16, padding: '40px 36px',
    maxWidth: 460, width: '100%', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
  };

  if (status === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Validating invite link...</div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Invalid Invite Link</div>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            This invite link is invalid or has already been used. Please ask your team admin to send a new invite.
          </div>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '11px 28px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Go to BenchTrace →
          </button>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Invite Link Expired</div>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            This invite link expired after 7 days. Please ask your team admin to send a new invite.
          </div>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '11px 28px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Go to BenchTrace →
          </button>
        </div>
      </div>
    );
  }

  if (status === 'already_member') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Already a Member</div>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>
            This invite has already been accepted. You are already a member of this team.
          </div>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '11px 28px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>Welcome to the team!</div>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 8 }}>
            You've successfully joined <strong>{org?.name || 'the team'}</strong> on BenchTrace.
          </div>
          <div style={{ fontSize: 13, color: '#6366f1', fontWeight: 600 }}>Redirecting to your dashboard...</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24 }}>{error}</div>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '11px 28px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Go to BenchTrace →
          </button>
        </div>
      </div>
    );
  }

  // status === 'valid'
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>BenchTrace</div>
          <div style={{ width: 40, height: 2, background: '#6366f1', margin: '0 auto' }} />
        </div>

        <div style={{ fontSize: 40, marginBottom: 16 }}>🧪</div>

        <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>
          You've been invited!
        </div>

        <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 28 }}>
          <strong>{invite?.invited_by_name || 'Your team admin'}</strong> has invited you to join
          <br />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{org?.name || 'their team'}</span>
          <br />
          on BenchTrace as a <strong>{invite?.invited_role === 'admin' ? 'Team Admin' : 'Team Member'}</strong>.
        </div>

        <div style={{ padding: '14px 16px', background: invite?.invited_role === 'admin' ? '#eef2ff' : '#f0fdf4', border: `1px solid ${invite?.invited_role === 'admin' ? '#c7d2fe' : '#bbf7d0'}`, borderRadius: 10, marginBottom: 28, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: invite?.invited_role === 'admin' ? '#4338ca' : '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {invite?.invited_role === 'admin' ? '⚡ Admin Role' : '✓ Member Role'}
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
            {invite?.invited_role === 'admin'
              ? 'Full access: manage protocols, team members, settings, and all compliance features.'
              : 'Execute runs, record measurements, log deviations, and view compliance data.'
            }
          </div>
        </div>

        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 24, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
          ⚠ You must sign in or sign up using <strong>{invite?.invited_email}</strong> to accept this invite.
        </div>

        <button
          onClick={handleAccept}
          disabled={accepting}
          style={{
            width: '100%', padding: '14px',
            background: accepting ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 800, cursor: accepting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            marginBottom: 12,
          }}
        >
          {accepting ? 'Joining team...' : 'Accept Invite & Join Team →'}
        </button>

        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          This invite expires in 7 days · BenchTrace Lab Compliance Platform
        </div>
      </div>
    </div>
  );
}