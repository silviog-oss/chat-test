import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { AssessmentResult, AttemptStatus } from './types';

// ---- Attempts (one per candidate; existence = "already started") ----------

export async function getAttemptStatus(
  uid: string
): Promise<{ state: 'none' | AttemptStatus }> {
  const snap = await getDoc(doc(db, 'attempts', uid));
  if (!snap.exists()) return { state: 'none' };
  return { state: (snap.data().status as AttemptStatus) ?? 'in_progress' };
}

// Throws 'ALREADY_ATTEMPTED' if a doc already exists. The Firestore rules
// enforce the same guard, so this cannot be bypassed by tampering the client.
export async function beginAttempt(
  uid: string,
  email: string,
  name: string
): Promise<void> {
  const ref = doc(db, 'attempts', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error('ALREADY_ATTEMPTED');
  await setDoc(ref, {
    uid,
    email,
    name,
    status: 'in_progress' as AttemptStatus,
    startedAt: serverTimestamp(),
  });
}

export async function completeAttempt(uid: string): Promise<void> {
  await updateDoc(doc(db, 'attempts', uid), {
    status: 'completed' as AttemptStatus,
    completedAt: serverTimestamp(),
  });
}

// ---- Results ---------------------------------------------------------------

export async function saveResult(result: AssessmentResult): Promise<void> {
  // Written once; rules make it immutable to the candidate afterward.
  await setDoc(doc(db, 'results', result.uid), result);
}

export async function getMyResult(
  uid: string
): Promise<AssessmentResult | null> {
  const snap = await getDoc(doc(db, 'results', uid));
  return snap.exists() ? (snap.data() as AssessmentResult) : null;
}

// ---- Admin -----------------------------------------------------------------

export async function getAllResults(): Promise<AssessmentResult[]> {
  const snap = await getDocs(collection(db, 'results'));
  return snap.docs.map((d) => d.data() as AssessmentResult);
}

export async function deleteResult(uid: string): Promise<void> {
  // Deleting a result also frees the attempt so the candidate could be
  // re-invited. Admin-only per rules.
  await deleteDoc(doc(db, 'results', uid));
  await deleteDoc(doc(db, 'attempts', uid));
}
