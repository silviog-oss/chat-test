import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getMyResult } from '../lib/data';
import { Logo, Spinner } from '../components/ui';

// Candidates do NOT see their scores, feedback, or transcript. Once they have
// completed the assessment, they simply see a confirmation that it was
// submitted. All evaluation is visible to admins only.
export default function CandidateDashboard() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [submitted, setSubmitted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyResult(user.uid)
      .then((r) => setSubmitted(!!r))
      .catch(() => setSubmitted(false));
  }, [user]);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-60">{user?.email}</span>
          <button
            onClick={() => signOut().then(() => nav('/'))}
            className="rounded-lg border border-line px-3 py-1.5 hover:bg-line/30"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-16">
        {submitted === null ? (
          <Spinner label="Loading…" />
        ) : submitted ? (
          <div className="rounded-xl border border-line p-10 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-good/15 text-good text-2xl">
              ✓
            </div>
            <h1 className="font-display text-2xl font-bold">Submitted</h1>
            <p className="mt-2 opacity-70">
              Your assessment has been submitted. Thank you for completing it.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-line p-10 text-center">
            <h1 className="font-display text-2xl font-bold">
              You haven't completed the assessment yet
            </h1>
            <button
              onClick={() => nav('/assessment')}
              className="mt-6 rounded-lg bg-primary px-5 py-2 font-medium text-white hover:bg-primarySoft"
            >
              Start assessment
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
