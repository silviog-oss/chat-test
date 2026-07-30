import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getMyResult } from '../lib/data';
import { AssessmentResult } from '../lib/types';
import { Logo, Spinner } from '../components/ui';
import ScoreReport from '../components/ScoreReport';

export default function CandidateDashboard() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMyResult(user.uid)
      .then(setResult)
      .finally(() => setLoading(false));
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

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-6 font-display text-3xl font-bold">Your results</h1>
        {loading ? (
          <Spinner label="Loading…" />
        ) : result ? (
          <ScoreReport r={result} />
        ) : (
          <div className="rounded-xl border border-line p-8 text-center">
            <p className="opacity-70">You haven't completed the assessment yet.</p>
            <button
              onClick={() => nav('/assessment')}
              className="mt-4 rounded-lg bg-primary px-5 py-2 font-medium text-white hover:bg-primarySoft"
            >
              Start assessment
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
