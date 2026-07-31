import { useEffect, useRef, useState } from 'react';
import { DURATIONS } from '../lib/config';
import { useSimulation } from '../hooks/useSimulation';
import { ConversationTranscript } from '../lib/types';

function fmtClock(s: number) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Random "distraction" interruptions the agent must dismiss — mimics the noise
// of a real console (alerts, system prompts, banners).
interface Distraction {
  id: number;
  kind: 'alert' | 'popup' | 'banner';
  text: string;
  cta: string;
}
const DISTRACTION_POOL: Omit<Distraction, 'id'>[] = [
  { kind: 'alert', text: 'Zendesk Alert: The legacy CCs experience is going to be discontinued on October 28, 2026. Complete the migration prior to that date.', cta: 'Dismiss' },
  { kind: 'popup', text: 'Session notice: your status was set to Away due to inactivity. Set yourself back to Online to keep receiving chats.', cta: 'Set Online' },
  { kind: 'popup', text: 'A new version of the agent workspace is available. Reload when convenient to get the latest updates.', cta: 'Got it' },
  { kind: 'banner', text: 'Reminder: complete your daily QA acknowledgement before end of shift.', cta: 'Acknowledge' },
  { kind: 'popup', text: 'Supervisor ping: please confirm you have read the updated EIN SSN-retry policy.', cta: 'Confirm' },
];

export default function ChatSim({
  onDone,
}: {
  onDone: (data: {
    transcripts: ConversationTranscript[];
    responseTimesMs: number[];
    timeSpentSeconds: number;
    firstReplyOrder: string[];
    priorityById: Record<string, 'low' | 'medium' | 'high'>;
  }) => void;
}) {
  const sim = useSimulation(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [remaining, setRemaining] = useState(DURATIONS.chatSeconds);
  const [distraction, setDistraction] = useState<Distraction | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const distractionCounter = useRef(0);

  const joined = Object.values(sim.convos).filter((c) => c.joined);
  const active = activeId ? sim.convos[activeId] : null;

  useEffect(() => {
    if (!activeId && joined.length) {
      setActiveId(joined[0].persona.id);
      sim.markRead(joined[0].persona.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined.length]);

  useEffect(() => {
    const iv = setInterval(() => {
      const left = DURATIONS.chatSeconds - sim.elapsed();
      setRemaining(Math.max(0, left));
      if (left <= 0) finish();
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire a random distraction every 60–110s (only one at a time).
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const wait = 60000 + Math.random() * 50000;
      timer = window.setTimeout(() => {
        setDistraction((cur) => {
          if (cur) return cur; // don't stack
          const pick =
            DISTRACTION_POOL[
              Math.floor(Math.random() * DISTRACTION_POOL.length)
            ];
          distractionCounter.current += 1;
          return { ...pick, id: distractionCounter.current };
        });
        schedule();
      }, wait);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.turns.length, active?.typing]);

  function send() {
    if (!activeId || !draft.trim()) return;
    sim.sendAgentMessage(activeId, draft.trim());
    setDraft('');
  }

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    const transcripts: ConversationTranscript[] = Object.values(sim.convos)
      .filter((c) => c.joined)
      .map((c) => ({
        personaId: c.persona.id,
        personaName: c.persona.name,
        turns: c.turns,
        resolved: c.resolved,
      }));
    onDone({
      transcripts,
      responseTimesMs: sim.responseTimesMs,
      timeSpentSeconds: sim.elapsed(),
      firstReplyOrder: sim.firstReplyOrder.current,
      priorityById: sim.priorityById,
    });
  }

  return (
    <div className="flex h-screen flex-col bg-canvas text-ink">
      {/* Zendesk-style top alert bar (decorative) */}
      <div className="flex items-center gap-2 border-b border-line bg-[#FFF7E6] px-4 py-1.5 text-xs text-[#8A6D1B]">
        <span className="font-semibold">Zendesk Alert:</span>
        The legacy CCs experience is going to be discontinued on October 28,
        2026. Complete the migration prior to October 28, 2026.
        <span className="ml-auto flex items-center gap-3">
          <span className={remaining < 60 ? 'font-mono text-bad' : 'font-mono text-muted'}>
            Shift ends in {fmtClock(remaining)}
          </span>
          <button
            onClick={finish}
            className="rounded border border-line bg-surface px-2 py-0.5 font-medium text-ink hover:bg-canvas"
          >
            End &amp; submit
          </button>
        </span>
      </div>

      {/* Conversation tabs row */}
      <div className="flex items-center gap-1 border-b border-line bg-surface px-2 py-1.5">
        <span className="mr-2 grid h-6 w-6 place-items-center rounded bg-[#03363D] text-xs font-bold text-white">
          z
        </span>
        {joined.map((c) => (
          <button
            key={c.persona.id}
            onClick={() => {
              setActiveId(c.persona.id);
              sim.markRead(c.persona.id);
            }}
            className={`flex max-w-[220px] items-center gap-2 rounded-t border-b-2 px-3 py-1.5 text-sm ${
              activeId === c.persona.id
                ? 'border-primary bg-canvas'
                : 'border-transparent hover:bg-canvas'
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: c.resolved ? '#1FB47A' : c.persona.color }}
            />
            <span className="truncate">
              Conversation with {c.persona.name.split(' ')[0]}
            </span>
            {c.unread > 0 && activeId !== c.persona.id && (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {c.unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Three-panel body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr_280px]">
        {/* LEFT: ticket panel (decorative) */}
        <aside className="hidden overflow-y-auto border-r border-line bg-surface p-4 text-sm lg:block">
          {active && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded bg-good/15 px-2 py-0.5 text-[10px] font-bold uppercase text-good">
                  Open
                </span>
                <span className="text-xs text-muted">
                  Ticket #{active.persona.ticketId}
                </span>
              </div>
              <TicketField label="Brand" value="Customer Support" />
              <TicketField label="Requester" value={active.persona.name} />
              <TicketField label="Assignee" value="Customer Service" />
              <TicketField label="Form" value="Ticket Form" />
              <div className="mb-3">
                <div className="mb-1 text-xs font-semibold text-muted">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {['intent_confidence_high', 'language_en', 'sentiment_neutral'].map(
                    (t) => (
                      <span
                        key={t}
                        className="rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted"
                      >
                        {t}
                      </span>
                    )
                  )}
                </div>
              </div>
              <TicketField label="Supervisor Escalation" value="—" />
              <TicketField label="Ticket Type" value="Question" />
            </>
          )}
        </aside>

        {/* CENTER: conversation */}
        <section className="flex min-h-0 flex-col bg-canvas">
          {active ? (
            <>
              <div className="border-b border-line bg-surface px-4 py-2">
                <div className="font-display text-sm font-semibold">
                  Conversation with {active.persona.name}
                </div>
                <div className="text-xs text-muted">
                  Via messaging · Topic: {active.persona.topic} · Neutral
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {active.turns.map((t, i) => (
                  <div
                    key={i}
                    className={`flex ${t.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[15px] shadow-sm ${
                        t.role === 'agent'
                          ? 'rounded-br-sm bg-primary text-white'
                          : 'rounded-bl-sm border border-line bg-surface text-ink'
                      }`}
                    >
                      <div>{t.text}</div>
                      <div
                        className={`mt-1 text-[10px] ${t.role === 'agent' ? 'text-white/70' : 'text-muted'}`}
                      >
                        {fmtTime(t.ts)}
                      </div>
                    </div>
                  </div>
                ))}
                {active.typing && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm border border-line bg-surface px-3 py-3">
                      {[0, 0.15, 0.3].map((d) => (
                        <span
                          key={d}
                          className="mx-0.5 inline-block h-2 w-2 animate-dot rounded-full bg-muted"
                          style={{ animationDelay: `${d}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-line bg-surface p-3">
                <div className="mb-2 flex items-center gap-3 text-muted">
                  <span className="text-xs font-medium">Messaging</span>
                  <span className="text-sm">✕ T 🙂 🔗 📎</span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder={`Reply to ${active.persona.name.split(' ')[0]}…  (Enter to send)`}
                    className="max-h-40 flex-1 resize-none rounded-lg border border-line bg-white p-3 text-[15px] outline-none focus:border-primary"
                  />
                  <button
                    onClick={send}
                    disabled={!draft.trim()}
                    className="rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-40 hover:bg-primarySoft"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-muted">
              Waiting for the first customer…
            </div>
          )}
        </section>

        {/* RIGHT: customer info (decorative) */}
        <aside className="hidden overflow-y-auto border-l border-line bg-surface p-4 text-sm lg:block">
          {active && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: active.persona.color }}
                >
                  {active.persona.initials}
                </span>
                <span className="font-semibold">{active.persona.name}</span>
              </div>
              <InfoField label="Email" value={active.persona.email} />
              <InfoField label="Local time" value="Thu, 10:04 CST" />
              <InfoField label="Language" value="English (United States)" />
              <InfoField label="Notes" value="—" />
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted">
                  Device information
                </div>
                <div className="text-xs text-muted">Chrome · Windows · Desktop</div>
              </div>
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted">
                  Interaction history
                </div>
                <div className="space-y-1 text-xs text-muted">
                  <div>Conversation · Today</div>
                  <div>Conversation · Jul 06</div>
                  <div>Conversation · Jun 17</div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Distraction popup overlay */}
      {distraction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4">
          <div className="animate-pop w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl">
            <div className="mb-1 font-display text-sm font-bold">
              {distraction.kind === 'alert'
                ? 'System alert'
                : distraction.kind === 'banner'
                  ? 'Reminder'
                  : 'Notice'}
            </div>
            <p className="text-sm text-muted">{distraction.text}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDistraction(null)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primarySoft"
              >
                {distraction.cta}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="mb-0.5 text-xs font-semibold text-muted">{label}</div>
      <div className="rounded border border-line bg-canvas px-2 py-1 text-sm">
        {value}
      </div>
    </div>
  );
}
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <span className="text-xs text-muted">{label}: </span>
      <span className="break-words">{value}</span>
    </div>
  );
}
