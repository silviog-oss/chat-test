import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PERSONAS,
  TIMED_EVENTS,
  CustomerPersona,
  detectSignals,
  SPEED_DELAYS,
} from '../lib/personas';
import { ChatTurn } from '../lib/types';

export interface Conversation {
  persona: CustomerPersona;
  joined: boolean;
  turns: ChatTurn[];
  unread: number;
  resolved: boolean;
  typing: boolean;
  stepIndex: number; // which scenario step we're waiting on
  nudgeIndex: number; // which varied nudge line to use next
  frustration: number; // impatience escalation counter
  lastActivityTs: number; // last message either side, for impatience timing
}

export interface SupervisorNote {
  text: string;
  ts: number;
}

export function useSimulation(active: boolean) {
  const startTsRef = useRef<number>(Date.now());
  const [convos, setConvos] = useState<Record<string, Conversation>>(() => {
    const init: Record<string, Conversation> = {};
    for (const p of PERSONAS) {
      const joinedNow = p.joinAtSeconds === 0;
      init[p.id] = {
        persona: p,
        joined: joinedNow,
        turns: joinedNow
          ? [{ role: 'customer', text: p.openingMessage, ts: Date.now() }]
          : [],
        unread: joinedNow ? 1 : 0,
        resolved: false,
        typing: false,
        stepIndex: 0,
        nudgeIndex: 0,
        frustration: 0,
        lastActivityTs: Date.now(),
      };
    }
    return init;
  });
  const [supervisorNotes, setSupervisorNotes] = useState<SupervisorNote[]>([]);
  const [responseTimesMs, setResponseTimesMs] = useState<number[]>([]);
  const firstReplyOrder = useRef<string[]>([]);
  const busy = useRef<Set<string>>(new Set());
  const firedEvents = useRef<Set<number>>(new Set());

  const elapsed = useCallback(
    () => Math.floor((Date.now() - startTsRef.current) / 1000),
    []
  );

  // -- Scheduler: joins + timed supervisor events --------------------------
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const e = elapsed();
      setConvos((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const p of PERSONAS) {
          if (!next[p.id].joined && e >= p.joinAtSeconds) {
            next[p.id] = {
              ...next[p.id],
              joined: true,
              turns: [{ role: 'customer', text: p.openingMessage, ts: Date.now() }],
              unread: 1,
              lastActivityTs: Date.now(),
            };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      for (const ev of TIMED_EVENTS) {
        if (e >= ev.atSeconds && !firedEvents.current.has(ev.atSeconds)) {
          firedEvents.current.add(ev.atSeconds);
          setSupervisorNotes((n) => [...n, { text: ev.text, ts: Date.now() }]);
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [active, elapsed]);

  // -- Impatience: nudge / escalate on agent silence -----------------------
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const snapshot = convos;
      for (const [id, c] of Object.entries(snapshot)) {
        if (!c.joined || c.resolved || busy.current.has(id)) continue;
        const imp = c.persona.impatient;
        if (!imp) continue;
        // Only nudge if the customer is currently WAITING on the agent:
        // the last message in the thread must be the customer's.
        const last = c.turns[c.turns.length - 1];
        if (!last || last.role !== 'customer') continue;
        // Measure silence since the AGENT's last message (or join if none).
        const lastAgent = [...c.turns].reverse().find((t) => t.role === 'agent');
        const sinceAgent =
          (Date.now() - (lastAgent ? lastAgent.ts : c.lastActivityTs)) / 1000;
        // Escalation ladder: one message per threshold crossed, and never more
        // nudges than we have lines for. `frustration` counts nudges already
        // sent for THIS silence; it resets to 0 whenever the agent replies.
        const maxNudges = imp.angryLines.length + 1; // 1 gentle + N angry
        if (c.frustration >= maxNudges) continue;
        // First nudge at nudgeAfterSeconds; each subsequent one requires an
        // additional escalate interval of further silence.
        const nextThreshold =
          c.frustration === 0
            ? imp.nudgeAfterSeconds
            : imp.escalateAfterSeconds * c.frustration;
        if (sinceAgent >= nextThreshold) {
          emitImpatience(id, c.frustration > 0);
        }
      }
    }, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, convos]);

  function emitImpatience(personaId: string, escalate: boolean) {
    if (busy.current.has(personaId)) return;
    busy.current.add(personaId);
    setConvos((prev) => {
      const c = prev[personaId];
      const imp = c.persona.impatient!;
      let line: string;
      // frustration 0 -> gentle nudge; 1+ -> angry lines by index.
      if (!escalate) {
        line = imp.nudgeLine;
      } else {
        const idx = Math.min(c.frustration - 1, imp.angryLines.length - 1);
        line = imp.angryLines[idx];
      }
      busy.current.delete(personaId);
      return {
        ...prev,
        [personaId]: {
          ...c,
          frustration: c.frustration + 1,
          turns: [...c.turns, { role: 'customer', text: line, ts: Date.now() }],
          unread: c.unread + 1,
          // NOTE: do NOT reset lastActivityTs here; silence is measured from
          // the agent's last message, so a nudge can't retrigger itself.
        },
      };
    });
  }

  // -- Candidate sends a message -------------------------------------------
  const sendAgentMessage = useCallback((personaId: string, text: string) => {
    const now = Date.now();
    if (!firstReplyOrder.current.includes(personaId)) {
      firstReplyOrder.current.push(personaId);
    }

    // Record the agent turn + response time immediately.
    setConvos((prev) => {
      const c = prev[personaId];
      const lastCustomer = [...c.turns].reverse().find((t) => t.role === 'customer');
      if (lastCustomer) {
        setResponseTimesMs((rt) => [...rt, now - lastCustomer.ts]);
      }
      return {
        ...prev,
        [personaId]: {
          ...c,
          turns: [...c.turns, { role: 'agent', text, ts: now }],
          typing: !c.resolved,
          frustration: 0, // agent replied; reset impatience
          lastActivityTs: now,
        },
      };
    });

    const signals = detectSignals(text);
    const persona = PERSONAS.find((p) => p.id === personaId)!;
    const { min, max } = SPEED_DELAYS[persona.speedProfile];
    const delay = min + Math.random() * (max - min);

    setTimeout(() => {
      setConvos((prev) => {
        const c = prev[personaId];
        if (c.resolved) return { ...prev, [personaId]: { ...c, typing: false } };

        const steps = c.persona.steps;
        const current = steps[c.stepIndex];
        let reply: string;
        let nextStep = c.stepIndex;
        let nextNudge = c.nudgeIndex;
        let resolved = false;

        if (current && current.advance(signals)) {
          // Agent satisfied this step -> customer advances and says the line.
          reply = current.onAdvance;
          nextStep = c.stepIndex + 1;
          nextNudge = 0; // reset nudge cycle for the new step
          if (nextStep >= steps.length) resolved = true;
        } else if (current) {
          // Not satisfied -> cycle through the varied re-prompts so the same
          // line is never repeated back-to-back.
          const list = current.nudges;
          reply = list[c.nudgeIndex % list.length];
          nextNudge = c.nudgeIndex + 1;
        } else {
          // No steps left; treat as resolved.
          reply = '';
          resolved = true;
        }

        const turns = reply
          ? [...c.turns, { role: 'customer' as const, text: reply, ts: Date.now() }]
          : c.turns;

        return {
          ...prev,
          [personaId]: {
            ...c,
            typing: false,
            stepIndex: nextStep,
            nudgeIndex: nextNudge,
            resolved,
            turns,
            unread: reply ? c.unread + 1 : c.unread,
            lastActivityTs: Date.now(),
          },
        };
      });
    }, delay);
  }, []);

  const markRead = useCallback((personaId: string) => {
    setConvos((prev) =>
      prev[personaId].unread === 0
        ? prev
        : { ...prev, [personaId]: { ...prev[personaId], unread: 0 } }
    );
  }, []);

  const priorityById = Object.fromEntries(
    PERSONAS.map((p) => [p.id, p.priority])
  ) as Record<string, 'low' | 'medium' | 'high'>;

  return {
    convos,
    supervisorNotes,
    responseTimesMs,
    firstReplyOrder,
    priorityById,
    sendAgentMessage,
    markRead,
    elapsed,
    startTs: startTsRef.current,
  };
}
