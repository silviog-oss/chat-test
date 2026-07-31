import { useEffect, useMemo, useRef, useState } from 'react';
import { DURATIONS } from '../lib/config';
import { TypingResult } from '../lib/types';
import { Card } from './ui';

const WORD_BANK =
  `the customer needs help with an order that never arrived please check the account and confirm the shipping address before issuing any refund thank you for your patience while we look into this issue right away and resolve it quickly for you today with care and accuracy across every single conversation you handle on the support floor`.split(
    ' '
  );

function makeWords(n: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++)
    out.push(WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)]);
  return out.join(' ');
}

export default function TypingTest({
  onDone,
}: {
  onDone: (r: TypingResult) => void;
}) {
  const target = useMemo(() => makeWords(220), []);
  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(DURATIONS.typingSeconds);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef(false);

  // Refs mirror the latest values so finish() never reads stale closure state.
  const typedRef = useRef('');
  const startedRef = useRef<number | null>(null);
  useEffect(() => {
    typedRef.current = typed;
  }, [typed]);
  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Timer only runs once typing has started.
  useEffect(() => {
    if (started === null) return;
    const iv = setInterval(() => {
      const left =
        DURATIONS.typingSeconds - Math.floor((Date.now() - started) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) finish();
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Live display values (safe; only for showing on screen).
  const correctChars = useMemo(() => {
    let c = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) c++;
    return c;
  }, [typed, target]);
  const liveAccuracy = typed.length ? (correctChars / typed.length) * 100 : 100;
  const liveElapsedMin = started ? (Date.now() - started) / 60000 : 0;
  const liveWpm =
    liveElapsedMin > 0 ? Math.round((typed.length / 5) / liveElapsedMin) : 0;

  // finish() recomputes everything FRESH from refs at call time.
  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;

    const t = typedRef.current;
    const startTs = startedRef.current;
    const elapsedSec = startTs ? (Date.now() - startTs) / 1000 : 0;
    const elapsedMin = elapsedSec / 60;

    // Correct characters recomputed fresh.
    let correct = 0;
    for (let i = 0; i < t.length; i++) if (t[i] === target[i]) correct++;

    const wpm = elapsedMin > 0 ? Math.round((t.length / 5) / elapsedMin) : 0;
    const accuracy = t.length ? (correct / t.length) * 100 : 0;

    onDone({
      wpm,
      accuracy: Math.round(accuracy * 10) / 10,
      completionSeconds: Math.round(elapsedSec),
    });
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Section 1 · Typing</h2>
        <div className="flex items-center gap-4 font-mono text-sm">
          <span>WPM {liveWpm}</span>
          <span>ACC {liveAccuracy.toFixed(0)}%</span>
          <span className={remaining < 15 ? 'text-bad' : ''}>
            {mm}:{ss}
          </span>
        </div>
      </div>

      {started === null && (
        <div className="rounded-lg bg-primary/10 px-4 py-2 text-sm text-primaryInk">
          Start typing the text below — the timer begins on your first keystroke.
        </div>
      )}

      <Card>
        <p className="select-none font-mono text-[15px] leading-7">
          {target.split('').map((ch, i) => {
            let cls = 'opacity-40';
            if (i < typed.length)
              cls =
                typed[i] === ch
                  ? 'text-good opacity-100'
                  : 'text-bad underline decoration-bad';
            else if (i === typed.length) cls = 'bg-primary/30 opacity-100';
            return (
              <span key={i} className={cls}>
                {ch}
              </span>
            );
          })}
        </p>
      </Card>

      <textarea
        ref={inputRef}
        value={typed}
        onChange={(e) => {
          const v = e.target.value;
          if (started === null && v.length > 0) {
            const now = Date.now();
            setStarted(now);
            startedRef.current = now;
          }
          if (v.length <= target.length) setTyped(v);
        }}
        rows={4}
        placeholder="Start typing to begin the timer…"
        className="w-full resize-none rounded-xl border border-line bg-white p-4 font-mono text-[15px] leading-7 outline-none"
      />

      <div className="flex justify-end">
        <button
          onClick={finish}
          className="rounded-lg bg-primary px-5 py-2 font-medium text-white hover:bg-primarySoft"
        >
          Finish typing test
        </button>
      </div>
    </div>
  );
}
