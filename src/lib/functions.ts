// ============================================
// CLOUD FUNCTION CALLABLES (typed client bridge)
// The browser never holds provider keys or mutates usage/billing directly —
// it calls these authenticated callables, which enforce everything server-side.
// ============================================

import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { functions } from './firebase';
import type { PlanType, CheckoutResult, MemberRole, MemberStatus, InvitationPreview } from '../types';

export class UsageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageLimitError';
  }
}

/* ───────────────────────── metered provider execution ───────────────────────── */

export interface ExecuteModelDescriptor {
  id: string;
  provider: string;
  name: string;            // provider API model id
  inputCostPer1k: number;
  outputCostPer1k: number;
}

export interface ExecuteRequestInput {
  model: ExecuteModelDescriptor;                     // routed model to run on
  history: { role: 'user' | 'assistant'; content: string }[];
  meta?: {
    requestedModelId?: string;
    originalTokens?: number;
    optimizedTokens?: number;
    estCost?: number;
    estSavings?: number;
    latencyMs?: number;
    teamId?: string;   // team the request is attributed to (Command Center context)
  };
}

export interface ExecuteRequestResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  requestsUsed: number;
  requestsLimit: number;
  latencyMs: number;
}

const _execute = httpsCallable<ExecuteRequestInput, ExecuteRequestResult>(functions, 'executeRequest');

export async function executeRequest(input: ExecuteRequestInput): Promise<ExecuteRequestResult> {
  try {
    const res: HttpsCallableResult<ExecuteRequestResult> = await _execute(input);
    return res.data;
  } catch (e: any) {
    if (e?.code === 'functions/resource-exhausted') {
      throw new UsageLimitError(e?.message || 'Monthly request limit reached. Upgrade your plan to continue.');
    }
    throw new Error(e?.message || 'Request failed. Please try again.');
  }
}

/* ───────────────────────── billing (Razorpay) ───────────────────────── */

const _createSub = httpsCallable<{ plan: PlanType }, CheckoutResult>(functions, 'createSubscription');
const _confirmSub = httpsCallable<
  { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string },
  { ok: boolean; plan: PlanType }
>(functions, 'confirmSubscription');
const _cancelSub = httpsCallable<{ atCycleEnd?: boolean }, { ok: boolean }>(functions, 'cancelSubscription');

export async function createSubscription(plan: PlanType): Promise<CheckoutResult> {
  const res = await _createSub({ plan });
  return res.data;
}

export async function confirmSubscription(payload: {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}): Promise<{ ok: boolean; plan: PlanType }> {
  const res = await _confirmSub(payload);
  return res.data;
}

export async function cancelSubscription(atCycleEnd = true): Promise<{ ok: boolean }> {
  const res = await _cancelSub({ atCycleEnd });
  return res.data;
}

/* ───────────────────────── organizations ───────────────────────── */

interface OrgSettingsPatch {
  defaultModel?: string;
  defaultPriority?: 'cost' | 'speed' | 'quality' | 'balanced';
  enableOptimization?: boolean;
  enableRouting?: boolean;
  enableGovernance?: boolean;
  piiPolicy?: 'block' | 'sanitize' | 'warn' | 'allow';
  secretPolicy?: 'block' | 'warn' | 'allow';
}

const _updateOrgSettings = httpsCallable<{ organizationId: string; patch: OrgSettingsPatch }, { ok: boolean }>(functions, 'updateOrganizationSettings');
const _renameOrg = httpsCallable<{ organizationId: string; name: string }, { ok: boolean }>(functions, 'renameOrganization');
const _deleteOrg = httpsCallable<{ organizationId: string; confirmation: string }, { ok: boolean }>(functions, 'deleteOrganization');
const _transferOwner = httpsCallable<{ organizationId: string; toUserId: string }, { ok: boolean }>(functions, 'transferOwnership');

export async function updateOrganizationSettingsServer(organizationId: string, patch: OrgSettingsPatch): Promise<void> {
  await _updateOrgSettings({ organizationId, patch });
}
export async function renameOrganizationServer(organizationId: string, name: string): Promise<void> {
  await _renameOrg({ organizationId, name });
}
export async function deleteOrganizationServer(organizationId: string, confirmation: string): Promise<void> {
  await _deleteOrg({ organizationId, confirmation });
}
export async function transferOwnershipServer(organizationId: string, toUserId: string): Promise<void> {
  await _transferOwner({ organizationId, toUserId });
}

/* ───────────────────────── team management ───────────────────────── */

type InvitableRole = Exclude<MemberRole, 'owner'>;

const _invite = httpsCallable<{ organizationId: string; email: string; role: InvitableRole; teamId?: string; teamRole?: 'member' | 'viewer' }, { ok: boolean; invitationId: string }>(functions, 'inviteMember');
const _previewInvite = httpsCallable<{ invitationId: string; token: string }, InvitationPreview>(functions, 'previewInvitation');
const _acceptInvite = httpsCallable<{ invitationId: string }, { ok: boolean; organizationId: string }>(functions, 'acceptInvitation');
const _rejectInvite = httpsCallable<{ invitationId: string }, { ok: boolean }>(functions, 'rejectInvitation');
const _cancelInvite = httpsCallable<{ invitationId: string }, { ok: boolean }>(functions, 'cancelInvitation');
const _resendInvite = httpsCallable<{ invitationId: string }, { ok: boolean }>(functions, 'resendInvitation');
const _removeMember = httpsCallable<{ organizationId: string; userId: string }, { ok: boolean }>(functions, 'removeMember');
const _changeRole = httpsCallable<{ organizationId: string; userId: string; role: MemberRole }, { ok: boolean }>(functions, 'changeMemberRole');
const _setStatus = httpsCallable<{ organizationId: string; userId: string; status: MemberStatus }, { ok: boolean }>(functions, 'setMemberStatus');
const _leaveOrg = httpsCallable<{ organizationId: string }, { ok: boolean }>(functions, 'leaveOrganization');

export async function inviteMemberServer(
  organizationId: string,
  email: string,
  role: InvitableRole,
  team?: { teamId: string; teamRole?: 'member' | 'viewer' },
): Promise<string> {
  const res = await _invite({ organizationId, email, role, teamId: team?.teamId, teamRole: team?.teamRole });
  return res.data.invitationId;
}

/** Token-gated pre-auth preview for the invitation deep link. */
export async function previewInvitationServer(invitationId: string, token: string): Promise<InvitationPreview> {
  const res = await _previewInvite({ invitationId, token });
  return res.data;
}
export async function acceptInvitationServer(invitationId: string): Promise<string> {
  const res = await _acceptInvite({ invitationId });
  return res.data.organizationId;
}
export async function rejectInvitationServer(invitationId: string): Promise<void> {
  await _rejectInvite({ invitationId });
}
export async function cancelInvitationServer(invitationId: string): Promise<void> {
  await _cancelInvite({ invitationId });
}
export async function resendInvitationServer(invitationId: string): Promise<void> {
  await _resendInvite({ invitationId });
}
export async function removeMemberServer(organizationId: string, userId: string): Promise<void> {
  await _removeMember({ organizationId, userId });
}
export async function changeMemberRoleServer(organizationId: string, userId: string, role: MemberRole): Promise<void> {
  await _changeRole({ organizationId, userId, role });
}
export async function setMemberStatusServer(organizationId: string, userId: string, status: MemberStatus): Promise<void> {
  await _setStatus({ organizationId, userId, status });
}
export async function leaveOrganizationServer(organizationId: string): Promise<void> {
  await _leaveOrg({ organizationId });
}

/* ───────────────────────── workspace teams ───────────────────────── */

type TeamRoleArg = 'manager' | 'member' | 'viewer';
interface TeamPatch { name?: string; description?: string; color?: string; icon?: string }
export interface TeamSettingsPatch {
  defaultPriority?: 'cost' | 'speed' | 'quality' | 'balanced';
  defaultModel?: string;
  allowedProviders?: Record<string, boolean>;
  piiPolicy?: 'block' | 'sanitize' | 'warn' | 'allow';
  secretPolicy?: 'block' | 'warn' | 'allow';
  monthlyBudget?: number;
  monthlyRequestLimit?: number;
  notifyUsageThreshold?: boolean;
  notifyMemberChanges?: boolean;
  notes?: string;
}

const _createTeam = httpsCallable<{ organizationId: string; name: string; description?: string; color?: string; icon?: string; managerId?: string }, { ok: boolean; teamId: string }>(functions, 'createTeam');
const _updateTeam = httpsCallable<{ organizationId: string; teamId: string; patch: TeamPatch }, { ok: boolean }>(functions, 'updateTeam');
const _archiveTeam = httpsCallable<{ organizationId: string; teamId: string; archived: boolean }, { ok: boolean }>(functions, 'archiveTeam');
const _deleteTeam = httpsCallable<{ organizationId: string; teamId: string }, { ok: boolean }>(functions, 'deleteTeam');
const _duplicateTeam = httpsCallable<{ organizationId: string; teamId: string; name?: string }, { ok: boolean; teamId: string }>(functions, 'duplicateTeam');
const _transferTeamManager = httpsCallable<{ organizationId: string; teamId: string; toUserId: string }, { ok: boolean }>(functions, 'transferTeamManager');
const _addTeamMembers = httpsCallable<{ organizationId: string; teamId: string; userIds: string[]; teamRole?: TeamRoleArg }, { ok: boolean; added: number }>(functions, 'addTeamMembers');
const _removeTeamMembers = httpsCallable<{ organizationId: string; teamId: string; userIds: string[] }, { ok: boolean; removed: number }>(functions, 'removeTeamMembers');
const _setTeamMemberRole = httpsCallable<{ organizationId: string; teamId: string; userIds: string[]; teamRole: TeamRoleArg }, { ok: boolean; changed: number }>(functions, 'setTeamMemberRole');
const _moveTeamMembers = httpsCallable<{ organizationId: string; fromTeamId: string; toTeamId: string; userIds: string[] }, { ok: boolean; moved: number }>(functions, 'moveTeamMembers');
const _setTeamPermissions = httpsCallable<{ organizationId: string; teamId: string; grants: Record<string, boolean>; customGrants?: string[] }, { ok: boolean }>(functions, 'setTeamPermissions');
const _createCustomPermission = httpsCallable<{ organizationId: string; name: string; description?: string }, { ok: boolean; permissionId: string }>(functions, 'createCustomPermission');
const _deleteCustomPermission = httpsCallable<{ organizationId: string; permissionId: string }, { ok: boolean }>(functions, 'deleteCustomPermission');
const _updateTeamSettings = httpsCallable<{ organizationId: string; teamId: string; patch: TeamSettingsPatch }, { ok: boolean }>(functions, 'updateTeamSettings');
const _rotateApiKey = httpsCallable<{ organizationId: string }, { ok: boolean; apiKey: string; prefix: string }>(functions, 'rotateApiKey');

export async function createTeamServer(organizationId: string, input: { name: string; description?: string; color?: string; icon?: string; managerId?: string }): Promise<string> {
  const res = await _createTeam({ organizationId, ...input });
  return res.data.teamId;
}
export async function updateTeamServer(organizationId: string, teamId: string, patch: TeamPatch): Promise<void> {
  await _updateTeam({ organizationId, teamId, patch });
}
export async function archiveTeamServer(organizationId: string, teamId: string, archived: boolean): Promise<void> {
  await _archiveTeam({ organizationId, teamId, archived });
}
export async function deleteTeamServer(organizationId: string, teamId: string): Promise<void> {
  await _deleteTeam({ organizationId, teamId });
}
export async function duplicateTeamServer(organizationId: string, teamId: string, name?: string): Promise<string> {
  const res = await _duplicateTeam({ organizationId, teamId, name });
  return res.data.teamId;
}
export async function transferTeamManagerServer(organizationId: string, teamId: string, toUserId: string): Promise<void> {
  await _transferTeamManager({ organizationId, teamId, toUserId });
}
export async function addTeamMembersServer(organizationId: string, teamId: string, userIds: string[], teamRole?: TeamRoleArg): Promise<number> {
  const res = await _addTeamMembers({ organizationId, teamId, userIds, teamRole });
  return res.data.added;
}
export async function removeTeamMembersServer(organizationId: string, teamId: string, userIds: string[]): Promise<number> {
  const res = await _removeTeamMembers({ organizationId, teamId, userIds });
  return res.data.removed;
}
export async function setTeamMemberRoleServer(organizationId: string, teamId: string, userIds: string[], teamRole: TeamRoleArg): Promise<number> {
  const res = await _setTeamMemberRole({ organizationId, teamId, userIds, teamRole });
  return res.data.changed;
}
export async function moveTeamMembersServer(organizationId: string, fromTeamId: string, toTeamId: string, userIds: string[]): Promise<number> {
  const res = await _moveTeamMembers({ organizationId, fromTeamId, toTeamId, userIds });
  return res.data.moved;
}
export async function setTeamPermissionsServer(organizationId: string, teamId: string, grants: Record<string, boolean>, customGrants?: string[]): Promise<void> {
  await _setTeamPermissions({ organizationId, teamId, grants, customGrants });
}
export async function createCustomPermissionServer(organizationId: string, name: string, description?: string): Promise<string> {
  const res = await _createCustomPermission({ organizationId, name, description });
  return res.data.permissionId;
}
export async function deleteCustomPermissionServer(organizationId: string, permissionId: string): Promise<void> {
  await _deleteCustomPermission({ organizationId, permissionId });
}
export async function updateTeamSettingsServer(organizationId: string, teamId: string, patch: TeamSettingsPatch): Promise<void> {
  await _updateTeamSettings({ organizationId, teamId, patch });
}
export async function rotateApiKeyServer(organizationId: string): Promise<{ apiKey: string; prefix: string }> {
  const res = await _rotateApiKey({ organizationId });
  return { apiKey: res.data.apiKey, prefix: res.data.prefix };
}
