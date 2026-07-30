import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/ui';
import { DURATIONS } from '../lib/config';

export default function Landing() {
  const { user, signIn, isAdmin } = useAuth();
  const nav = useNavigate();
  const mins = Math.round(
    (DURATIONS.typingSeconds + DURATIONS.chatSeconds) / 60
  );

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        {user ? (
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => nav('/admin')}
                className="text-sm font-medium opacity-80 hover:opacity-100"
              >
                Admin
              </button>
            )}
            <button
              onClick={() => nav('/dashboard')}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primarySoft"
            >
              My dashboard
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-line/30"
          >
            <GoogleGlyph /> Sign in with Google
          </button>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="grid items-center gap-10 py-16 md:grid-cols-2">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
              Support hiring assessment
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.1] md:text-5xl">
              Can you run five chats at once without dropping a customer?
            </h1>
            <p className="mt-5 max-w-md text-lg opacity-75">
              A realistic live-chat trial. Type under pressure, then juggle
              real, unscripted customers — each one reacts to exactly what you
              say. About {mins} minutes, one attempt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <button
                  onClick={() => nav('/assessment')}
                  className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primarySoft"
                >
                  Start assessment
                </button>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primarySoft"
                >
                  <GoogleGlyph light /> Start with Google
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white/60 p-5 dark:bg-slate1/60">
            <div className="space-y-3 text-sm">
              <ConsoleLine name="Marcus" text="I never got my confirmation email." />
              <ConsoleLine name="Tré" text="I'm being charged twice — fix this ASAP." urgent />
              <ConsoleLine name="You" text="Hi Tré, I see the duplicate charge. Let me help." agent />
              <div className="pl-2 opacity-50">Priya joined the queue…</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-20 md:grid-cols-2">
          <Step
            n="01"
            title="Typing test · 5 min"
            body="Auto-generated text with live WPM, accuracy, and error highlighting. We recommend 45 WPM at 95% accuracy."
          />
          <Step
            n="02"
            title="Live multi-chat · 15 min"
            body="Multiple customers arrive over time with different moods and urgency. Prioritize, stay professional, and keep everyone moving."
          />
        </section>
      </main>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line p-5">
      <span className="font-mono text-sm text-primary">{n}</span>
      <h3 className="mt-1 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm opacity-70">{body}</p>
    </div>
  );
}

function ConsoleLine({
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
    <div className={`flex gap-2 ${agent ? 'justify-end text-right' : ''}`}>
      <div
        className={`rounded-lg px-3 py-2 ${
          agent ? 'bg-primary text-white' : urgent ? 'bg-bad/15' : 'bg-line/40'
        }`}
      >
        <span className="mr-1 text-xs font-semibold opacity-70">{name}:</span>
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
