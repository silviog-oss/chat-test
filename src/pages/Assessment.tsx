import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import TypingTest from '../components/TypingTest';
import ChatSim from '../components/ChatSim';
import { Spinner } from '../components/ui';
import {
  beginAttempt,
  completeAttempt,
  getAttemptStatus,
  saveResult,
} from '../lib/data';
import { scoreAssessment } from '../lib/scoring';
import { PASS_THRESHOLDS } from '../lib/config';
import {
  AssessmentResult,
  ConversationTranscript,
  TypingResult,
} from '../lib/types';

type Phase =
  | 'checking'
  | 'blocked'
  | 'typing'
  | 'chat'
  | 'scoring'
  | 'error'
  | 'done';

export default function Assessment() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [errMsg, setErrMsg] = useState('');
  const typingRef = useRef<TypingResult | null>(null);
  const started = useRef(false);

  // One-attempt guard: check + create the attempt doc before starting.
  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    (async () => {
      try {
        const { state } = await getAttemptStatus(user.uid);
        if (state === 'completed') {
          setPhase('blocked');
          return;
        }
        if (state === 'none') {
          await beginAttempt(
            user.uid,
            user.email ?? '',
            user.displayName ?? 'Candidate'
          );
        }
        setPhase('typing');
      } catch (e: any) {
        if (String(e?.message).includes('ALREADY_ATTEMPTED')) {
          setPhase('blocked');
        } else {
          setErrMsg(String(e?.message ?? e));
          setPhase('error');
        }
      }
    })();
  }, [user]);

  // Warn on tab switch during the assessment (pause protection)
  useEffect(() => {
    if (phase !== 'typing' && phase !== 'chat') return;
    const onHide = () => {
      // eslint-disable-next-line no-console
      if (document.hidden) console.warn('Tab switch detected during assessment');
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [phase]);

  async function handleChatDone(data: {
    transcripts: ConversationTranscript[];
    responseTimesMs: number[];
    timeSpentSeconds: number;
    firstReplyOrder: string[];
    priorityById: Record<string, 'low' | 'medium' | 'high'>;
  }) {
    if (!user) return;
    setPhase('scoring');
    try {
      // brief pause so the scoring screen registers (scoring itself is instant)
      await new Promise((r) => setTimeout(r, 900));
      const typing = typingRef.current!;
      const { categories, feedback } = scoreAssessment({
        transcripts: data.transcripts,
        responseTimesMs: data.responseTimesMs,
        firstReplyOrder: data.firstReplyOrder,
        priorityById: data.priorityById,
        typingWpm: typing.wpm,
        typingAccuracy: typing.accuracy,
      });

      const catTotal =
        categories.grammar +
        categories.typingSpeed +
        categories.responseSpeed +
        categories.professionalism +
        categories.tone +
        categories.empathy;

      const passed = catTotal >= PASS_THRESHOLDS.minOverall;

      const result: AssessmentResult = {
        uid: user.uid,
        name: user.displayName ?? 'Candidate',
        email: user.email ?? '',
        dateTaken: Date.now(),
        typing,
        categories,
        overall: catTotal,
        aiFeedback: feedback,
        transcripts: data.transcripts,
        timeSpentSeconds: data.timeSpentSeconds + typing.completionSeconds,
        passed,
      };

      await saveResult(result);
      await completeAttempt(user.uid);
      setPhase('done');
      setTimeout(() => nav('/dashboard'), 1200);
    } catch (e: any) {
      setErrMsg(String(e?.message ?? e));
      setPhase('error');
    }
  }

  if (phase === 'checking')
    return <Centered><Spinner label="Preparing your assessment…" /></Centered>;

  if (phase === 'blocked')
    return (
      <Centered>
        <div className="max-w-md text-center">
          <h2 className="font-display text-2xl font-bold">
            You've already completed this assessment
          </h2>
          <p className="mt-2 opacity-70">
            Each candidate gets one attempt. You can review your results on your
            dashboard.
          </p>
          <button
            onClick={() => nav('/dashboard')}
            className="mt-6 rounded-lg bg-primary px-5 py-2 font-medium text-white hover:bg-primarySoft"
          >
            View my results
          </button>
        </div>
      </Centered>
    );

  if (phase === 'error')
    return (
      <Centered>
        <div className="max-w-md text-center">
          <h2 className="font-display text-2xl font-bold text-bad">
            Something went wrong
          </h2>
          <p className="mt-2 break-words opacity-70">{errMsg}</p>
          <button
            onClick={() => nav('/')}
            className="mt-6 rounded-lg border border-line px-5 py-2 font-medium hover:bg-line/30"
          >
            Back to start
          </button>
        </div>
      </Centered>
    );

  if (phase === 'scoring')
    return (
      <Centered>
        <Spinner label="Scoring your responses… this takes a moment." />
      </Centered>
    );

  if (phase === 'done')
    return <Centered><Spinner label="Saved. Redirecting…" /></Centered>;

  if (phase === 'typing')
    return (
      <div className="p-6">
        <TypingTest
          onDone={(r) => {
            typingRef.current = r;
            setPhase('chat');
          }}
        />
      </div>
    );

  return <ChatSim onDone={handleChatDone} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-6">{children}</div>;
}
