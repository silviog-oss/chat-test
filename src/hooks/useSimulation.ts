import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PERSONAS,
  TIMED_EVENTS,
  CustomerPersona,
  CustomerState,
  initialCustomerState,
  detectSignals,
  ReplySignals,
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
  state: CustomerState;
}

export interface SupervisorNote {
  text: string;
  ts: number;
}

const SUPERVISOR_ACTIVE_AFTER = 5 * 60;

// Pick the customer's next line from its branching beats, given the agent's
// latest signals. First matching beat wins; falls back to the last beat.
function nextBeat(persona: CustomerPersona, signals: ReplySignals, state: CustomerState) {
  const beat =
    persona.beats.find((b) => b.match(signals, state)) ??
    persona.beats[persona.beats.length - 1];
  beat.effect?.(state);
  state.step += 1;
  const say = typeof beat.say === 'function' ? beat.say(state) : beat.say;
  return say;
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
        state: initialCustomerState(),
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

  // -- Scheduler: joins + timed supervisor events ---------------------------
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

  // -- Ignored-customer nudges ---------------------------------------------
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      const snapshot = convos;
      for (const [id, c] of Object.entries(snapshot)) {
        if (!c.joined || c.resolved || busy.current.has(id)) continue;
        const last = c.turns[c.turns.length - 1];
        if (!last || last.role !== 'customer') continue;
        const since = (Date.now() - last.ts) / 1000;
        // Dana bails early if ignored; others get impatient.
        const threshold = id === 'customer-b' ? 90 : 100;
        if (since > threshold && Math.random() < 0.5) {
          nudge(id);
        }
      }
    }, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, convos]);

  function nudge(personaId: string) {
    if (busy.current.has(personaId)) return;
    busy.current.add(personaId);
    setConvos((prev) => {
      const c = prev[personaId];
      const line = c.persona.impatientLine(c.state);
      // Dana's impatient line means she gives up.
      const resolves = personaId === 'customer-b';
      const newState = { ...c.state };
      if (resolves) newState.resolved = true;
      return {
        ...prev,
        [personaId]: {
          ...c,
          resolved: c.resolved || resolves,
          state: newState,
          turns: [...c.turns, { role: 'customer', text: line, ts: Date.now() }],
          unread: c.unread + 1,
        },
      };
    });
    busy.current.delete(personaId);
  }

  // -- Candidate sends a message -------------------------------------------
  const sendAgentMessage = useCallback((personaId: string, text: string) => {
    const now = Date.now();
    if (!firstReplyOrder.current.includes(personaId)) {
      firstReplyOrder.current.push(personaId);
    }

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
        },
      };
    });

    // Customer reacts (unless already resolved), timed by their speed profile.
    const signals = detectSignals(text);
    const persona = PERSONAS.find((p) => p.id === personaId)!;
    const { min, max } = SPEED_DELAYS[persona.speedProfile];
    const delay = min + Math.random() * (max - min);
    setTimeout(() => {
      setConvos((prev) => {
        const c = prev[personaId];
        if (c.resolved) return { ...prev, [personaId]: { ...c, typing: false } };
        const state = { ...c.state };
        const line = nextBeat(c.persona, signals, state);
        return {
          ...prev,
          [personaId]: {
            ...c,
            typing: false,
            state,
            resolved: state.resolved,
            turns: [...c.turns, { role: 'customer', text: line, ts: Date.now() }],
            unread: c.unread + 1,
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
