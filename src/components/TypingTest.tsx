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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (started === null) return;
    const iv = setInterval(() => {
      const left = DURATIONS.typingSeconds - Math.floor((Date.now() - started) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) finish();
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const correctChars = useMemo(() => {
    let c = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === target[i]) c++;
    return c;
  }, [typed, target]);

  const accuracy = typed.length ? (correctChars / typed.length) * 100 : 100;
  const elapsedMin = started ? (Date.now() - started) / 60000 : 0;
  const wpm = elapsedMin > 0 ? Math.round(typed.length / 5 / elapsedMin) : 0;

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    const completionSeconds = started
      ? Math.round((Date.now() - started) / 1000)
      : 0;
    onDone({
      wpm,
      accuracy: Math.round(accuracy * 10) / 10,
      completionSeconds,
    });
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Section 1 · Typing</h2>
        <div className="flex items-center gap-4 font-mono text-sm">
          <span>WPM {wpm}</span>
          <span>ACC {accuracy.toFixed(0)}%</span>
          <span className={remaining < 30 ? 'text-bad' : ''}>
            {mm}:{ss}
          </span>
        </div>
      </div>

      <Card>
        <p className="select-none font-mono text-[15px] leading-7">
          {target.split('').map((ch, i) => {
            let cls = 'opacity-40';
            if (i < typed.length)
              cls = typed[i] === ch ? 'text-good opacity-100' : 'text-bad underline decoration-bad';
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
          if (started === null && e.target.value.length > 0)
            setStarted(Date.now());
          if (e.target.value.length <= target.length)
            setTyped(e.target.value);
        }}
        rows={4}
        placeholder="Start typing to begin the timer…"
        className="w-full resize-none rounded-xl border border-line bg-white p-4 font-mono text-[15px] leading-7 outline-none dark:bg-slate1"
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
