// ---------------------------------------------------------------------------
// App configuration
// ---------------------------------------------------------------------------
// Admin emails are ALSO enforced in Firestore rules. Editing this list only
// changes the UI; it does not grant real access on its own. Keep this list in
// sync with firestore.rules.
export const ADMIN_EMAILS: string[] = [
  'diana.o@incfile.com',
  'silvio.g@incfile.com',
];

export const APP_VERSION = 'v7.0.0';

export const PASS_THRESHOLDS = {
  minWpm: 45,
  minAccuracy: 95, // percent
  minOverall: 70, // percent, overall assessment pass mark
};

export const DURATIONS = {
  typingSeconds: 1 * 60,
  chatSeconds: 15 * 60,
};

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}
