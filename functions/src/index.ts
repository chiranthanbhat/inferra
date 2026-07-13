// ============================================
// INFERRA CLOUD FUNCTIONS — entry point
// ============================================
//
// Callables (client → firebase/functions httpsCallable):
//   executeRequest       metered provider proxy (reserve → execute → finalize/refund)
//   createSubscription   start a Razorpay subscription (trial-aware)
//   confirmSubscription  verify checkout signature, unlock plan
//   cancelSubscription   cancel at cycle end
//   getAdminMetrics      admin-only platform metrics
//   updateOrganizationSettings / renameOrganization / deleteOrganization / transferOwnership
//   inviteMember / acceptInvitation / rejectInvitation / cancelInvitation / resendInvitation
//   removeMember / changeMemberRole / setMemberStatus / leaveOrganization
//
// HTTP:
//   razorpayWebhook      Razorpay → Firestore reconciliation + invoices (set in dashboard)
//
// Scheduled:
//   monthlyReset         daily safety-net usage rollover
//   expireInvitations    daily invitation-expiry sweeper
// ============================================

export { executeRequest } from './executeRequest';
export { createSubscription, confirmSubscription, cancelSubscription } from './razorpay';
export { razorpayWebhook } from './webhook';
export { getAdminMetrics } from './admin';
export { monthlyReset, expireInvitations } from './scheduled';
export { backfillEmailLower } from './backfill';
export {
  updateOrganizationSettings,
  renameOrganization,
  deleteOrganization,
  transferOwnership,
} from './organizations';
export { migrateBillingToOrg } from './migrations';
export {
  inviteMember,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  resendInvitation,
  previewInvitation,
} from './invitations';
export {
  removeMember,
  changeMemberRole,
  setMemberStatus,
  leaveOrganization,
} from './members';
export {
  createTeam,
  updateTeam,
  archiveTeam,
  deleteTeam,
  duplicateTeam,
  transferTeamManager,
  addTeamMembers,
  removeTeamMembers,
  setTeamMemberRole,
  moveTeamMembers,
  setTeamPermissions,
  createCustomPermission,
  deleteCustomPermission,
  updateTeamSettings,
  rotateApiKey,
} from './teams';
