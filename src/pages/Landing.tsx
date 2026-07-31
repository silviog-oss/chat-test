import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/ui';
import { DURATIONS, PASS_THRESHOLDS, APP_VERSION } from '../lib/config';

export default function Landing() {
  const { user, signIn, isAdmin } = useAuth();
  const nav = useNavigate();
  const mins = Math.round(
    (DURATIONS.typingSeconds + DURATIONS.chatSeconds) / 60
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        {user ? (
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => nav('/admin')}
                className="text-sm font-medium text-muted hover:text-ink"
              >
                Admin
              </button>
            )}
            <button
              onClick={() => nav('/dashboard')}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primarySoft"
            >
              My dashboard
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm hover:border-primary/50"
          >
            <GoogleGlyph /> Sign in with Google
          </button>
        )}
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-6">
        <section className="grid items-center gap-12 py-14 md:grid-cols-2 md:py-20">
          <div className="animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-display text-xs font-semibold uppercase tracking-wide text-primaryInk">
              Bizee Customer Support · Hiring Assessment
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.1] text-ink md:text-5xl">
              Join the Bizee{' '}
              <span className="text-primary">support chat</span> team.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted">
              This is a short, realistic trial for candidates applying to our
              live chat support team. You'll handle several customers at once —
              just like a real shift — so we can see how you prioritize, stay
              professional, and keep every customer moving. About {mins}{' '}
              minutes, one attempt.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {user ? (
                <button
                  onClick={() => nav('/assessment')}
                  className="rounded-full bg-primary px-7 py-3 font-display font-semibold text-white shadow-md transition-transform hover:scale-[1.02] hover:bg-primarySoft"
                >
                  Start assessment
                </button>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-display font-semibold text-white shadow-md transition-transform hover:scale-[1.02] hover:bg-primarySoft"
                >
                  <GoogleGlyph light /> Start with Google
                </button>
              )}
              <span className="text-sm text-muted">
                Sign in with your Google account to begin.
              </span>
            </div>
          </div>

          {/* Live chat preview card */}
          <div className="animate-rise rounded-3xl border border-line bg-surface p-5 shadow-lg [animation-delay:120ms]">
            <div className="mb-3 flex items-center justify-between border-b border-line pb-3">
              <span className="font-display text-sm font-semibold">
                Live chat — preview
              </span>
              <span className="flex items-center gap-1.5 text-xs text-good">
                <span className="h-2 w-2 rounded-full bg-good" /> 3 active
              </span>
            </div>
            <div className="space-y-2.5 text-sm">
              <Bubble name="Marcus" text="I never got my confirmation email." />
              <Bubble
                name="Tré"
                text="I'm being charged twice — fix this ASAP."
                urgent
              />
              <Bubble
                name="You"
                text="Hi Tré, I see the duplicate charge. Let me help right away."
                agent
              />
              <div className="pl-1 text-xs italic text-muted">
                Priya joined the queue…
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-10">
          <h2 className="font-display text-2xl font-bold">How it works</h2>
          <p className="mt-1 text-muted">Two parts, back to back.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Step
              n="1"
              title="Typing test"
              time={`${Math.round(DURATIONS.typingSeconds / 60)} min`}
              body={`A quick typing check with live speed and accuracy. We look for around ${PASS_THRESHOLDS.minWpm} words per minute at ${PASS_THRESHOLDS.minAccuracy}% accuracy.`}
            />
            <Step
              n="2"
              title="Live multi-chat"
              time={`${Math.round(DURATIONS.chatSeconds / 60)} min`}
              body="Several customers message you over time, each with a different mood and urgency. Keep them all moving, solve their problems, and stay professional under pressure."
            />
          </div>
        </section>

        {/* What we look for */}
        <section className="pb-20">
          <div className="rounded-3xl border border-line bg-surface p-8 shadow-sm">
            <h2 className="font-display text-xl font-bold">What we look for</h2>
            <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ['Speed', 'Replying promptly without leaving anyone waiting.'],
                ['Professional tone', 'Warm, clear, and courteous in every message.'],
                ['Accuracy', 'Correct answers that follow company policy.'],
                ['Prioritization', 'Handling the urgent customers first.'],
                ['Juggling', 'Managing several conversations at once.'],
                ['Empathy', 'Understanding how the customer feels.'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <p className="text-sm">
                    <span className="font-semibold">{t}. </span>
                    <span className="text-muted">{d}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted">
          <span>Chatline — Bizee Customer Support Assessment</span>
          <span className="flex items-center gap-3">
            <span className="rounded-full bg-canvas px-2 py-0.5 font-mono text-xs">
              {APP_VERSION}
            </span>
            <span>
              powered by <span className="font-semibold text-primary">bizee</span>
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Step({
  n,
  title,
  time,
  body,
}: {
  n: string;
  title: string;
  time: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary font-display text-sm font-bold text-white">
          {n}
        </span>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <span className="ml-auto rounded-full bg-canvas px-3 py-1 text-xs font-medium text-muted">
          {time}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted">{body}</p>
    </div>
  );
}

function Bubble({
  name,
  text,
  urgent,
  agent,
}: {
  name: string;
  text: string;
  urgent?: boolean;
  agent?: boolean;
}) {
  return (
    <div className={`flex ${agent ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
          agent
            ? 'rounded-br-sm bg-primary text-white'
            : urgent
              ? 'rounded-bl-sm bg-bad/10 text-ink'
              : 'rounded-bl-sm bg-canvas text-ink'
        }`}
      >
        <span
          className={`mr-1 text-xs font-semibold ${agent ? 'text-white/80' : 'text-muted'}`}
        >
          {name}:
        </span>
        {text}
      </div>
    </div>
  );
}

function GoogleGlyph({ light }: { light?: boolean }) {
  return (
    <span
      className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${
        light ? 'bg-white text-primary' : 'bg-primary text-white'
      }`}
    >
      G
    </span>
  );
}
