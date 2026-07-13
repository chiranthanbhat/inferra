// ============================================
// TEAM DASHBOARD (workspace architecture)
// Overview stats → team cards (icon/color/manager/members/quick actions) →
// detail panel (members, permissions, settings, activity). All mutations go
// through Cloud Function callables; UI gates via org role + team manager.
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Users, Plus, Search, Loader2, X, Crown, Copy, Archive, ArchiveRestore,
  Trash2, ChevronLeft, ChevronRight, Activity, Mail, Zap, Palette,
} from 'lucide-react';
import { Button, Input, Badge, ConfirmDialog } from '../ui';
import { useStore } from '../../store/useStore';
import { useOrganization } from '../../lib/orgContext';
import { useTeamAccess } from '../../lib/teamAccess';
import { useToast } from '../../lib/toast';
import { DEV_AUTH } from '../../lib/devAuth';
import { hasPermission, roleAtLeast } from '../../lib/permissions';
import { TEAM_COLORS, TEAM_ICONS } from '../../lib/resources';
import { listTeams, getTeamsByIds, listOrgInvitations, listTeamActivity, listMembers, getUsageRecords, listTeamMembers } from '../../lib/db';
import { createTeamServer, archiveTeamServer, deleteTeamServer, duplicateTeamServer } from '../../lib/functions';
import { TeamDetail, TeamIcon } from './TeamDetail';
import type { Team, TeamActivity, OrgMember, Invitation, UsageRecord } from '../../types';

const PAGE_SIZE = 9;

/** Demo data so the dashboard is fully explorable in dev-auth mode. */
function demoTeams(orgId: string): Team[] {
  const now = new Date();
  return [
    { id: 'demo-eng', organizationId: orgId, name: 'Engineering', description: 'Core product and platform', color: '#4DEEEA', icon: 'code', managerId: 'demo-user', status: 'active', memberCount: 1, createdBy: 'demo-user', createdAt: now, updatedAt: now },
    { id: 'demo-mkt', organizationId: orgId, name: 'Marketing', description: 'Campaigns, analytics, reporting', color: '#F472B6', icon: 'megaphone', managerId: 'demo-user', status: 'active', memberCount: 1, createdBy: 'demo-user', createdAt: now, updatedAt: now },
    { id: 'demo-fin', organizationId: orgId, name: 'Finance', description: 'Billing, usage and cost reports', color: '#FBBF24', icon: 'dollar-sign', managerId: 'demo-user', status: 'archived', memberCount: 1, createdBy: 'demo-user', createdAt: now, updatedAt: now },
  ];
}

export function Teams() {
  const user = useStore((s) => s.user);
  const { organizationId, organizationRole } = useOrganization();
  const { refreshAccess, myMemberships } = useTeamAccess();
  const toast = useToast();
  // Team VISIBILITY: owners/admins see every team; everyone else only the
  // teams they belong to (mirrored by security rules — a broad list query is
  // rejected server-side for scoped users, so we fetch by membership ids).
  const seesAllTeams = roleAtLeast(organizationRole, 'admin');

  const [teams, setTeams] = useState<Team[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [usageByUser, setUsageByUser] = useState<Record<string, number>>({});
  const [teamUserIds, setTeamUserIds] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [page, setPage] = useState(0);

  // panels
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTeam, setDetailTeam] = useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const canManage = hasPermission(organizationRole, 'teams.manage');

  const load = async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    try {
      if (DEV_AUTH) {
        setTeams(demoTeams(organizationId));
        setOrgMembers([{ userId: user?.id ?? 'demo-user', email: user?.email ?? '', name: user?.name ?? 'Demo User', role: 'owner', status: 'active', joinedAt: new Date() }]);
        setPendingInvites([]);
        setActivity([]);
        return;
      }
      // Scoped fetch: admins list the org; members/managers resolve their own
      // teams from membership rows (rules reject the broad query for them).
      const myTeamIds = myMemberships.map((mm) => mm.teamId);
      const [t, m, inv, usage] = await Promise.all([
        seesAllTeams ? listTeams(organizationId) : getTeamsByIds(myTeamIds),
        listMembers(organizationId).catch(() => []),
        seesAllTeams ? listOrgInvitations(organizationId).catch(() => []) : Promise.resolve([]),
        seesAllTeams ? getUsageRecords(organizationId, 200).catch(() => []) : Promise.resolve([]),
      ]);
      // Activity: org-wide for admins; per visible team otherwise.
      const act = seesAllTeams
        ? await listTeamActivity({ orgId: organizationId }, 20).catch(() => [])
        : (await Promise.all(myTeamIds.slice(0, 5).map((id) => listTeamActivity({ teamId: id }, 8).catch(() => []))))
            .flat()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 20);
      setTeams(t);
      setOrgMembers(m);
      setPendingInvites(inv.filter((i) => i.status === 'pending'));
      setActivity(act);
      setUsageRecords(usage);
      const byUser: Record<string, number> = {};
      usage.forEach((u) => { byUser[u.userId] = (byUser[u.userId] ?? 0) + 1; });
      setUsageByUser(byUser);
      // membership map for usage-by-team attribution (admins only — scoped
      // users can't and shouldn't read other teams' member lists)
      const maps = seesAllTeams
        ? await Promise.all(
            t.filter((x) => x.status === 'active').slice(0, 20).map(async (x) => ({
              teamId: x.id,
              userIds: (await listTeamMembers(x.id).catch(() => [])).map((tm) => tm.userId),
            })),
          )
        : [];
      setTeamUserIds(Object.fromEntries(maps.map((x) => [x.teamId, x.userIds])));
    } catch (e: any) {
      toast({ title: 'Could not load teams', description: e?.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [organizationId, seesAllTeams, myMemberships.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }, [teams, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageTeams = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  /** Requests attributed to a team = sum of its members' request counts. */
  const teamUsage = (teamId: string): number =>
    (teamUserIds[teamId] ?? []).reduce((sum, uid) => sum + (usageByUser[uid] ?? 0), 0);

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    if (DEV_AUTH) { toast({ title: 'Demo mode', description: 'Team mutations need the deployed backend.', variant: 'info' }); return; }
    setBusy(key);
    try {
      await fn();
      toast({ title: okMsg, variant: 'success' });
      await Promise.all([load(), refreshAccess()]);
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (!organizationId) return null;

  const activeTeams = teams.filter((t) => t.status === 'active');
  const totalActivity = activity.length;

  return (
    <div className="space-y-5">
      {/* ── Overview strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Teams" value={activeTeams.length} icon={<Users size={15} className="text-brand-300" />} sub={`${teams.length - activeTeams.length} archived`} />
        <Stat label="Members" value={orgMembers.length} icon={<Users size={15} className="text-accent-400" />} sub="in organization" />
        <Stat label="Pending invites" value={pendingInvites.length} icon={<Mail size={15} className="text-warning-400" />} sub="awaiting response" />
        <Stat label="Recent changes" value={totalActivity} icon={<Activity size={15} className="text-success-400" />} sub="last 20 events" />
        <Stat label="Requests (recent)" value={Object.values(usageByUser).reduce((a, b) => a + b, 0)} icon={<Zap size={15} className="text-brand-300" />} sub="attributable to teams" />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams…"
            className="w-full bg-black/30 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-ink-3 focus:outline-none focus:border-brand-500/50" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="bg-black/30 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-ink-2 focus:outline-none focus:border-brand-500/50">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <span className="text-xs text-ink-3">{filtered.length} team{filtered.length === 1 ? '' : 's'}</span>
        {canManage && (
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}><Plus size={15} /> New team</Button>
        )}
      </div>

      {/* ── Team cards ── */}
      {loading ? (
        <div className="glass-card rounded-2xl p-12 grid place-items-center text-ink-3"><Loader2 size={20} className="animate-spin" /></div>
      ) : pageTeams.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] text-ink-3 mb-3"><Users size={22} /></span>
          <p className="text-sm text-white font-medium">No teams {statusFilter !== 'all' ? statusFilter : 'yet'}</p>
          <p className="text-xs text-ink-3 mt-1">{canManage ? 'Create your first team to organize members and permissions.' : 'Ask an organization manager to add you to a team.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pageTeams.map((team) => {
            const manager = orgMembers.find((m) => m.userId === team.managerId);
            const archived = team.status === 'archived';
            return (
              <motion.div key={team.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-2xl p-5 panel-hover relative overflow-hidden ${archived ? 'opacity-60' : ''}`}>
                <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${team.color}, transparent)` }} />
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-11 h-11 rounded-xl border flex-shrink-0"
                    style={{ background: `${team.color}1a`, borderColor: `${team.color}40`, color: team.color }}>
                    <TeamIcon icon={team.icon} size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDetailTeam(team)} className="text-sm font-semibold text-white hover:text-brand-200 transition truncate">{team.name}</button>
                      {archived && <Badge size="sm" variant="warning">Archived</Badge>}
                    </div>
                    <p className="text-xs text-ink-3 mt-0.5 line-clamp-2">{team.description || 'No description'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 text-xs text-ink-3">
                  <span className="inline-flex items-center gap-1"><Users size={12} /> {team.memberCount}</span>
                  <span className="inline-flex items-center gap-1 truncate"><Crown size={12} className="text-warning-400" /> {manager?.name || manager?.email || '—'}</span>
                  <span className="inline-flex items-center gap-1"><Zap size={12} /> {teamUsage(team.id)} req</span>
                  <span className="ml-auto">{team.updatedAt.toLocaleDateString()}</span>
                </div>

                {/* quick actions */}
                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-white/[0.06]">
                  <Button size="sm" variant="outline" onClick={() => setDetailTeam(team)}>Open</Button>
                  {canManage && (
                    <>
                      <button title="Duplicate" disabled={busy !== null}
                        onClick={() => run(`dup_${team.id}`, () => duplicateTeamServer(organizationId, team.id), 'Team duplicated')}
                        className="ml-auto p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition disabled:opacity-50">
                        {busy === `dup_${team.id}` ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                      </button>
                      <button title={archived ? 'Restore' : 'Archive'} disabled={busy !== null}
                        onClick={() => run(`arc_${team.id}`, () => archiveTeamServer(organizationId, team.id, !archived), archived ? 'Team restored' : 'Team archived')}
                        className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition disabled:opacity-50">
                        {busy === `arc_${team.id}` ? <Loader2 size={14} className="animate-spin" /> : archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </button>
                      <button title="Delete" disabled={busy !== null}
                        onClick={() => setDeleteTarget(team)}
                        className="p-2 rounded-lg text-ink-3 hover:text-error-400 hover:bg-white/[0.05] transition disabled:opacity-50">
                        {busy === `del_${team.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-ink-3">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition"><ChevronLeft size={16} /></button>
          <span className="tabular">Page {page + 1} / {pageCount}</span>
          <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-white/[0.05] disabled:opacity-30 transition"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* ── Recent activity ── */}
      {activity.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Activity size={15} className="text-brand-300" /> Recent team activity</h3>
          <div className="space-y-2">
            {activity.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                <span className="text-ink-2 truncate">
                  <span className="text-white">{a.actorName}</span> · {a.eventType.replace('team.', '').replace(/([A-Z])/g, ' $1').toLowerCase()}
                  {' '}· <span className="text-ink-3">{teams.find((t) => t.id === a.teamId)?.name ?? a.teamId}</span>
                </span>
                <span className="ml-auto text-ink-3 flex-shrink-0">{a.createdAt.toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create modal ── */}
      <AnimatePresence>
        {createOpen && (
          <CreateTeamModal
            organizationId={organizationId}
            members={orgMembers}
            busy={busy === 'create'}
            onClose={() => setCreateOpen(false)}
            onCreate={async (input) => {
              await run('create', () => createTeamServer(organizationId, input), `Team "${input.name}" created`);
              setCreateOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Detail panel ── */}
      <AnimatePresence>
        {detailTeam && (
          <TeamDetail
            team={teams.find((t) => t.id === detailTeam.id) ?? detailTeam}
            orgMembers={orgMembers}
            allTeams={activeTeams}
            usageRecords={usageRecords}
            pendingInvites={pendingInvites}
            onClose={() => setDetailTeam(null)}
            onChanged={async () => { await Promise.all([load(), refreshAccess()]); }}
          />
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        description="Members keep their organization accounts, but this team and its permissions are permanently removed."
        confirmLabel="Delete team"
        isLoading={!!deleteTarget && busy === `del_${deleteTarget.id}`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const t = deleteTarget;
          if (!t) return;
          await run(`del_${t.id}`, () => deleteTeamServer(organizationId, t.id), 'Team deleted');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function Stat({ label, value, icon, sub }: { label: string; value: number; icon: React.ReactNode; sub: string }) {
  return (
    <div className="glass-card rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-[0.66rem] text-ink-3">{icon}{label}</div>
      <p className="text-xl font-bold text-white tabular mt-0.5">{value.toLocaleString()}</p>
      <p className="text-[0.62rem] text-ink-3">{sub}</p>
    </div>
  );
}

/* ───────────────────────── create modal ───────────────────────── */

function CreateTeamModal({ organizationId, members, busy, onClose, onCreate }: {
  organizationId: string;
  members: OrgMember[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; description?: string; color?: string; icon?: string; managerId?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [icon, setIcon] = useState<string>('users');
  const [managerId, setManagerId] = useState('');
  void organizationId;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2"><Plus size={16} className="text-brand-300" /> Create a team</h3>
          <button onClick={onClose} className="text-ink-3 hover:text-white transition"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <Input label="Name" placeholder="Engineering, Marketing, Finance…" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" placeholder="What does this team do?" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2 flex items-center gap-1.5"><Palette size={13} /> Color</label>
            <div className="flex gap-2 flex-wrap">
              {TEAM_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">Icon</label>
            <div className="grid grid-cols-8 gap-1.5">
              {TEAM_ICONS.map((key) => (
                <button key={key} onClick={() => setIcon(key)}
                  className={`grid place-items-center h-9 rounded-lg border transition ${icon === key ? 'border-brand-500/60 bg-brand-500/15 text-brand-200' : 'border-white/[0.08] text-ink-3 hover:text-white'}`}>
                  <TeamIcon icon={key} size={15} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">Manager</label>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)}
              className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/50">
              <option value="">Me (default)</option>
              {members.filter((m) => m.status === 'active').map((m) => (
                <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
              ))}
            </select>
          </div>

          <Button className="w-full" isLoading={busy} disabled={!name.trim()}
            onClick={() => onCreate({ name: name.trim(), description: description.trim(), color, icon, managerId: managerId || undefined })}>
            Create team
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
