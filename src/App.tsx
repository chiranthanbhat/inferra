import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { VerifyEmail } from './pages/VerifyEmail';
import { PlanSelection } from './pages/PlanSelection';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { CursorGlow } from './components/ui/CursorGlow';
import { useStore } from './store/useStore';
import { useAuth } from './lib/auth';
import { useOrganization } from './lib/orgContext';
import { useTeamAccess } from './lib/teamAccess';
import { useToast } from './lib/toast';
import { acceptInvitationServer } from './lib/functions';
import { resolveView } from './lib/authGuards';

// ---- URL routing ("/" ↔ landing, "/dashboard" ↔ dashboard) ----
// The resolver stays the single gate; the URL mirrors the RESOLVED view so it
// can never disagree with what's on screen, and guards can't be bypassed by
// typing a path. Auth/verify/onboarding all live under the "/dashboard" area
// (they are steps toward it); only the public landing page owns "/".
function pathForResolved(view: string): string {
  if (view === 'landing') return '/';
  if (view === 'auth') return '/auth';
  return '/dashboard'; // dashboard, verify, onboarding, profile-loading, plans, loading
}
function viewForPath(path: string): 'landing' | 'dashboard' | 'auth' {
  if (path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/auth')) return 'auth';
  return 'landing';
}

function FullScreenLoader({ label = 'Loading Inferra…' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-ink-3 text-sm tracking-wide">{label}</p>
      </div>
    </div>
  );
}

export default function App() {
  const { firebaseUser, authReady, devMode } = useAuth();
  const { user, currentView, plansOpen, plansMode, pendingInvite, setPendingInvite, setCurrentView } = useStore();
  const { refreshMemberships } = useOrganization();
  const { refreshAccess } = useTeamAccess();
  const toast = useToast();
  const acceptingRef = useRef(false);

  // ---- boot: read the URL once (path + invitation deep link) ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get('invite');
    const token = params.get('token');
    if (inviteId && token) {
      setPendingInvite({ invitationId: inviteId, token });
      // Strip the token from the address bar; the invite context lives in state.
      window.history.replaceState({}, '', '/auth');
      setCurrentView('auth'); // invitees go straight to sign-in/sign-up
      return;
    }
    // "/" is landing (public, even when authenticated); any other path is the
    // in-app area. The resolver decides auth-vs-dashboard from there.
    setCurrentView(viewForPath(window.location.pathname) === 'landing' ? 'landing' : 'dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- once signed in, leave the auth screen for the workspace ----
  useEffect(() => {
    if (user && currentView === 'auth') setCurrentView('dashboard');
  }, [user, currentView, setCurrentView]);

  // ---- back/forward: map the browser path back to a view ----
  useEffect(() => {
    const onPop = () => setCurrentView(viewForPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setCurrentView]);

  // ---- invitation auto-accept: fires once the invitee is signed in ----
  // The server re-verifies token, email match, expiry, org and team before
  // joining; a wrong-account sign-in surfaces the server's rejection message.
  useEffect(() => {
    if (!pendingInvite || !user || devMode || acceptingRef.current) return;
    if (firebaseUser && !firebaseUser.emailVerified) return; // verify first
    acceptingRef.current = true;
    (async () => {
      try {
        await acceptInvitationServer(pendingInvite.invitationId);
        toast({ title: 'Invitation accepted', description: 'Welcome aboard — your teams and role are ready.', variant: 'success' });
        await Promise.allSettled([refreshMemberships(), refreshAccess()]);
        setCurrentView('dashboard');
      } catch (e: any) {
        toast({ title: 'Could not accept invitation', description: e?.message, variant: 'error', duration: 8000 });
      } finally {
        setPendingInvite(null);
        acceptingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite, user?.id, firebaseUser?.emailVerified]);

  // All routing decisions live in one pure resolver so the flow can't diverge
  // between renders (this is what killed the previous flicker where a signed-in
  // unverified user briefly saw the dashboard).
  const decision = resolveView(
    { authReady, firebaseUser, user, devMode, currentView, plansOpen },
    plansMode,
  );

  // Mirror the RESOLVED view into the address bar (so /dashboard, /auth and /
  // always match what's shown). Skip transient loading states.
  useEffect(() => {
    if (decision.view === 'loading' || decision.view === 'profile-loading') return;
    const path = pathForResolved(decision.view);
    if (window.location.pathname !== path) window.history.pushState({ v: decision.view }, '', path);
  }, [decision.view]);

  // Loaders render OUTSIDE the AnimatePresence tree. The boot sequence can flip
  // loading → dashboard within the first commit, and an exit animation that
  // starts and dies in that same tick stalls mode="wait" forever (framer-motion
  // + StrictMode). Loading screens don't need exit animations — skip them.
  if (decision.view === 'loading') {
    return (<><CursorGlow /><FullScreenLoader label={decision.label} /></>);
  }
  if (decision.view === 'profile-loading') {
    return (<><CursorGlow /><FullScreenLoader label="Preparing your workspace…" /></>);
  }

  let viewKey: string;
  let view: React.ReactNode;

  switch (decision.view) {
    case 'plans':
      viewKey = 'plans';
      view = <PlanSelection mode={decision.mode} />;
      break;
    case 'landing':
      viewKey = 'landing';
      view = <LandingPage />;
      break;
    case 'auth':
      viewKey = 'auth';
      view = <AuthPage />;
      break;
    case 'verify':
      viewKey = 'verify';
      view = <VerifyEmail />;
      break;
    case 'onboarding':
      viewKey = 'onboarding';
      view = <PlanSelection mode="onboarding" />;
      break;
    case 'dashboard':
    default:
      viewKey = 'dashboard';
      view = <DashboardLayout />;
      break;
  }

  // NOTE: no `mode="wait"`. With heavy full-screen views under React 19 Strict
  // Mode, waiting for the outgoing view's exit animation intermittently stalls
  // (the exit starts and never resolves), leaving the old view mounted forever
  // — it bit the loader flow, the login flow and the logo→home flow. A plain
  // keyed fade-in (no blocking exit) transitions reliably; each view fills the
  // screen so there's no visible overlap.
  return (
    <>
      <CursorGlow />
      <AnimatePresence>
        <motion.div
          key={viewKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {view}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
