import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase Configuration
// In production, these would be environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "inferra-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "inferra-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "inferra-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abc123"
};

// Initialize Firebase (prevent re-initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Auth Providers
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Auth Functions
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await createOrUpdateUserDocument(result.user);
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createOrUpdateUserDocument(result.user);
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await createOrUpdateUserDocument(result.user, { name });
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// User Document Management
async function createOrUpdateUserDocument(user: FirebaseUser, additionalData?: Record<string, any>) {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Create new user with default organization
    const orgId = `org_${user.uid}`;
    
    // Create organization first
    await setDoc(doc(db, 'organizations', orgId), {
      id: orgId,
      name: `${user.displayName || user.email}'s Organization`,
      ownerId: user.uid,
      plan: 'free',
      planLimits: {
        requestsPerMonth: 100,
        usersLimit: 1,
        teamsLimit: 1
      },
      usage: {
        requestsUsed: 0,
        totalSpend: 0,
        totalSavings: 0,
        tokensProcessed: 0
      },
      settings: {
        defaultModel: 'gpt-4o-mini',
        enableOptimization: true,
        enableRouting: true,
        enableGovernance: true,
        piiPolicy: 'sanitize',
        secretPolicy: 'block'
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Create user document
    await setDoc(userRef, {
      id: user.uid,
      email: user.email,
      name: user.displayName || additionalData?.name || 'User',
      photoURL: user.photoURL,
      organizationId: orgId,
      role: 'owner',
      teamIds: [],
      isAdmin: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    });
  } else {
    // Update last login
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

// Firestore Helper Functions
export async function getUserData(userId: string) {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? userDoc.data() : null;
}

export async function getOrganization(orgId: string) {
  const orgDoc = await getDoc(doc(db, 'organizations', orgId));
  return orgDoc.exists() ? orgDoc.data() : null;
}

export async function updateOrganization(orgId: string, data: Record<string, any>) {
  await updateDoc(doc(db, 'organizations', orgId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

// Request Tracking
export async function saveRequest(orgId: string, userId: string, requestData: any) {
  const requestRef = await addDoc(collection(db, 'requests'), {
    organizationId: orgId,
    userId,
    ...requestData,
    createdAt: serverTimestamp()
  });

  // Update organization usage
  await updateDoc(doc(db, 'organizations', orgId), {
    'usage.requestsUsed': increment(1),
    'usage.totalSpend': increment(requestData.actualCost || 0),
    'usage.totalSavings': increment(requestData.savings || 0),
    'usage.tokensProcessed': increment(requestData.totalTokens || 0),
    updatedAt: serverTimestamp()
  });

  return requestRef.id;
}

export async function getRequests(orgId: string, limitCount: number = 50) {
  const q = query(
    collection(db, 'requests'),
    where('organizationId', '==', orgId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Analytics
export async function getAnalytics(orgId: string, startDate: Date, endDate: Date) {
  const q = query(
    collection(db, 'requests'),
    where('organizationId', '==', orgId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Team Management
export async function createTeam(orgId: string, teamData: any) {
  const teamRef = await addDoc(collection(db, 'teams'), {
    organizationId: orgId,
    ...teamData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return teamRef.id;
}

export async function getTeams(orgId: string) {
  const q = query(
    collection(db, 'teams'),
    where('organizationId', '==', orgId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Governance Events
export async function logGovernanceEvent(orgId: string, userId: string, eventData: any) {
  await addDoc(collection(db, 'governanceEvents'), {
    organizationId: orgId,
    userId,
    ...eventData,
    createdAt: serverTimestamp()
  });
}

// Audit Logs
export async function createAuditLog(orgId: string, userId: string, action: string, details: any) {
  await addDoc(collection(db, 'auditLogs'), {
    organizationId: orgId,
    userId,
    action,
    details,
    createdAt: serverTimestamp()
  });
}

export { Timestamp };
