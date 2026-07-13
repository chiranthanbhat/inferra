// ============================================
// SETTINGS — production settings system
// 15 categories in a left rail; every control persists (Firestore via server
// callables / client-safe writes) or performs a real runtime action. Owners
// administer the workspace from here — there is no separate admin console.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '../ui';
import {
  Shield, Zap, DollarSign, Key, Bell, Building2, ClipboardList, Upload, Trash2,
  Globe, MapPin, Users, ShieldCheck, Wand2, Server, Plug, Palette, AlertTriangle,
  Copy, Check, Plus, X, Loader2, LogOut, KeyRound, Route,
} from 'lucide-react';
import { useToast } from '../../lib/toast';
import { getPlan } from '../../lib/plans';
import {
  cancelSubscription, updateOrganizationSettingsServer, renameOrganizationServer,
  deleteOrganizationServer, leaveOrganizationServer, rotateApiKeyServer,
  createCustomPermissionServer, deleteCustomPermissionServer,
} from '../../lib/functions';
import { useOrganization } from '../../lib/orgContext';
import { canEditSettings, canManageBilling, canViewAuditLogs, canTransferOwnership, permissionsFor, ROLE_HIERARCHY } from '../../lib/permissions';
import { listAuditLogs, listInvoices, updateOrgProfile, updateOrgNotifications, updateOrgBranding, listCustomPermissions } from '../../lib/db';
import { uploadOrgLogo, removeOrgLogo } from '../../lib/orgLogo';
import { signOut, firebaseConfigured, resetPassword } from '../../lib/firebase';
import { MembersPanel } from './MembersPanel';
import { PROVIDER_META } from '../../lib/providers';
import type { AuditLog, Invoice, CustomPermission, AIProvider, OrganizationSettings as OrgSettingsT, MemberRole } from '../../types';

type CategoryId =
  | 'general' | 'organization' | 'members' | 'permissions' | 'security' | 'authentication'
  | 'routing' | 'optimization' | 'providers' | 'billing' | 'notifications' | 'integrations'
  | 'appearance' | 'api' | 'danger';

const REDUCED_MOTION_KEY = 'inferra_reduced_motion';
const KNOWN_PROVIDERS: AIProvider[] = ['openai', 'anthropic', 'google', 'xai', 'deepseek', 'mistral', 'openrouter'];

export function Settings() {
  const { openPlans, logout, user } = useStore();
  const { currentOrganization: organization, organizationRole, refreshOrganization } = useOrganization();
  const toast = useToast();
  const [active, setActive] = useState<CategoryId>('general');
  const [busy, setBusy] = useState<string | null>(null);

  const plan = getPlan(organization?.plan ?? 'free');
  const canEdit = canEditSettings(organizationRole);
  const canBilling = canManageBilling(organizationRole);
  const canAudit = canViewAuditLogs(organizationRole);
  const isOwner = canTransferOwnership(organizationRole);

  /* ---------- shared runner ---------- */
  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try {
      await fn();
      await refreshOrganization();
      toast({ title: okMsg, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message ?? 'Try again.', variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  /* ---------- local form state ---------- */
  const [orgName, setOrgName] = useState(organization?.name ?? '');
  const [timezone, setTimezone] = useState(organization?.timezone ?? '');
  const [country, setCountry] = useState(organization?.country ?? '');
  const [settingsDraft, setSettingsDraft] = useState<Partial<OrgSettingsT>>({});
  const [notifs, setNotifs] = useState(organization?.notifications ?? { budgetAlerts: true, securityAlerts: true, weeklyReports: false, usageAlertThresholds: [50, 80, 90, 95, 100] });
  const [accentColor, setAccentColor] = useState(organization?.branding?.accentColor ?? '#4DEEEA');
  const [reducedMotion, setReducedMotion] = useState(() => { try { return localStorage.getItem(REDUCED_MOTION_KEY) === '1'; } catch { return false; } });
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setOrgName(organization?.name ?? '');
    setTimezone(organization?.timezone ?? '');
    setCountry(organization?.country ?? '');
    setNotifs(organization?.notifications ?? { budgetAlerts: true, securityAlerts: true, weeklyReports: false, usageAlertThresholds: [50, 80, 90, 95, 100] });
    setAccentColor(organization?.branding?.accentColor ?? '#4DEEEA');
    setSettingsDraft({});
  }, [organization?.id, organization?.name, organization?.timezone, organization?.country]);

  const eff = <K extends keyof OrgSettingsT>(k: K): OrgSettingsT[K] | undefined =>
    (settingsDraft[k] ?? organization?.settings?.[k]) as OrgSettingsT[K] | undefined;
  const draft = <K extends keyof OrgSettingsT>(k: K, v: OrgSettingsT[K]) =>
    setSettingsDraft((s) => ({ ...s, [k]: v }));
  const saveDraft = (key: string) =>
    run(key, () => updateOrganizationSettingsServer(organization!.id, settingsDraft as Record<string, unknown>).then(() => setSettingsDraft({})), 'Settings saved');

  /* ---------- lazily loaded data per category ---------- */
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customPerms, setCustomPerms] = useState<CustomPermission[]>([]);
  useEffect(() => {
    if (!organization?.id) return;
    let cancelled = false;
    if (active === 'security' && canAudit && auditLogs === null) {
      listAuditLogs(organization.id, 50).then((r) => { if (!cancelled) setAuditLogs(r); }).catch(() => { if (!cancelled) setAuditLogs([]); });
    }
    if (active === 'billing' && canBilling) {
      listInvoices(organization.id).then((r) => { if (!cancelled) setInvoices(r); }).catch(() => {});
    }
    if (active === 'permissions') {
      listCustomPermissions(organization.id).then((r) => { if (!cancelled) setCustomPerms(r); }).catch(() => {});
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, organization?.id]);

  /* ---------- categories ---------- */
  const categories = useMemo(() => {
    const list: { id: CategoryId; label: string; icon: React.ReactNode }[] = [
      { id: 'general',        label: 'General',            icon: <Zap size={15} /> },
      { id: 'organization',   label: 'Organization',       icon: <Building2 size={15} /> },
      { id: 'members',        label: 'Members',            icon: <Users size={15} /> },
      { id: 'permissions',    label: 'Permissions',        icon: <ShieldCheck size={15} /> },
      { id: 'security',       label: 'Security',           icon: <Shield size={15} /> },
      { id: 'authentication', label: 'Authentication',     icon: <KeyRound size={15} /> },
      { id: 'routing',        label: 'AI Routing',         icon: <Route size={15} /> },
      { id: 'optimization',   label: 'Prompt Optimization', icon: <Wand2 size={15} /> },
      { id: 'providers',      label: 'Providers',          icon: <Server size={15} /> },
      { id: 'billing',        label: 'Billing',            icon: <DollarSign size={15} /> },
      { id: 'notifications',  label: 'Notifications',      icon: <Bell size={15} /> },
      { id: 'integrations',   label: 'Integrations',       icon: <Plug size={15} /> },
      { id: 'appearance',     label: 'Appearance',         icon: <Palette size={15} /> },
      { id: 'api',            label: 'API',                icon: <Key size={15} /> },
      { id: 'danger',         label: 'Danger Zone',        icon: <AlertTriangle size={15} /> },
    ];
    return list;
  }, []);

  if (!organization) return null;

  return (
    <div className="flex gap-6 items-start">
      {/* ── category rail ── */}
      <nav className="w-52 flex-shrink-0 glass-card rounded-2xl p-2 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto hide-scrollbar">
        {categories.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition ${
              active === c.id ? 'bg-brand-500/15 text-brand-200' : c.id === 'danger' ? 'text-error-400/80 hover:text-error-300 hover:bg-white/[0.04]' : 'text-ink-3 hover:text-white hover:bg-white/[0.04]'
            }`}>
            {c.icon} {c.label}
          </button>
        ))}
      </nav>

      {/* ── content ── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* GENERAL */}
        {active === 'general' && (
          <Card variant="glass">
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-2">Organization name</label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-2 flex items-center gap-1.5"><Globe size={13} /> Timezone</label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" disabled={!canEdit} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-2 flex items-center gap-1.5"><MapPin size={13} /> Country</label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="US" disabled={!canEdit} />
                </div>
              </div>
              {canEdit && (
                <Button isLoading={busy === 'general'} onClick={() => run('general', async () => {
                  const trimmed = orgName.trim();
                  if (trimmed && trimmed !== organization.name) await renameOrganizationServer(organization.id, trimmed);
                  if (timezone !== (organization.timezone ?? '') || country !== (organization.country ?? '')) {
                    await updateOrgProfile(organization.id, organization.ownerId, { timezone: timezone || undefined, country: country || undefined });
                  }
                }, 'General settings saved')}>Save changes</Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ORGANIZATION (logo + plan overview) */}
        {active === 'organization' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Organization profile</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                {organization.logo?.url ? (
                  <img src={organization.logo.url} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                ) : (
                  <span className="grid place-items-center w-14 h-14 rounded-xl bg-white/[0.04] border border-white/10 text-ink-3"><Building2 size={22} /></span>
                )}
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void run('logo', () => uploadOrgLogo(organization.id, organization.ownerId, f, organization.logo?.storagePath), 'Logo updated'); }} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" isLoading={busy === 'logo'} disabled={!canEdit} onClick={() => fileRef.current?.click()}>
                      <Upload size={13} /> Upload logo
                    </Button>
                    {organization.logo?.url && canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => run('logoRemove', () => removeOrgLogo(organization.id, organization.ownerId, organization.logo?.storagePath), 'Logo removed')}>
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                  <p className="text-[0.66rem] text-ink-3">PNG/JPG/SVG · used in the sidebar and emails.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/[0.06]">
                <MiniStat label="Plan" value={plan.name} />
                <MiniStat label="Members limit" value={plan.usersLimit < 0 ? 'Unlimited' : String(plan.usersLimit)} />
                <MiniStat label="Teams limit" value={plan.teamsLimit < 0 ? 'Unlimited' : String(plan.teamsLimit)} />
                <MiniStat label="Created" value={organization.createdAt.toLocaleDateString()} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* MEMBERS — full member management (invitations, roles, suspension) */}
        {active === 'members' && <MembersPanel />}

        {/* PERMISSIONS — role matrix + custom permissions */}
        {active === 'permissions' && (
          <>
            <Card variant="glass">
              <CardHeader><CardTitle>Role permission matrix</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-3">
                        <th className="py-2 pr-3 font-medium">Permission</th>
                        {[...ROLE_HIERARCHY].reverse().map((r) => <th key={r} className="py-2 px-2 font-medium capitalize text-center">{r}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {permissionsFor('owner').map((p) => (
                        <tr key={p} className="border-t border-white/[0.05]">
                          <td className="py-1.5 pr-3 text-ink-2 font-mono text-[0.68rem]">{p}</td>
                          {[...ROLE_HIERARCHY].reverse().map((r) => (
                            <td key={r} className="py-1.5 px-2 text-center">
                              {permissionsFor(r as MemberRole).includes(p)
                                ? <Check size={13} className="inline text-success-400" />
                                : <span className="text-ink-3/40">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[0.66rem] text-ink-3 mt-3">Organization roles. Per-team roles and resource grants are managed on each team (Teams → open a team → Permissions).</p>
              </CardContent>
            </Card>

            <CustomPermissionsCard
              customPerms={customPerms}
              isOwner={isOwner}
              busy={busy}
              organizationId={organization.id}
              onCreate={(name, desc) => run('cpCreate', async () => {
                await createCustomPermissionServer(organization.id, name, desc);
                setCustomPerms(await listCustomPermissions(organization.id));
              }, 'Custom permission created')}
              onDelete={(id) => run(`cpDel_${id}`, async () => {
                await deleteCustomPermissionServer(organization.id, id);
                setCustomPerms(await listCustomPermissions(organization.id));
              }, 'Custom permission deleted')}
            />
          </>
        )}

        {/* SECURITY */}
        {active === 'security' && (
          <>
            <Card variant="glass">
              <CardHeader><CardTitle>Data security policies</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <PolicyPicker label="PII handling" options={['block', 'sanitize', 'warn', 'allow']}
                  value={(eff('piiPolicy') ?? 'sanitize') as string} disabled={!canEdit}
                  onChange={(v) => draft('piiPolicy', v as OrgSettingsT['piiPolicy'])} />
                <PolicyPicker label="Secrets handling" options={['block', 'warn', 'allow']}
                  value={(eff('secretPolicy') ?? 'block') as string} disabled={!canEdit}
                  onChange={(v) => draft('secretPolicy', v as OrgSettingsT['secretPolicy'])} />
                <TogglePref label="Governance layer" desc="Compliance checks run on every request"
                  checked={eff('enableGovernance') ?? true} disabled={!canEdit}
                  onChange={(v) => draft('enableGovernance', v)} />
                {canEdit && <Button isLoading={busy === 'security'} disabled={Object.keys(settingsDraft).length === 0} onClick={() => saveDraft('security')}>Save security settings</Button>}
              </CardContent>
            </Card>
            {canAudit && (
              <Card variant="glass">
                <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList size={15} /> Audit log</CardTitle></CardHeader>
                <CardContent>
                  {auditLogs === null ? <p className="text-sm text-ink-3">Loading…</p> : auditLogs.length === 0 ? (
                    <p className="text-sm text-ink-3">No audit events yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {auditLogs.map((l) => (
                        <div key={l.id} className="flex items-center gap-2 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                          <span className="text-ink-2 truncate">{l.actorName || l.actorEmail || l.actorId} · <span className="font-mono text-[0.68rem]">{l.eventType}</span></span>
                          <span className="ml-auto text-ink-3 flex-shrink-0">{l.createdAt.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* AUTHENTICATION */}
        {active === 'authentication' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <StatusRow label="Email + password sign-in" status={firebaseConfigured ? 'Enabled' : 'Not configured'} ok={firebaseConfigured} />
              <StatusRow label="Google sign-in" status={firebaseConfigured ? 'Enabled' : 'Not configured'} ok={firebaseConfigured} />
              <StatusRow label="Email verification required" status="Enforced" ok
                note="Unverified accounts cannot execute requests, join teams or accept invitations. Enforced server-side; cannot be disabled." />
              <StatusRow label="Invitation email matching" status="Enforced" ok
                note="Invitations can only be accepted by the exact verified email they were sent to." />
              <div className="flex gap-2 pt-4 border-t border-white/[0.06]">
                <Button size="sm" variant="outline" isLoading={busy === 'pwReset'}
                  onClick={() => run('pwReset', async () => { if (user?.email) await resetPassword(user.email); }, 'Password reset email sent')}>
                  Send me a password reset
                </Button>
                <Button size="sm" variant="ghost" onClick={async () => { await signOut(); logout(); }}>
                  <LogOut size={13} /> Sign out this device
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI ROUTING */}
        {active === 'routing' && (
          <Card variant="glass">
            <CardHeader><CardTitle>AI routing</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <TogglePref label="Smart routing" desc="Route every request to the best-value model automatically"
                checked={eff('enableRouting') ?? true} disabled={!canEdit} onChange={(v) => draft('enableRouting', v)} />
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-2">Default routing priority</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['cost', 'speed', 'quality', 'balanced'] as const).map((p) => (
                    <button key={p} disabled={!canEdit} onClick={() => draft('defaultPriority', p)}
                      className={`p-3 rounded-xl border text-center capitalize text-sm transition disabled:opacity-60 ${
                        (eff('defaultPriority') ?? 'balanced') === p ? 'border-brand-500/60 bg-brand-500/15 text-brand-200' : 'border-white/10 text-ink-2 hover:border-white/20'
                      }`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-2">Default model (when routing is off)</label>
                <Input value={eff('defaultModel') ?? 'gpt-4o-mini'} disabled={!canEdit}
                  onChange={(e) => draft('defaultModel', e.target.value)} placeholder="gpt-4o-mini" />
              </div>
              {canEdit && <Button isLoading={busy === 'routing'} disabled={Object.keys(settingsDraft).length === 0} onClick={() => saveDraft('routing')}>Save routing settings</Button>}
            </CardContent>
          </Card>
        )}

        {/* PROMPT OPTIMIZATION */}
        {active === 'optimization' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Prompt optimization</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <TogglePref label="Prompt optimization" desc="Rewrite prompts for the routed model (token reduction + structure)"
                checked={eff('enableOptimization') ?? true} disabled={!canEdit} onChange={(v) => draft('enableOptimization', v)} />
              <p className="text-xs text-ink-3 leading-relaxed bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                Optimization always runs AFTER model selection, so prompts are rebuilt for the model that actually executes.
                Turning this off sends original prompts unchanged — routing and cost tracking still apply.
              </p>
              {canEdit && <Button isLoading={busy === 'optimization'} disabled={Object.keys(settingsDraft).length === 0} onClick={() => saveDraft('optimization')}>Save optimization settings</Button>}
            </CardContent>
          </Card>
        )}

        {/* PROVIDERS */}
        {active === 'providers' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Provider governance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-ink-3">Disabled providers are blocked org-wide — enforced server-side before any request runs.</p>
              <div className="divide-y divide-white/[0.05] rounded-xl border border-white/[0.06] overflow-hidden">
                {KNOWN_PROVIDERS.map((p) => {
                  const enabled = (eff('enabledProviders') ?? {})[p] !== false;
                  return (
                    <label key={p} className={`p-3 flex items-center gap-3 bg-white/[0.02] ${canEdit ? 'cursor-pointer' : ''}`}>
                      <span className="text-sm text-white flex-1">{PROVIDER_META[p].label}</span>
                      <Badge size="sm" variant={enabled ? 'success' : 'danger'}>{enabled ? 'Enabled' : 'Blocked'}</Badge>
                      <input type="checkbox" checked={enabled} disabled={!canEdit}
                        onChange={() => draft('enabledProviders', { ...(eff('enabledProviders') ?? {}), [p]: !enabled })}
                        className="w-4 h-4 rounded border-white/15 bg-navy-800 accent-[#4DEEEA]" />
                    </label>
                  );
                })}
              </div>
              {canEdit && <Button isLoading={busy === 'providers'} disabled={Object.keys(settingsDraft).length === 0} onClick={() => saveDraft('providers')}>Save provider settings</Button>}
            </CardContent>
          </Card>
        )}

        {/* BILLING */}
        {active === 'billing' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Billing & subscription</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {(organization.subscriptionStatus === 'past_due' || organization.subscriptionStatus === 'halted') && (
                <div className="flex items-start gap-2.5 p-3.5 bg-error-500/10 border border-error-500/25 rounded-xl">
                  <Shield size={16} className="text-error-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error-300">{organization.subscriptionStatus === 'halted' ? 'Subscription halted — resubscribe to restore your plan.' : 'Your last payment failed. Razorpay will retry automatically.'}</p>
                  {canBilling && <Button size="sm" className="ml-auto flex-shrink-0" onClick={() => openPlans('upgrade')}>Fix</Button>}
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-4 py-2 bg-brand-500/15 text-brand-300 rounded-xl font-semibold border border-brand-500/25">{plan.name} Plan</span>
                {organization.subscriptionStatus === 'trialing' && (
                  <Badge variant="info" size="sm">Trial{organization.trialEndsAt ? ` · ends ${organization.trialEndsAt.toLocaleDateString()}` : ''}</Badge>
                )}
                <span className="text-sm text-ink-3">
                  {plan.requestsLimit < 0 ? 'Unlimited requests' : `${organization.usage.requestsUsed.toLocaleString()} / ${plan.requestsLimit.toLocaleString()} requests this month`}
                </span>
                {plan.id !== 'enterprise' && canBilling && <Button size="sm" onClick={() => openPlans('upgrade')}>Upgrade</Button>}
                {(organization.subscriptionStatus === 'active' || organization.subscriptionStatus === 'trialing') && canBilling && (
                  <Button variant="outline" size="sm" isLoading={busy === 'cancel'} onClick={() => run('cancel', () => cancelSubscription(true), 'Subscription cancelled')}>Cancel</Button>
                )}
                {organization.subscriptionStatus === 'cancelled' && canBilling && (
                  <Button variant="outline" size="sm" onClick={() => openPlans('upgrade')}>Renew</Button>
                )}
              </div>
              {canBilling && (
                <div className="pt-5 border-t border-white/[0.07]">
                  <label className="block text-sm font-medium text-ink-2 mb-3">Invoices</label>
                  {invoices.length === 0 ? <p className="text-sm text-ink-3">No payments yet.</p> : (
                    <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
                      {invoices.map((inv) => (
                        <div key={inv.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                          <span className="text-ink-2 tabular">{inv.createdAt.toLocaleDateString()}</span>
                          <span className="text-ink-3 capitalize flex-1 truncate">{inv.plan ?? 'subscription'} · {inv.method ?? 'card'}</span>
                          <span className="text-white font-medium tabular">{inv.currency === 'INR' ? '₹' : '$'}{inv.amount.toLocaleString()}</span>
                          <Badge size="sm" variant={inv.status === 'paid' ? 'success' : 'danger'}>{inv.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* NOTIFICATIONS */}
        {active === 'notifications' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Notification preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <TogglePref label="Budget alerts" desc="Warn owners/admins at usage thresholds" checked={notifs.budgetAlerts} disabled={!canEdit}
                onChange={(v) => setNotifs((n) => ({ ...n, budgetAlerts: v }))} />
              <TogglePref label="Security alerts" desc="PII / secret detections in requests" checked={notifs.securityAlerts} disabled={!canEdit}
                onChange={(v) => setNotifs((n) => ({ ...n, securityAlerts: v }))} />
              <TogglePref label="Weekly reports" desc="Usage summary email every Monday" checked={notifs.weeklyReports} disabled={!canEdit}
                onChange={(v) => setNotifs((n) => ({ ...n, weeklyReports: v }))} />
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-2">Usage alert thresholds (%)</label>
                <div className="flex gap-2">
                  {[50, 80, 90, 95, 100].map((t) => (
                    <button key={t} disabled={!canEdit}
                      onClick={() => setNotifs((n) => ({ ...n, usageAlertThresholds: n.usageAlertThresholds.includes(t) ? n.usageAlertThresholds.filter((x) => x !== t) : [...n.usageAlertThresholds, t].sort((a, b) => a - b) }))}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition disabled:opacity-60 ${notifs.usageAlertThresholds.includes(t) ? 'border-brand-500/60 bg-brand-500/15 text-brand-200' : 'border-white/10 text-ink-3'}`}>
                      {t}%
                    </button>
                  ))}
                </div>
              </div>
              {canEdit && <Button isLoading={busy === 'notifs'} onClick={() => run('notifs', () => updateOrgNotifications(organization.id, organization.ownerId, notifs), 'Preferences saved')}>Save preferences</Button>}
            </CardContent>
          </Card>
        )}

        {/* INTEGRATIONS */}
        {active === 'integrations' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {KNOWN_PROVIDERS.map((p) => (
                <StatusRow key={p} label={PROVIDER_META[p].label}
                  status={(eff('enabledProviders') ?? {})[p] !== false ? 'Managed by Inferra · active' : 'Blocked in Providers settings'}
                  ok={(eff('enabledProviders') ?? {})[p] !== false} />
              ))}
              <p className="text-[0.66rem] text-ink-3 pt-2">Provider API keys are held server-side by Inferra — nothing to configure here. Use Providers to govern which ones your organization may route to.</p>
            </CardContent>
          </Card>
        )}

        {/* APPEARANCE */}
        {active === 'appearance' && (
          <Card variant="glass">
            <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-2">Brand accent</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={accentColor} disabled={!canEdit}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
                  <span className="text-sm text-ink-2 font-mono">{accentColor}</span>
                  {canEdit && (
                    <Button size="sm" variant="outline" isLoading={busy === 'branding'}
                      onClick={() => run('branding', () => updateOrgBranding(organization.id, organization.ownerId, { ...organization.branding, accentColor }), 'Brand accent saved')}>
                      Save
                    </Button>
                  )}
                </div>
                <p className="text-[0.66rem] text-ink-3 mt-2">Stored on the organization — consumed by white-label surfaces and email accents.</p>
              </div>
              <div className="pt-4 border-t border-white/[0.06]">
                <TogglePref label="Reduce motion" desc="Disable animations and transitions on this device"
                  checked={reducedMotion}
                  onChange={(v) => {
                    setReducedMotion(v);
                    try { localStorage.setItem(REDUCED_MOTION_KEY, v ? '1' : '0'); } catch { /* ignore */ }
                    document.documentElement.classList.toggle('reduce-motion', v);
                    toast({ title: v ? 'Motion reduced' : 'Motion restored', variant: 'success' });
                  }} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* API */}
        {active === 'api' && <ApiCard organization={organization} isOwner={isOwner} busy={busy} run={run} openPlans={() => openPlans('upgrade')} />}

        {/* DANGER ZONE */}
        {active === 'danger' && (
          <DangerZone
            orgName={organization.name}
            isOwner={isOwner}
            busy={busy}
            onLeave={() => run('leave', () => leaveOrganizationServer(organization.id), 'You left the organization')}
            onDelete={(confirmation) => run('deleteOrg', () => deleteOrganizationServer(organization.id, confirmation), 'Organization deleted')}
          />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── small building blocks ───────────────────────── */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <p className="text-[0.66rem] text-ink-3">{label}</p>
      <p className="text-sm font-semibold text-white mt-0.5 capitalize">{value}</p>
    </div>
  );
}

function TogglePref({ label, desc, checked, disabled, onChange }: { label: string; desc: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-ink-3">{desc}</p>
      </div>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-white/15 bg-navy-800 accent-[#4DEEEA]" />
    </label>
  );
}

function PolicyPicker({ label, options, value, disabled, onChange }: { label: string; options: string[]; value: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-2 mb-2">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button key={o} disabled={disabled} onClick={() => onChange(o)}
            className={`px-3.5 py-2 rounded-xl border text-sm capitalize transition disabled:opacity-60 ${value === o ? 'border-brand-500/60 bg-brand-500/15 text-brand-200' : 'border-white/10 text-ink-2 hover:border-white/20'}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusRow({ label, status, ok, note }: { label: string; status: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="text-sm text-white">{label}</p>
        {note && <p className="text-[0.68rem] text-ink-3 mt-0.5 max-w-md leading-relaxed">{note}</p>}
      </div>
      <Badge size="sm" variant={ok ? 'success' : 'warning'}>{status}</Badge>
    </div>
  );
}

/* ───────────────────────── custom permissions card ───────────────────────── */

function CustomPermissionsCard({ customPerms, isOwner, busy, onCreate, onDelete }: {
  customPerms: CustomPermission[];
  isOwner: boolean;
  busy: string | null;
  organizationId: string;
  onCreate: (name: string, desc: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <Card variant="glass">
      <CardHeader><CardTitle>Custom permissions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-ink-3">Owner-defined capabilities (e.g. “Manage Prompt Library”, “Deploy Providers”) assignable to teams from each team's Permissions tab.</p>
        {customPerms.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
            {customPerms.map((cp) => (
              <div key={cp.id} className="p-3 flex items-center gap-3 bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{cp.name}</p>
                  {cp.description && <p className="text-[0.7rem] text-ink-3">{cp.description}</p>}
                </div>
                {isOwner && (
                  <button disabled={busy === `cpDel_${cp.id}`} onClick={() => onDelete(cp.id)}
                    className="p-2 rounded-lg text-ink-3 hover:text-error-400 hover:bg-white/[0.05] transition disabled:opacity-50">
                    {busy === `cpDel_${cp.id}` ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {isOwner ? (
          <div className="flex gap-2 flex-wrap">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Name, e.g. "Manage Prompt Library"'
              className="flex-1 min-w-[180px] bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50" />
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
              className="flex-1 min-w-[180px] bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50" />
            <Button size="sm" isLoading={busy === 'cpCreate'} disabled={!name.trim()}
              onClick={async () => { await onCreate(name.trim(), desc.trim()); setName(''); setDesc(''); }}>
              <Plus size={13} /> Create
            </Button>
          </div>
        ) : (
          <p className="text-[0.66rem] text-ink-3">Only the organization owner can create or delete custom permissions.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── API card ───────────────────────── */

function ApiCard({ organization, isOwner, busy, run, openPlans }: {
  organization: { id: string; plan: string; apiKey?: { prefix: string; rotatedAt?: Date } };
  isOwner: boolean;
  busy: string | null;
  run: (key: string, fn: () => Promise<unknown>, okMsg: string) => Promise<void>;
  openPlans: () => void;
}) {
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isEnterprise = organization.plan === 'enterprise';

  if (!isEnterprise) {
    return (
      <Card variant="glass">
        <CardHeader><CardTitle>API access</CardTitle></CardHeader>
        <CardContent className="text-center py-8">
          <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-ink-3 mb-3"><Key size={20} /></span>
          <p className="text-sm text-white font-medium">API access is an Enterprise feature</p>
          <p className="text-xs text-ink-3 mt-1 mb-4">Programmatic routing, usage export and white-label endpoints.</p>
          <Button size="sm" onClick={openPlans}>Upgrade to Enterprise</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardHeader><CardTitle>API access</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {freshKey ? (
          <div className="p-4 rounded-xl bg-success-500/10 border border-success-500/25 space-y-2">
            <p className="text-sm text-success-300 font-medium">Your new API key — copy it now, it won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-white bg-black/40 rounded-lg px-3 py-2 break-all">{freshKey}</code>
              <button onClick={() => { void navigator.clipboard.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="p-2 rounded-lg text-ink-3 hover:text-white hover:bg-white/[0.05] transition">
                {copied ? <Check size={15} className="text-success-400" /> : <Copy size={15} />}
              </button>
            </div>
          </div>
        ) : organization.apiKey?.prefix ? (
          <div className="flex items-center gap-3">
            <code className="text-sm font-mono text-ink-2">{organization.apiKey.prefix}…</code>
            <Badge size="sm" variant="success">Active</Badge>
            <span className="text-[0.66rem] text-ink-3">Only a hash is stored — the full key was shown once at creation.</span>
          </div>
        ) : (
          <p className="text-sm text-ink-3">No API key yet. Generate one to authenticate server-to-server requests.</p>
        )}
        {isOwner ? (
          <Button size="sm" variant="outline" isLoading={busy === 'rotate'}
            onClick={() => run('rotate', async () => {
              const { apiKey } = await rotateApiKeyServer(organization.id);
              setFreshKey(apiKey);
            }, organization.apiKey?.prefix ? 'API key rotated' : 'API key created')}>
            <KeyRound size={13} /> {organization.apiKey?.prefix ? 'Rotate key' : 'Generate key'}
          </Button>
        ) : (
          <p className="text-[0.66rem] text-ink-3">Only the organization owner can manage API keys.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── danger zone ───────────────────────── */

function DangerZone({ orgName, isOwner, busy, onLeave, onDelete }: {
  orgName: string;
  isOwner: boolean;
  busy: string | null;
  onLeave: () => Promise<void>;
  onDelete: (confirmation: string) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState('');
  return (
    <Card variant="glass">
      <CardHeader><CardTitle className="text-error-300">Danger zone</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {!isOwner && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-warning-500/25 bg-warning-500/[0.06]">
            <div>
              <p className="text-sm font-medium text-white">Leave this organization</p>
              <p className="text-xs text-ink-3">You lose access to its teams, chats and usage history.</p>
            </div>
            <Button size="sm" variant="outline" isLoading={busy === 'leave'} onClick={onLeave}><LogOut size={13} /> Leave</Button>
          </div>
        )}
        {isOwner && (
          <div className="p-4 rounded-xl border border-error-500/25 bg-error-500/[0.06] space-y-3">
            <div>
              <p className="text-sm font-medium text-white">Delete this organization</p>
              <p className="text-xs text-ink-3 mt-1 leading-relaxed">
                Soft-deletes the workspace: members lose access, the active subscription must be cancelled first,
                and audit/usage history is retained for compliance. Type <span className="font-mono text-error-300">{orgName}</span> to confirm.
              </p>
            </div>
            <div className="flex gap-2">
              <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={orgName}
                className="flex-1 bg-black/30 border border-error-500/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-error-500/60" />
              <Button size="sm" variant="outline" disabled={confirmation !== orgName} isLoading={busy === 'deleteOrg'}
                onClick={() => onDelete(confirmation)}>
                <Trash2 size={13} /> Delete organization
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
