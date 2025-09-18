import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../firebase';
import { getIdTokenResult } from 'firebase/auth';

export async function setAdminRole(email, makeAdmin) {
  const functions = getFunctions();
  const setAdminRoleFn = httpsCallable(functions, 'setAdminRole');
  const res = await setAdminRoleFn({ email, makeAdmin });
  return res.data;
}

export async function refreshTokenAndCheckAdmin() {
  if (!auth.currentUser) return false;
  await auth.currentUser.getIdToken(true);
  const idTokenResult = await getIdTokenResult(auth.currentUser);
  return !!(idTokenResult && idTokenResult.claims && idTokenResult.claims.admin);
}
