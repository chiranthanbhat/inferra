// ============================================
// TEAM WORKSPACE (slide-over)
// A team is its own workspace. Tabs: Overview (dashboard metrics), Members
// (bulk add/remove/move/role + invite), Activity (feed), AI Requests (recent
// metered requests), Usage (aggregated from usage records + charts), Files
// (future-ready), Settings (identity/icon/color/defaults/providers/policies/
// limits/notifications + transfer + archive/delete). Design language unchanged;
// all mutations go through Cloud Function callables and are permission-gated.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Users, Settings2, Activity, Crown, Loader2, Plus, Cpu,
  LayoutDashboard, MessageSquare, BarChart3, FileText, Mail, Zap, Clock,
  TrendingDown, Coins, Archive, ArchiveRestore, Trash2, Palette, AlertTriangle,
  Code, Server, Database, Brain, Megaphone, TrendingUp, DollarSign,
  Headphones, Scale, PenTool, Settings as SettingsIcon, Shield, Rocket, Globe, Briefcase,
} from 'lucide-react';
import { Button, Badge, ConfirmDialog } from '../ui';
import { useOrganization } from '../../lib/orgContext';
import { useToast } from '../../lib/toast';
import { DEV_AUTH } from '../../lib/devAuth';
import { hasPermission, roleAtLeast } from '../../lib/permissions';
import { RESOURCES, TEAM_COLORS, TEAM_ICONS } from '../../lib/resources';
import { AI_MODELS } from '../../lib/models';
import { PROVIDER_META } from '../../lib/providers';
import { formatCurrency, formatNumber } from '../../lib/utils';
import { listTeamMembers, getTeamPermissions, getTeamSettings, listTeamActivity, listCustomPermissions } from '../../lib/db';
import {
  updateTeamServer, transferTeamManagerServer, addTeamMembersServer, removeTeamMembersServer,
  setTeamMemberRoleServer, moveTeamMembersServer, setTeamPermissionsServer, updateTeamSettingsServer,
  archiveTeamServer, deleteTeamServer, inviteMemberServer,
} from '../../lib/functions';
import { useStore } from '../../store/useStore';
import type {
  Team, TeamMember, TeamPermissions, TeamSettings, TeamActivity as TActivity,
  OrgMember, CustomPermission, ResourceKey, UsageRecord, Invitation, AIProvider,
} from '../../types';

const ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  code: Code, server: Server, database: Database, brain: Brain, megaphone: Megaphone,
  'trending-up': TrendingUp, 'dollar-sign': DollarSign, users: Users, headphones: Headphones,
  scale: Scale, 'pen-tool': PenTool, settings: SettingsIcon, shield: Shield,
  rocket: Rocket, globe: Globe, briefcase: Briefcase,
};

export function TeamIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Cmp = ICONS[icon] ?? Users;
  return <Cmp size={size} />;
}

const PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'google', 'xai', 'deepseek', 'mistral', 'openrouter'];

type Tab = 'overview' | 'members' | 'activity' | 'requests' | 'usage' | 'files' | 'settings';

const TABS: [Tab, React.ComponentType<{ size?: number | string }>, string][] = [
  ['overview', LayoutDashboard, 'Overview'],
  ['members', Users, 'Members'],
  ['activity', Activity, 'Activity'],
  ['requests', MessageSquare, 'AI Requests'],
  ['usage', BarChart3, 'Usage'],
  ['files', FileText, 'Files'],
  ['settings', Settings2, 'Settings'],
];

/** Format a machine event key ("team.requestExecuted") into readable text. */
function humanizeEvent(eventType: string): string {
  return eventType.replace('team.', '').replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

const isSameMonth = (d: Date, now = new Date()) =>
  d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();

export function TeamDetail({ team, orgMembers, allTeams, usageRecords = [], pendingInvites = [], onClose, onChanged }: {
  team: Team;
  orgMembers: OrgMember[];
  allTeams: Team[];
  usageRecords?: UsageRecord[];
  pendingInvites?: Invitation[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const user = useStore((s) => s.user);
  const { organizationId, organizationRole } = useOrganization();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('overview');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [perms, setPerms] = useState<TeamPermissions | null>(null);
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [activity, setActivity] = useState<TActivity[]>([]);
  const [customPerms, setCustomPerms] = useState<CustomPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviteEmail, setInviteEmail] = useState('');

  const isOrgAdmin = roleAtLeast(organizationRole, 'admin');
  const isTeamManager = team.managerId === user?.id;
  const canManageTeam = hasPermission(organizationRole, 'teams.manage') || isTeamManager;

  const load = async () => {
    setLoading(true);
    try {
      if (DEV_AUTH) {
        setMembers([{ id: `${team.id}_${user?.id}`, teamId: team.id, organizationId: team.organizationId, userId: user?.id ?? '', email: user?.email ?? '', name: user?.name ?? 'Demo User', teamRole: 'manager', addedBy: '', addedAt: new Date() }]);
        setPerms({ teamId: team.id, organizationId: team.organizationId, grants: { dashboard: true, analytics: true, commandCenter: true, chat: true, routing: true, optimization: true }, customGrants: [] });
        setSettings({ teamId: team.id, organizationId: team.organizationId, defaultPriority: 'balanced' });
        setActivity([]);
        setCustomPerms([]);
        return;
      }
      const [m, p, s, a, cp] = await Promise.all([
        listTeamMembers(team.id),
        getTeamPermissions(team.id),
        getTeamSettings(team.id),
        listTeamActivity({ teamId: team.id }, 40).catch(() => []),
        listCustomPermissions(team.organizationId).catch(() => []),
      ]);
      setMembers(m.sort((a2, b) => (a2.teamRole === 'manager' ? -1 : 1) - (b.teamRole === 'manager' ? -1 : 1)));
      setPerms(p);
      setSettings(s);
      setActivity(a);
      setCustomPerms(cp);
    } catch (e: any) {
      toast({ title: 'Could not load team', description: e?.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); setSelected(new Set()); }, [team.id]);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string, opts?: { closeAfter?: boolean }) => {
    if (DEV_AUTH) { toast({ title: 'Demo mode', description: 'Team mutations need the deployed backend.', variant: 'info' }); return; }
    setBusy(key);
    try {
      await fn();
      toast({ title: okMsg, variant: 'success' });
      await onChanged();
      if (opts?.closeAfter) { onClose(); return; }
      await load();
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // ── Usage attribution: records tagged with this team, plus untagged records
  // authored by a current member (pre-attribution history). ──
  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const memberName = (uid: string) => members.find((m) => m.userId === uid)?.name || members.find((m) => m.userId === uid)?.email || 'Unknown';
  const teamRecords = useMemo(
    () => usageRecords.filter((r) => r.teamId === team.id || (!r.teamId && memberIds.has(r.userId))),
    [usageRecords, team.id, memberIds],
  );
  const monthRecords = useMemo(() => teamRecords.filter((r) => isSameMonth(r.createdAt)), [teamRecords]);
  const teamInvites = pendingInvites.filter((i) => i.teamId === team.id && i.status === 'pending');
  const manager = orgMembers.find((m) => m.userId === team.managerId);
  const lastActive = teamRecords.length > 0 ? teamRecords.reduce((max, r) => (r.createdAt > max ? r.createdAt : max), teamRecords[0].createdAt) : null;

  const nonMembers = useMemo(
    () => orgMembers.filter((m) => m.status === 'active' && !members.some((tm) => tm.userId === m.userId)),
    [orgMembers, members],
  );
  const otherTeams = allTeams.filter((t) => t.id !== team.id);
  const toggleSelect = (uid: string) => setSelected((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const selectedIds = [...selected];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <motion.div initial={{ x: 560 }} animate={{ x: 0 }} exit={{ x: 560 }} transition={{ type: 'tween', duration: 0.25 }}
        className="w-full max-w-2xl h-full bg-bg border-l border-white/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="p-5 border-b border-white/[0.07] flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl border flex-shrink-0"
            style={{ background: `${team.color}1a`, borderColor: `${team.color}40`, color: team.color }}>
            <TeamIcon icon={team.icon} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white truncate">{team.name}</h2>
              {team.status === 'archived' && <Badge size="sm" variant="warning">Archived</Badge>}
            </div>
            <p className="text-xs text-ink-3 truncate">{team.description || 'No description'} · {members.length} member{members.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition"><X size={16} /></button>
        </div>

        {/* tabs */}
        <div className="px-5 pt-3 flex gap-1 border-b border-white/[0.07] overflow-x-auto hide-scrollbar">
          {TABS.map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm rounded-t-lg transition inline-flex items-center gap-1.5 whitespace-nowrap ${tab === t ? 'text-brand-200 border-b-2 border-brand-400' : 'text-ink-3 hover:text-white'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid place-items-center py-16 text-ink-3"><Loader2 size={20} className="animate-spin" /></div>
          ) : tab === 'overview' ? (
            <OverviewTab
              team={team} manager={manager?.name || manager?.email || '—'} memberCount={members.length}
              monthRecords={monthRecords} lastActive={lastActive} pendingInvites={teamInvites.length}
              activity={activity} settings={settings}
            />
          ) : tab === 'members' ? (
            <MembersTab
              team={team} members={members} nonMembers={nonMembers} otherTeams={otherTeams}
              canManageTeam={canManageTeam} busy={busy} selected={selected} selectedIds={selectedIds}
              toggleSelect={toggleSelect} run={run} organizationId={organizationId!}
              inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
            />
          ) : tab === 'activity' ? (
            <ActivityTab activity={activity} />
          ) : tab === 'requests' ? (
            <RequestsTab records={teamRecords} memberName={memberName} />
          ) : tab === 'usage' ? (
            <UsageTab records={teamRecords} memberName={memberName} />
          ) : tab === 'files' ? (
            <FilesTab />
          ) : (
            <SettingsTab
              team={team} settings={settings} members={members} perms={perms} customPerms={customPerms}
              isOrgAdmin={isOrgAdmin} canManage={canManageTeam} busy={busy} run={run} organizationId={organizationId!}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function OverviewTab({ team, manager, memberCount, monthRecords, lastActive, pendingInvites, activity, settings }: {
  team: Team; manager: string; memberCount: number; monthRecords: UsageRecord[];
  lastActive: Date | null; pendingInvites: number; activity: TActivity[]; settings: TeamSettings | null;
}) {
  const requests = monthRecords.length;
  const tokens = monthRecords.reduce((s, r) => s + (r.optimizedTokens || 0), 0);
  const cost = monthRecords.reduce((s, r) => s + r.cost, 0);
  const savings = monthRecords.reduce((s, r) => s + r.savings, 0);
  const budget = settings?.monthlyBudget;

  return (
    <div className="space-y-5">
      {/* identity */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{team.name}</p>
            <p className="text-xs text-ink-3 mt-0.5">{team.description || 'No description'}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2 flex-shrink-0"><Crown size={13} className="text-warning-400" /> {manager}</span>
        </div>
      </div>

      {/* this-month metrics */}
      <div>
        <p className="eyebrow mb-2">This month</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric icon={<Zap size={14} className="text-brand-300" />} label="Requests" value={formatNumber(requests)} />
          <Metric icon={<Sparkle />} label="Tokens" value={formatNumber(tokens)} />
          <Metric icon={<Coins size={14} className="text-brand-300" />} label="Cost" value={formatCurrency(cost, 2)} />
          <Metric icon={<TrendingDown size={14} className="text-success-400" />} label="Savings" value={formatCurrency(savings, 2)} accent />
        </div>
      </div>

      {/* summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric icon={<Users size={14} className="text-accent-400" />} label="Members" value={String(memberCount)} />
        <Metric icon={<Mail size={14} className="text-warning-400" />} label="Pending invites" value={String(pendingInvites)} />
        <Metric icon={<Clock size={14} className="text-ink-3" />} label="Last active" value={lastActive ? lastActive.toLocaleDateString() : '—'} small />
        <Metric icon={<Coins size={14} className="text-ink-3" />} label="Monthly budget" value={budget ? formatCurrency(budget, 0) : 'None'} small />
      </div>

      {/* recent activity */}
      <div>
        <p className="eyebrow mb-2">Recent activity</p>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-3 glass-card rounded-xl p-4 text-center">No activity recorded yet.</p>
        ) : (
          <div className="glass-card rounded-xl divide-y divide-white/[0.05]">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="p-3 flex items-center gap-2.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                <span className="text-ink-2 truncate"><span className="text-white">{a.actorName}</span> · {humanizeEvent(a.eventType)}</span>
                <span className="ml-auto text-ink-3 flex-shrink-0">{a.createdAt.toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkle() {
  return <TrendingUp size={14} className="text-accent-400" />;
}

function Metric({ icon, label, value, accent, small }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="glass-card rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-[0.66rem] text-ink-3">{icon}{label}</div>
      <p className={`font-bold tabular mt-0.5 ${small ? 'text-sm' : 'text-xl'} ${accent ? 'text-success-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

/* ───────────────────────── Members ───────────────────────── */

function MembersTab({ team, members, nonMembers, otherTeams, canManageTeam, busy, selected, selectedIds, toggleSelect, run, organizationId, inviteEmail, setInviteEmail }: {
  team: Team; members: TeamMember[]; nonMembers: OrgMember[]; otherTeams: Team[];
  canManageTeam: boolean; busy: string | null; selected: Set<string>; selectedIds: string[];
  toggleSelect: (uid: string) => void;
  run: (key: string, fn: () => Promise<unknown>, okMsg: string) => Promise<void>;
  organizationId: string; inviteEmail: string; setInviteEmail: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {canManageTeam && selectedIds.length > 0 && (
        <div className="glass-card rounded-xl p-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-ink-2">{selectedIds.length} selected</span>
          <select id="bulkRole" defaultValue=""
            onChange={(e) => { if (e.target.value) void run('bulkRole', () => setTeamMemberRoleServer(organizationId, team.id, selectedIds, e.target.value as 'member' | 'viewer'), 'Roles updated'); }}
            className="bg-black/30 border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-ink-2">
            <option value="" disabled>Set role…</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </select>
          {otherTeams.length > 0 && (
            <select defaultValue=""
              onChange={(e) => { if (e.target.value) void run('bulkMove', () => moveTeamMembersServer(organizationId, team.id, e.target.value, selectedIds), 'Members moved'); }}
              className="bg-black/30 border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-ink-2">
              <option value="" disabled>Move to…</option>
              {otherTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <button disabled={busy !== null}
            onClick={() => run('bulkRemove', () => removeTeamMembersServer(organizationId, team.id, selectedIds), 'Members removed')}
            className="ml-auto text-xs text-error-400 hover:text-error-300 transition disabled:opacity-50">
            {busy === 'bulkRemove' ? 'Removing…' : 'Remove from team'}
          </button>
        </div>
      )}

      <div className="glass-card rounded-xl divide-y divide-white/[0.05]">
        {members.map((m) => (
          <div key={m.id} className="p-3 flex items-center gap-3">
            {canManageTeam && m.teamRole !== 'manager' && (
              <input type="checkbox" checked={selected.has(m.userId)} onChange={() => toggleSelect(m.userId)}
                className="w-4 h-4 rounded border-white/15 bg-navy-800" />
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-600 grid place-items-center text-white text-xs font-semibold flex-shrink-0">
              {(m.name || m.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{m.name || m.email}</p>
              <p className="text-[0.7rem] text-ink-3 truncate">{m.email}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[0.66rem] font-medium border capitalize inline-flex items-center gap-1 ${
              m.teamRole === 'manager' ? 'bg-warning-500/15 text-warning-400 border-warning-500/30' : 'bg-white/[0.06] text-ink-2 border-white/15'
            }`}>
              {m.teamRole === 'manager' && <Crown size={10} />} {m.teamRole}
            </span>
          </div>
        ))}
        {members.length === 0 && <p className="p-6 text-center text-sm text-ink-3">No members yet.</p>}
      </div>

      {canManageTeam && nonMembers.length > 0 && team.status === 'active' && (
        <div>
          <p className="text-xs font-medium text-ink-2 mb-2">Add organization members</p>
          <div className="flex gap-2 flex-wrap">
            {nonMembers.slice(0, 12).map((m) => (
              <button key={m.userId} disabled={busy !== null}
                onClick={() => run(`add_${m.userId}`, () => addTeamMembersServer(organizationId, team.id, [m.userId]), `${m.name || m.email} added`)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-ink-2 hover:text-white hover:border-brand-500/40 transition disabled:opacity-50">
                {busy === `add_${m.userId}` ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} {m.name || m.email}
              </button>
            ))}
          </div>
        </div>
      )}

      {canManageTeam && team.status === 'active' && (
        <div>
          <p className="text-xs font-medium text-ink-2 mb-2">Invite by email to this team</p>
          <div className="flex gap-2">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com" type="email"
              className="flex-1 bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-ink-3 focus:outline-none focus:border-brand-500/50" />
            <Button size="sm" isLoading={busy === 'inviteEmail'} disabled={!inviteEmail.trim()}
              onClick={() => run('inviteEmail',
                () => inviteMemberServer(organizationId, inviteEmail.trim(), 'member', { teamId: team.id }).then(() => setInviteEmail('')),
                `Invitation sent to ${inviteEmail.trim()}`)}>
              Invite
            </Button>
          </div>
          <p className="text-[0.66rem] text-ink-3 mt-1.5">They'll join the organization and this team automatically when they accept.</p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Activity ───────────────────────── */

function ActivityTab({ activity }: { activity: TActivity[] }) {
  return (
    <div className="space-y-2.5">
      {activity.length === 0 && <p className="text-sm text-ink-3 text-center py-8">No activity recorded yet.</p>}
      {activity.map((a) => (
        <div key={a.id} className="flex items-start gap-2.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-1.5" />
          <div className="min-w-0">
            <p className="text-ink-2"><span className="text-white">{a.actorName}</span> · {humanizeEvent(a.eventType)}</p>
            <p className="text-ink-3">{a.createdAt.toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── AI Requests ───────────────────────── */

function RequestsTab({ records, memberName }: { records: UsageRecord[]; memberName: (uid: string) => string }) {
  if (records.length === 0) {
    return (
      <div className="glass-card rounded-xl p-10 text-center">
        <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] text-ink-3 mb-3"><MessageSquare size={20} /></span>
        <p className="text-sm text-white font-medium">No requests attributed yet</p>
        <p className="text-xs text-ink-3 mt-1">Requests run from the Command Center with this team selected will appear here.</p>
      </div>
    );
  }
  return (
    <div className="glass-card rounded-xl divide-y divide-white/[0.05]">
      {records.slice(0, 40).map((r) => (
        <div key={r.id} className="p-3 flex items-center gap-3">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-500/12 border border-brand-500/25 text-brand-300 flex-shrink-0"><Cpu size={14} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{r.routedModel}</p>
            <p className="text-[0.7rem] text-ink-3 truncate">{memberName(r.userId)} · {r.createdAt.toLocaleString()}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-white tabular">{formatCurrency(r.cost, 4)}</p>
            <p className="text-[0.66rem] text-success-400 tabular">−{formatCurrency(r.savings, 4)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Usage (aggregation + bar charts) ───────────────────────── */

function UsageTab({ records, memberName }: { records: UsageRecord[]; memberName: (uid: string) => string }) {
  const totals = useMemo(() => {
    const tokens = records.reduce((s, r) => s + (r.optimizedTokens || 0), 0);
    const cost = records.reduce((s, r) => s + r.cost, 0);
    const savings = records.reduce((s, r) => s + r.savings, 0);
    const latency = records.length ? records.reduce((s, r) => s + r.latencyMs, 0) / records.length : 0;
    return { requests: records.length, tokens, cost, savings, latency };
  }, [records]);

  const byModel = useMemo(() => topCounts(records.map((r) => r.routedModel)), [records]);
  const byMember = useMemo(() => topCounts(records.map((r) => memberName(r.userId))), [records, memberName]);

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-xl p-10 text-center">
        <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] text-ink-3 mb-3"><BarChart3 size={20} /></span>
        <p className="text-sm text-white font-medium">No usage yet</p>
        <p className="text-xs text-ink-3 mt-1">Usage aggregates automatically from this team's metered requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric icon={<Zap size={14} className="text-brand-300" />} label="Requests" value={formatNumber(totals.requests)} />
        <Metric icon={<TrendingUp size={14} className="text-accent-400" />} label="Tokens" value={formatNumber(totals.tokens)} />
        <Metric icon={<Coins size={14} className="text-brand-300" />} label="Cost" value={formatCurrency(totals.cost, 2)} />
        <Metric icon={<TrendingDown size={14} className="text-success-400" />} label="Savings" value={formatCurrency(totals.savings, 2)} accent />
      </div>
      <div className="glass-card rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm text-ink-2 flex items-center gap-2"><Clock size={14} className="text-ink-3" /> Average latency</span>
        <span className="text-sm font-semibold text-white tabular">{Math.round(totals.latency)} ms</span>
      </div>

      <BarList title="Most used models" rows={byModel} tone="#4DEEEA" />
      <BarList title="Most active members" rows={byMember} tone="#34D399" />
    </div>
  );
}

function topCounts(values: string[], max = 5): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, max);
}

function BarList({ title, rows, tone }: { title: string; rows: { label: string; count: number }[]; tone: string }) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <div className="glass-card rounded-xl p-4 space-y-2.5">
        {rows.length === 0 && <p className="text-xs text-ink-3">No data.</p>}
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-ink-2 truncate">{r.label}</span>
              <span className="text-ink-3 tabular flex-shrink-0 ml-2">{r.count}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.count / maxCount) * 100}%`, background: tone }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Files (future-ready) ───────────────────────── */

function FilesTab() {
  return (
    <div className="glass-card rounded-xl p-10 text-center">
      <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] text-ink-3 mb-3"><FileText size={20} /></span>
      <p className="text-sm text-white font-medium">Team files are coming soon</p>
      <p className="text-xs text-ink-3 mt-1 max-w-sm mx-auto">
        Shared prompt libraries, exports and documents will live here — scoped to this team's members and permissions.
      </p>
      <Badge size="sm" variant="default" className="mt-3">Planned</Badge>
    </div>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

function SettingsTab({ team, settings, members, perms, customPerms, isOrgAdmin, canManage, busy, run, organizationId }: {
  team: Team; settings: TeamSettings | null; members: TeamMember[];
  perms: TeamPermissions | null; customPerms: CustomPermission[];
  isOrgAdmin: boolean; canManage: boolean; busy: string | null;
  run: (key: string, fn: () => Promise<unknown>, okMsg: string, opts?: { closeAfter?: boolean }) => Promise<void>;
  organizationId: string;
}) {
  if (!canManage) return <p className="text-sm text-ink-3">Only the team manager or organization managers can edit team settings.</p>;

  return (
    <div className="space-y-6">
      <IdentitySection team={team} busy={busy} run={run} organizationId={organizationId} />
      <DefaultsSection team={team} settings={settings} busy={busy} run={run} organizationId={organizationId} />
      <ProvidersPoliciesSection team={team} settings={settings} busy={busy} run={run} organizationId={organizationId} />
      <LimitsNotificationsSection team={team} settings={settings} busy={busy} run={run} organizationId={organizationId} />
      <PermissionsSection team={team} perms={perms} customPerms={customPerms} isOrgAdmin={isOrgAdmin} busy={busy} run={run} organizationId={organizationId} />
      <TransferSection team={team} members={members} busy={busy} run={run} organizationId={organizationId} />
      <DangerSection team={team} busy={busy} run={run} organizationId={organizationId} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-ink-2">{title}</p>
      {children}
    </div>
  );
}

const field = 'w-full bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/50';

function IdentitySection({ team, busy, run, organizationId }: SectionProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [color, setColor] = useState(team.color);
  const [icon, setIcon] = useState(team.icon);
  useEffect(() => { setName(team.name); setDescription(team.description); setColor(team.color); setIcon(team.icon); }, [team]);

  return (
    <Section title="Identity">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" className={field} />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className={field} />
      <div>
        <label className="block text-xs text-ink-3 mb-2 flex items-center gap-1.5"><Palette size={12} /> Color</label>
        <div className="flex gap-2 flex-wrap">
          {TEAM_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-lg border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs text-ink-3 mb-2">Icon</label>
        <div className="grid grid-cols-8 gap-1.5">
          {TEAM_ICONS.map((key) => (
            <button key={key} onClick={() => setIcon(key)}
              className={`grid place-items-center h-9 rounded-lg border transition ${icon === key ? 'border-brand-500/60 bg-brand-500/15 text-brand-200' : 'border-white/[0.08] text-ink-3 hover:text-white'}`}>
              <TeamIcon icon={key} size={15} />
            </button>
          ))}
        </div>
      </div>
      <Button size="sm" isLoading={busy === 'identity'} disabled={!name.trim()}
        onClick={() => run('identity', () => updateTeamServer(organizationId, team.id, { name: name.trim(), description: description.trim(), color, icon }), 'Team updated')}>
        Save identity
      </Button>
    </Section>
  );
}

function DefaultsSection({ team, settings, busy, run, organizationId }: SectionProps) {
  const [priority, setPriority] = useState(settings?.defaultPriority ?? 'balanced');
  const [model, setModel] = useState(settings?.defaultModel ?? '');
  useEffect(() => { setPriority(settings?.defaultPriority ?? 'balanced'); setModel(settings?.defaultModel ?? ''); }, [settings]);

  return (
    <Section title="AI defaults">
      <label className="block text-xs text-ink-3">Default routing strategy</label>
      <div className="grid grid-cols-4 gap-2">
        {(['cost', 'speed', 'quality', 'balanced'] as const).map((p) => (
          <button key={p} onClick={() => setPriority(p)}
            className={`px-2 py-2 rounded-lg border text-xs capitalize transition ${priority === p ? 'border-brand-500/60 bg-brand-500/15 text-brand-200' : 'border-white/[0.08] text-ink-3 hover:text-white'}`}>
            {p}
          </button>
        ))}
      </div>
      <label className="block text-xs text-ink-3 mt-2">Default model</label>
      <select value={model} onChange={(e) => setModel(e.target.value)} className={field}>
        <option value="">Auto-select (recommended)</option>
        {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
      </select>
      <Button size="sm" isLoading={busy === 'defaults'}
        onClick={() => run('defaults', () => updateTeamSettingsServer(organizationId, team.id, { defaultPriority: priority, defaultModel: model }), 'Defaults saved')}>
        Save defaults
      </Button>
    </Section>
  );
}

function ProvidersPoliciesSection({ team, settings, busy, run, organizationId }: SectionProps) {
  const [providers, setProviders] = useState<Record<string, boolean>>(() => Object.fromEntries(PROVIDERS.map((p) => [p, settings?.allowedProviders?.[p] !== false])));
  const [pii, setPii] = useState(settings?.piiPolicy ?? 'sanitize');
  const [secret, setSecret] = useState(settings?.secretPolicy ?? 'block');
  useEffect(() => {
    setProviders(Object.fromEntries(PROVIDERS.map((p) => [p, settings?.allowedProviders?.[p] !== false])));
    setPii(settings?.piiPolicy ?? 'sanitize');
    setSecret(settings?.secretPolicy ?? 'block');
  }, [settings]);

  return (
    <Section title="Providers & prompt policies">
      <label className="block text-xs text-ink-3">Allowed providers</label>
      <div className="flex flex-wrap gap-2">
        {PROVIDERS.map((p) => (
          <button key={p} onClick={() => setProviders((s) => ({ ...s, [p]: !s[p] }))}
            className={`px-2.5 py-1.5 rounded-lg border text-xs transition ${providers[p] ? 'border-brand-500/50 bg-brand-500/15 text-brand-200' : 'border-white/[0.08] text-ink-3 hover:text-white'}`}>
            {PROVIDER_META[p].label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div>
          <label className="block text-xs text-ink-3 mb-1">PII policy</label>
          <select value={pii} onChange={(e) => setPii(e.target.value as 'block' | 'sanitize' | 'warn' | 'allow')} className={field}>
            {['block', 'sanitize', 'warn', 'allow'].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-3 mb-1">Secret policy</label>
          <select value={secret} onChange={(e) => setSecret(e.target.value as 'block' | 'warn' | 'allow')} className={field}>
            {['block', 'warn', 'allow'].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <Button size="sm" isLoading={busy === 'providers'}
        onClick={() => run('providers', () => updateTeamSettingsServer(organizationId, team.id, { allowedProviders: providers, piiPolicy: pii, secretPolicy: secret }), 'Policies saved')}>
        Save policies
      </Button>
    </Section>
  );
}

function LimitsNotificationsSection({ team, settings, busy, run, organizationId }: SectionProps) {
  const [budget, setBudget] = useState(settings?.monthlyBudget?.toString() ?? '');
  const [reqLimit, setReqLimit] = useState(settings?.monthlyRequestLimit?.toString() ?? '');
  const [notifyUsage, setNotifyUsage] = useState(settings?.notifyUsageThreshold ?? true);
  const [notifyMembers, setNotifyMembers] = useState(settings?.notifyMemberChanges ?? true);
  useEffect(() => {
    setBudget(settings?.monthlyBudget?.toString() ?? '');
    setReqLimit(settings?.monthlyRequestLimit?.toString() ?? '');
    setNotifyUsage(settings?.notifyUsageThreshold ?? true);
    setNotifyMembers(settings?.notifyMemberChanges ?? true);
  }, [settings]);

  return (
    <Section title="Usage limits & notifications">
      <div className="grid grid-cols-2 gap-3">
        <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Monthly budget (USD)" className={field} />
        <input value={reqLimit} onChange={(e) => setReqLimit(e.target.value.replace(/[^\d]/g, ''))} placeholder="Monthly request cap" className={field} />
      </div>
      <Toggle label="Notify manager on usage thresholds" checked={notifyUsage} onChange={setNotifyUsage} />
      <Toggle label="Notify manager on member changes" checked={notifyMembers} onChange={setNotifyMembers} />
      <Button size="sm" isLoading={busy === 'limits'}
        onClick={() => run('limits', () => updateTeamSettingsServer(organizationId, team.id, {
          monthlyBudget: budget ? Number(budget) : 0,
          monthlyRequestLimit: reqLimit ? Number(reqLimit) : 0,
          notifyUsageThreshold: notifyUsage,
          notifyMemberChanges: notifyMembers,
        }), 'Limits saved')}>
        Save limits & notifications
      </Button>
    </Section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 glass-card rounded-xl p-3 cursor-pointer">
      <span className="text-sm text-ink-2">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition flex-shrink-0 ${checked ? 'bg-brand-500' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );
}

function PermissionsSection({ team, perms, customPerms, isOrgAdmin, busy, run, organizationId }: {
  team: Team; perms: TeamPermissions | null; customPerms: CustomPermission[]; isOrgAdmin: boolean;
  busy: string | null; run: SectionProps['run']; organizationId: string;
}) {
  const [grants, setGrants] = useState<Partial<Record<ResourceKey, boolean>>>(perms?.grants ?? {});
  const [custom, setCustom] = useState<string[]>(perms?.customGrants ?? []);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setGrants(perms?.grants ?? {}); setCustom(perms?.customGrants ?? []); setDirty(false); }, [perms]);

  const toggle = (key: ResourceKey) => { if (!isOrgAdmin) return; setGrants((g) => ({ ...g, [key]: !g[key] })); setDirty(true); };
  const toggleCustom = (id: string) => { if (!isOrgAdmin) return; setCustom((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])); setDirty(true); };

  return (
    <Section title="Team permissions">
      {!isOrgAdmin && (
        <p className="text-xs text-ink-3 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
          Only organization admins and owners can change which surfaces this team can reach. You're viewing the current grants.
        </p>
      )}
      <div className="glass-card rounded-xl divide-y divide-white/[0.05]">
        {RESOURCES.map((r) => (
          <label key={r.key} className={`p-3 flex items-center gap-3 ${isOrgAdmin && !r.universal ? 'cursor-pointer' : ''}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white">{r.label}{r.universal && <span className="ml-2 text-[0.62rem] text-ink-3">(always visible)</span>}</p>
              <p className="text-[0.7rem] text-ink-3">{r.description}</p>
            </div>
            <input type="checkbox" disabled={!isOrgAdmin || r.universal}
              checked={r.universal || grants[r.key] === true} onChange={() => toggle(r.key)}
              className="w-4 h-4 rounded border-white/15 bg-navy-800 accent-[#4DEEEA]" />
          </label>
        ))}
      </div>
      {customPerms.length > 0 && (
        <div className="glass-card rounded-xl divide-y divide-white/[0.05]">
          {customPerms.map((cp) => (
            <label key={cp.id} className={`p-3 flex items-center gap-3 ${isOrgAdmin ? 'cursor-pointer' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{cp.name}</p>
                {cp.description && <p className="text-[0.7rem] text-ink-3">{cp.description}</p>}
              </div>
              <input type="checkbox" disabled={!isOrgAdmin} checked={custom.includes(cp.id)} onChange={() => toggleCustom(cp.id)}
                className="w-4 h-4 rounded border-white/15 bg-navy-800 accent-[#4DEEEA]" />
            </label>
          ))}
        </div>
      )}
      {isOrgAdmin && (
        <Button size="sm" isLoading={busy === 'perms'} disabled={!dirty}
          onClick={() => run('perms', () => setTeamPermissionsServer(organizationId, team.id, grants as Record<string, boolean>, custom), 'Permissions saved')}>
          Save permissions
        </Button>
      )}
    </Section>
  );
}

function TransferSection({ team, members, busy, run, organizationId }: SectionProps & { members: TeamMember[] }) {
  const [newManager, setNewManager] = useState('');
  return (
    <Section title="Transfer team management">
      <div className="flex gap-2">
        <select value={newManager} onChange={(e) => setNewManager(e.target.value)} className={field}>
          <option value="">Choose a member…</option>
          {members.filter((m) => m.userId !== team.managerId).map((m) => (
            <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={!newManager} isLoading={busy === 'transfer'}
          onClick={() => run('transfer', () => transferTeamManagerServer(organizationId, team.id, newManager), 'Management transferred')}>
          Transfer
        </Button>
      </div>
    </Section>
  );
}

function DangerSection({ team, busy, run, organizationId }: SectionProps) {
  const archived = team.status === 'archived';
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="space-y-3 pt-2 border-t border-error-500/20">
      <p className="text-xs font-medium text-error-300 flex items-center gap-1.5"><AlertTriangle size={12} /> Danger zone</p>
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" isLoading={busy === 'archive'}
          onClick={() => run('archive', () => archiveTeamServer(organizationId, team.id, !archived), archived ? 'Team restored' : 'Team archived')}>
          {archived ? <><ArchiveRestore size={14} /> Restore team</> : <><Archive size={14} /> Archive team</>}
        </Button>
        <Button size="sm" variant="outline" isLoading={busy === 'delete'}
          className="text-error-300 border-error-500/30 hover:bg-error-500/10"
          onClick={() => setConfirmOpen(true)}>
          <Trash2 size={14} /> Delete team
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${team.name}"?`}
        description="Members keep their organization accounts, but this team, its permissions and settings are permanently removed."
        confirmLabel="Delete team"
        isLoading={busy === 'delete'}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => { await run('delete', () => deleteTeamServer(organizationId, team.id), 'Team deleted', { closeAfter: true }); setConfirmOpen(false); }}
      />
    </div>
  );
}

interface SectionProps {
  team: Team;
  settings?: TeamSettings | null;
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>, okMsg: string, opts?: { closeAfter?: boolean }) => Promise<void>;
  organizationId: string;
}
