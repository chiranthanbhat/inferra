// ============================================
// TEAM MANAGEMENT
// Members (search / filter / pagination / role change / suspend / remove /
// transfer ownership / leave) + Invitations (invite / cancel / resend) +
// "invitations addressed to me" banner. All mutations go through Cloud
// Function callables; the UI gates buttons with the shared permission engine.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Users, UserPlus, Search, Mail, Shield, Clock, MoreHorizontal, Loader2,
  Crown, LogOut, Trash2, PauseCircle, PlayCircle, RefreshCw, X, ChevronLeft,
  ChevronRight, Send, CheckCircle2, XCircle,
} from 'lucide-react';
import { Button, Badge, Input } from '../ui';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../lib/auth';
import { useOrganization } from '../../lib/orgContext';
import { useToast } from '../../lib/toast';
import { DEV_AUTH } from '../../lib/devAuth';
import { listMembers, listOrgInvitations, listMyInvitations } from '../../lib/db';
import {
  inviteMemberServer, acceptInvitationServer, rejectInvitationServer,
  cancelInvitationServer, resendInvitationServer, removeMemberServer,
  changeMemberRoleServer, setMemberStatusServer, leaveOrganizationServer,
  transferOwnershipServer,
} from '../../lib/functions';
import { ROLE_HIERARCHY, roleRank, canChangeRole, canInvite, canManageMembers, canTransferOwnership } from '../../lib/permissions';
import type { Invitation, MemberRole, OrgMember } from '../../types';

const PAGE_SIZE = 8;
type StatusFilter = 'all' | 'active' | 'suspended' | 'pending';
type RoleFilter = 'all' | MemberRole;

const ROLE_BADGE: Record<MemberRole, string> = {
  owner: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
  admin: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
  manager: 'bg-success-500/15 text-success-400 border-success-500/30',
  member: 'bg-white/[0.06] text-ink-2 border-white/15',
  viewer: 'bg-white/[0.04] text-ink-3 border-white/10',
};

export function MembersPanel() {
  const { user } = useStore();
  const { firebaseUser } = useAuth();
  const { currentOrganization, organizationId, organizationRole, refreshMemberships } = useOrganization();
  const toast = useToast();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myInvites, setMyInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'invitations'>('members');

  // filters + pagination
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);

  // action state
  const [busy, setBusy] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, 'owner'>>('member');

  const myUid = user?.id ?? '';
  const myEmail = firebaseUser?.email ?? user?.email ?? '';
  const iCanInvite = canInvite(organizationRole);
  const iCanManage = canManageMembers(organizationRole);

  const load = async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      if (DEV_AUTH) {
        // Dev mode: no Firestore — synthesize the demo owner so the UI is testable.
        setMembers([{ userId: myUid, email: myEmail, name: user?.name ?? 'Demo User', role: 'owner', status: 'active', joinedAt: new Date(), lastActiveAt: new Date() }]);
        setInvitations([]);
        setMyInvites([]);
        return;
      }
      const [m, inv, mine] = await Promise.all([
        listMembers(organizationId),
        iCanInvite ? listOrgInvitations(organizationId).catch(() => []) : Promise.resolve([]),
        myEmail ? listMyInvitations(myEmail).catch(() => []) : Promise.resolve([]),
      ]);
      setMembers(m.sort((a, b) => roleRank(b.role) - roleRank(a.role)));
      setInvitations(inv);
      // Hide invites to orgs I already belong to (e.g. this one, post-accept).
      setMyInvites(mine.filter((i) => i.organizationId !== organizationId || !m.some((mm) => mm.userId === myUid)));
    } catch (e: any) {
      toast({ title: 'Could not load members', description: e?.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [organizationId, organizationRole]);

  /* ---------------- filtering + pagination ---------------- */

  const pendingInvites = useMemo(() => invitations.filter((i) => i.status === 'pending'), [invitations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows: (OrgMember | { invite: Invitation })[] = members
      .filter((m) => roleFilter === 'all' || m.role === roleFilter)
      .filter((m) => statusFilter === 'all' || (statusFilter !== 'pending' && m.status === statusFilter))
      .filter((m) => !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
    // "Pending" status folds pending invitations into the members view.
    if (statusFilter === 'all' || statusFilter === 'pending') {
      const invRows = pendingInvites
        .filter((i) => roleFilter === 'all' || i.role === roleFilter)
        .filter((i) => !q || i.email.toLowerCase().includes(q))
        .map((invite) => ({ invite }));
      rows = statusFilter === 'pending' ? invRows : [...rows, ...invRows];
    }
    return rows;
  }, [members, pendingInvites, search, roleFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [search, roleFilter, statusFilter, tab]);

  /* ---------------- actions ---------------- */

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    setMenuFor(null);
    try {
      await fn();
      toast({ title: okMsg, variant: 'success' });
      await load();
      await refreshMemberships().catch(() => {});
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !organizationId) return;
    await run('invite', () => inviteMemberServer(organizationId, email, inviteRole), `Invitation sent to ${email}`);
    setInviteOpen(false);
    setInviteEmail('');
    setTab('invitations');
  };

  if (!currentOrganization) return null;

  const invitableRoles = (ROLE_HIERARCHY.filter((r) => r !== 'owner' && roleRank(r) < roleRank(organizationRole)) as Exclude<MemberRole, 'owner'>[]).reverse();

  return (
    <div className="space-y-5">
      {/* invitations addressed to ME */}
      {myInvites.map((inv) => (
        <div key={inv.id} className="ring-gradient rounded-xl p-4 bg-gradient-to-br from-brand-500/[0.10] to-accent-500/[0.05] flex items-center gap-3 flex-wrap">
          <Mail size={16} className="text-brand-300 flex-shrink-0" />
          <p className="text-sm text-ink-2 flex-1 min-w-0">
            <span className="text-white font-medium">{inv.invitedByName || inv.invitedByEmail}</span> invited you to{' '}
            <span className="text-white font-medium">{inv.organizationName}</span> as <span className="text-brand-300">{inv.role}</span>.
          </p>
          <div className="flex gap-2">
            <Button size="sm" isLoading={busy === `acc_${inv.id}`}
              onClick={() => run(`acc_${inv.id}`, () => acceptInvitationServer(inv.id), `Joined ${inv.organizationName}`)}>
              <CheckCircle2 size={14} /> Accept
            </Button>
            <Button size="sm" variant="outline" isLoading={busy === `rej_${inv.id}`}
              onClick={() => run(`rej_${inv.id}`, () => rejectInvitationServer(inv.id), 'Invitation declined')}>
              <XCircle size={14} /> Decline
            </Button>
          </div>
        </div>
      ))}

      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users size={18} className="text-brand-300" /> Team
          </h2>
          <p className="text-sm text-ink-3 mt-0.5">
            {members.length} member{members.length === 1 ? '' : 's'} · {pendingInvites.length} pending invite{pendingInvites.length === 1 ? '' : 's'} · your role:{' '}
            <span className="capitalize text-ink-2">{organizationRole ?? '—'}</span>
          </p>
        </div>
        {iCanInvite && (
          <Button onClick={() => setInviteOpen(true)}><UserPlus size={15} /> Invite member</Button>
        )}
      </div>

      {/* tabs + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg glass overflow-hidden text-sm">
          {(['members', 'invitations'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 capitalize transition ${tab === t ? 'bg-brand-500/20 text-brand-200' : 'text-ink-3 hover:text-white'}`}>
              {t}{t === 'invitations' && pendingInvites.length > 0 ? ` (${pendingInvites.length})` : ''}
            </button>
          ))}
        </div>
        {tab === 'members' && (
          <>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members…"
                className="w-full bg-black/30 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-ink-3 focus:outline-none focus:border-brand-500/50" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="bg-black/30 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-ink-2 focus:outline-none focus:border-brand-500/50">
              <option value="all">All roles</option>
              {[...ROLE_HIERARCHY].reverse().map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-black/30 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-ink-2 focus:outline-none focus:border-brand-500/50">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </>
        )}
      </div>

      {/* content */}
      {loading ? (
        <div className="glass-card rounded-2xl p-12 grid place-items-center text-ink-3"><Loader2 size={20} className="animate-spin" /></div>
      ) : tab === 'members' ? (
        <>
          <div className="glass-card rounded-2xl divide-y divide-white/[0.05]">
            {pageRows.length === 0 && (
              <p className="p-8 text-center text-sm text-ink-3">No members match the current filters.</p>
            )}
            {pageRows.map((row) => 'invite' in row ? (
              /* pending invitation rendered inline in the member list */
              <div key={row.invite.id} className="p-4 flex items-center gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-white/[0.04] border border-dashed border-white/15 text-ink-3 flex-shrink-0"><Mail size={15} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-2 truncate">{row.invite.email}</p>
                  <p className="text-[0.7rem] text-ink-3">Invited by {row.invite.invitedByName || row.invite.invitedByEmail}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[0.66rem] font-medium border capitalize ${ROLE_BADGE[row.invite.role]}`}>{row.invite.role}</span>
                <Badge variant="warning" size="sm"><Clock size={11} /> Pending</Badge>
              </div>
            ) : (
              <MemberRow key={row.userId} m={row} myUid={myUid} myRole={organizationRole}
                orgId={organizationId!} busy={busy} menuFor={menuFor} setMenuFor={setMenuFor}
                iCanManage={iCanManage} run={run} />
            ))}
          </div>

          {/* pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-ink-3">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition"><ChevronLeft size={16} /></button>
              <span className="tabular">Page {page + 1} / {pageCount}</span>
              <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      ) : (
        /* invitations tab */
        <div className="glass-card rounded-2xl divide-y divide-white/[0.05]">
          {invitations.length === 0 && (
            <p className="p-8 text-center text-sm text-ink-3">No invitations yet. Invite a teammate to get started.</p>
          )}
          {invitations.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center gap-3 flex-wrap">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 text-ink-3 flex-shrink-0"><Mail size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{inv.email}</p>
                <p className="text-[0.7rem] text-ink-3">
                  {inv.status === 'pending'
                    ? `Expires ${inv.expiresAt.toLocaleDateString()}`
                    : `Updated ${inv.createdAt.toLocaleDateString()}`} · by {inv.invitedByName || inv.invitedByEmail}
                  {inv.resendCount > 0 ? ` · resent ×${inv.resendCount}` : ''}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[0.66rem] font-medium border capitalize ${ROLE_BADGE[inv.role]}`}>{inv.role}</span>
              <Badge size="sm" variant={inv.status === 'pending' ? 'warning' : inv.status === 'accepted' ? 'success' : 'default'}>
                <span className="capitalize">{inv.status}</span>
              </Badge>
              {iCanInvite && (inv.status === 'pending' || inv.status === 'expired') && (
                <div className="flex gap-1.5">
                  <button title="Resend" disabled={busy === `res_${inv.id}`}
                    onClick={() => run(`res_${inv.id}`, () => resendInvitationServer(inv.id), 'Invitation resent')}
                    className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition disabled:opacity-50">
                    {busy === `res_${inv.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  {inv.status === 'pending' && (
                    <button title="Cancel" disabled={busy === `can_${inv.id}`}
                      onClick={() => run(`can_${inv.id}`, () => cancelInvitationServer(inv.id), 'Invitation cancelled')}
                      className="p-2 rounded-lg text-ink-3 hover:text-error-400 hover:bg-white/[0.05] transition disabled:opacity-50">
                      {busy === `can_${inv.id}` ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* invite modal */}
      <AnimatePresence>
        {inviteOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-6"
            onClick={() => setInviteOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2"><UserPlus size={16} className="text-brand-300" /> Invite a member</h3>
                <button onClick={() => setInviteOpen(false)} className="text-ink-3 hover:text-white transition"><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <Input label="Email address" type="email" placeholder="teammate@company.com"
                  value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} icon={<Mail size={16} />} />
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {invitableRoles.map((r) => (
                      <button key={r} onClick={() => setInviteRole(r)}
                        className={`px-3 py-2 rounded-xl border text-sm capitalize text-left transition ${
                          inviteRole === r ? 'border-brand-500/60 bg-brand-500/15 text-brand-200' : 'border-white/[0.08] text-ink-2 hover:border-white/20'
                        }`}>
                        <span className="flex items-center gap-1.5"><Shield size={13} /> {r}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={handleInvite} isLoading={busy === 'invite'} disabled={!inviteEmail.trim()}>
                  <Send size={14} /> Send invitation
                </Button>
                <p className="text-[0.66rem] text-ink-3 text-center">Invitations expire after 7 days. The invitee signs in with this email to accept.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── member row ───────────────────────── */

function MemberRow({ m, myUid, myRole, orgId, busy, menuFor, setMenuFor, iCanManage, run }: {
  m: OrgMember;
  myUid: string;
  myRole: MemberRole | null;
  orgId: string;
  busy: string | null;
  menuFor: string | null;
  setMenuFor: (id: string | null) => void;
  iCanManage: boolean;
  run: (key: string, fn: () => Promise<unknown>, okMsg: string) => Promise<void>;
}) {
  const isMe = m.userId === myUid;
  const suspended = m.status === 'suspended';
  const roleOptions = (ROLE_HIERARCHY.filter((r) => canChangeRole(myRole, m.role, r)) as MemberRole[]).reverse();
  const showMenu = menuFor === m.userId;
  const anyAction = !isMe && iCanManage && m.role !== 'owner' && roleRank(m.role) < roleRank(myRole);
  const iCanTransfer = canTransferOwnership(myRole) && !isMe && m.status === 'active';

  return (
    <div className={`p-4 flex items-center gap-3 relative ${suspended ? 'opacity-60' : ''}`}>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
        {(m.name || m.email || '?').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">
          {m.name || m.email}{isMe && <span className="text-ink-3 font-normal"> (you)</span>}
        </p>
        <p className="text-[0.7rem] text-ink-3 truncate">
          {m.email} · joined {m.joinedAt.toLocaleDateString()}
          {m.lastActiveAt ? ` · active ${m.lastActiveAt.toLocaleDateString()}` : ''}
        </p>
      </div>
      <span className={`px-2 py-0.5 rounded-md text-[0.66rem] font-medium border capitalize inline-flex items-center gap-1 ${ROLE_BADGE[m.role]}`}>
        {m.role === 'owner' && <Crown size={11} />} {m.role}
      </span>
      <Badge size="sm" variant={suspended ? 'danger' : 'success'}>{suspended ? 'Suspended' : 'Active'}</Badge>

      {isMe && m.role !== 'owner' && (
        <button title="Leave organization" disabled={busy === `leave_${m.userId}`}
          onClick={() => run(`leave_${m.userId}`, () => leaveOrganizationServer(orgId), 'You left the organization')}
          className="p-2 rounded-lg text-ink-3 hover:text-error-400 hover:bg-white/[0.05] transition disabled:opacity-50">
          {busy === `leave_${m.userId}` ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
        </button>
      )}

      {(anyAction || iCanTransfer) && (
        <div className="relative">
          <button onClick={() => setMenuFor(showMenu ? null : m.userId)}
            className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition">
            <MoreHorizontal size={15} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 w-52 glass-card rounded-xl p-1.5 border border-white/[0.1] shadow-xl">
              {anyAction && roleOptions.length > 0 && (
                <>
                  <p className="px-2.5 pt-1.5 pb-1 text-[0.62rem] uppercase tracking-wider text-ink-3">Change role</p>
                  {roleOptions.map((r) => (
                    <button key={r} disabled={r === m.role || busy !== null}
                      onClick={() => run(`role_${m.userId}`, () => changeMemberRoleServer(orgId, m.userId, r), `Role changed to ${r}`)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm capitalize transition ${r === m.role ? 'text-brand-300' : 'text-ink-2 hover:bg-white/[0.05] hover:text-white'}`}>
                      {r}
                    </button>
                  ))}
                  <div className="h-px bg-white/[0.06] my-1" />
                </>
              )}
              {iCanTransfer && (
                <button disabled={busy !== null}
                  onClick={() => run(`own_${m.userId}`, () => transferOwnershipServer(orgId, m.userId), `Ownership transferred to ${m.name || m.email}`)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-warning-400 hover:bg-white/[0.05] transition flex items-center gap-2">
                  <Crown size={13} /> Transfer ownership
                </button>
              )}
              {anyAction && (
                <>
                  <button disabled={busy !== null}
                    onClick={() => run(`sus_${m.userId}`, () => setMemberStatusServer(orgId, m.userId, suspended ? 'active' : 'suspended'), suspended ? 'Member reactivated' : 'Member suspended')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-ink-2 hover:bg-white/[0.05] hover:text-white transition flex items-center gap-2">
                    {suspended ? <PlayCircle size={13} /> : <PauseCircle size={13} />} {suspended ? 'Reactivate' : 'Suspend'}
                  </button>
                  <button disabled={busy !== null}
                    onClick={() => run(`rem_${m.userId}`, () => removeMemberServer(orgId, m.userId), 'Member removed')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm text-error-400 hover:bg-white/[0.05] transition flex items-center gap-2">
                    <Trash2 size={13} /> Remove from organization
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
