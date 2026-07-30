import { useEffect, useRef, useState } from 'react';
import { DURATIONS } from '../lib/config';
import { useSimulation } from '../hooks/useSimulation';
import { ConversationTranscript } from '../lib/types';
import { Avatar, PriorityBadge } from './ui';

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
  const endRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  const joined = Object.values(sim.convos).filter((c) => c.joined);
  const active = activeId ? sim.convos[activeId] : null;

  // Auto-select first conversation
  useEffect(() => {
    if (!activeId && joined.length) {
      setActiveId(joined[0].persona.id);
      sim.markRead(joined[0].persona.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined.length]);

  // Countdown
  useEffect(() => {
    const iv = setInterval(() => {
      const left = DURATIONS.chatSeconds - sim.elapsed();
      setRemaining(Math.max(0, left));
      if (left <= 0) finish();
    }, 500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoscroll on new messages / typing
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
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 className="font-display font-bold">Section 2 · Live chat</h2>
        <div className="flex items-center gap-4">
          <span
            className={`font-mono text-sm ${remaining < 60 ? 'text-bad' : ''}`}
          >
            {fmtClock(remaining)}
          </span>
          <button
            onClick={finish}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line/40"
          >
            End & submit
          </button>
        </div>
      </div>

      {/* supervisor announcements — persistent */}
      {sim.supervisorNotes.map((n, i) => (
        <div
          key={i}
          className="animate-slidein border-b border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn"
        >
          <span className="font-semibold">Supervisor:</span> {n.text}
        </div>
      ))}

      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr]">
        {/* conversation list */}
        <aside className="hidden overflow-y-auto border-r border-line md:block">
          {joined.map((c) => (
            <button
              key={c.persona.id}
              onClick={() => {
                setActiveId(c.persona.id);
                sim.markRead(c.persona.id);
              }}
              className={`flex w-full items-center gap-3 border-b border-line/60 px-3 py-3 text-left transition-colors ${
                activeId === c.persona.id ? 'bg-primary/10' : 'hover:bg-line/20'
              }`}
            >
              <Avatar initials={c.persona.initials} color={c.persona.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c.persona.name}</span>
                  <PriorityBadge priority={c.persona.priority} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs opacity-60">
                    {c.resolved
                      ? 'Resolved'
                      : c.turns[c.turns.length - 1]?.text ?? ''}
                  </span>
                  {c.unread > 0 && activeId !== c.persona.id && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </aside>

        {/* active conversation */}
        <section className="flex min-h-0 flex-col">
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-2">
                <Avatar
                  initials={active.persona.initials}
                  color={active.persona.color}
                  size={30}
                />
                <span className="font-medium">{active.persona.name}</span>
                <PriorityBadge priority={active.persona.priority} />
                {active.resolved && (
                  <span className="ml-auto text-xs text-good">● Resolved</span>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {active.turns.map((t, i) => (
                  <div
                    key={i}
                    className={`flex ${t.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] animate-pop rounded-2xl px-3 py-2 text-[15px] ${
                        t.role === 'agent'
                          ? 'rounded-br-sm bg-primary text-white'
                          : 'rounded-bl-sm bg-line/50'
                      }`}
                    >
                      <div>{t.text}</div>
                      <div className="mt-1 text-[10px] opacity-60">
                        {fmtTime(t.ts)}
                      </div>
                    </div>
                  </div>
                ))}
                {active.typing && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-line/50 px-3 py-3">
                      <span className="mx-0.5 inline-block h-2 w-2 animate-dot rounded-full bg-current" />
                      <span
                        className="mx-0.5 inline-block h-2 w-2 animate-dot rounded-full bg-current"
                        style={{ animationDelay: '.15s' }}
                      />
                      <span
                        className="mx-0.5 inline-block h-2 w-2 animate-dot rounded-full bg-current"
                        style={{ animationDelay: '.3s' }}
                      />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="flex items-end gap-2 border-t border-line p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={`Reply to ${active.persona.name}…  (Enter to send)`}
                  className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-white p-3 outline-none dark:bg-slate1"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim()}
                  className="rounded-xl bg-primary px-4 py-3 font-medium text-white disabled:opacity-40 hover:bg-primarySoft"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center opacity-50">
              Waiting for the first customer…
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
