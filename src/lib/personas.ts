import { Priority } from './types';

// A "signal" is something we detect in the candidate's message text. The
// branching simulator uses these to pick each customer's next scripted beat,
// so customers react to what the agent actually says without needing an LLM.
export interface ReplySignals {
  greeted: boolean;
  apologized: boolean;
  askedIdentifier: boolean; // order #, email, account, etc.
  mentionedRefundPolicy: boolean; // supervisor approval / policy
  gaveTimeframe: boolean; // "within 24h", "shortly", etc.
  promisedInstantRefund: boolean; // refund now/immediately without policy
  empathy: boolean; // "I understand", "sorry to hear", etc.
  closing: boolean; // "anything else", "have a great day"
  wordCount: number;
}

export type Beat = {
  // If matcher returns true for the candidate's latest signals, this beat fires.
  match: (s: ReplySignals, state: CustomerState) => boolean;
  // The customer's reply text (or a function producing it).
  say: string | ((state: CustomerState) => string);
  // Optional side effects on the customer's running state.
  effect?: (state: CustomerState) => void;
};

export interface CustomerState {
  step: number;
  resolved: boolean;
  gotIdentifier: boolean;
  satisfied: boolean;
  frustration: number; // 0..3
}

export interface CustomerPersona {
  id: string;
  name: string;
  initials: string;
  color: string;
  priority: Priority;
  joinAtSeconds: number;
  openingMessage: string;
  // Reply timing profile: how quickly this customer types back after the
  // agent replies. 'fast' customers fire back almost immediately (adds
  // pressure); 'slow' customers take their time.
  speedProfile: 'fast' | 'normal' | 'slow';
  // Ordered beats: first matching beat wins. A catch-all should be last.
  beats: Beat[];
  // What the customer says if ignored too long.
  impatientLine: (state: CustomerState) => string;
  // What the customer says once resolved (used to close out).
  closeLine: string;
}

// Reply delay ranges in milliseconds, per speed profile.
export const SPEED_DELAYS: Record<
  CustomerPersona['speedProfile'],
  { min: number; max: number }
> = {
  fast: { min: 400, max: 1200 },
  normal: { min: 1200, max: 2600 },
  slow: { min: 3000, max: 6000 },
};

export const initialCustomerState = (): CustomerState => ({
  step: 0,
  resolved: false,
  gotIdentifier: false,
  satisfied: false,
  frustration: 0,
});

// ---------------------------------------------------------------------------
// Seed data: four customers, distinct personalities / urgencies / styles.
// ---------------------------------------------------------------------------
export const PERSONAS: CustomerPersona[] = [
  {
    id: 'customer-a',
    name: 'Marcus Reed',
    initials: 'MR',
    color: '#2F6FED',
    priority: 'medium',
    joinAtSeconds: 0,
    openingMessage:
      'I ordered yesterday but never received my confirmation email.',
    speedProfile: 'normal',
    beats: [
      {
        match: (s, st) => !st.gotIdentifier && s.askedIdentifier,
        say: 'oh sure, its order #48213. email on file is marcus.r@email.com',
        effect: (st) => {
          st.gotIdentifier = true;
        },
      },
      {
        match: (_s, st) => st.gotIdentifier && !st.resolved,
        say: 'ok great, so the order actually went through? and the email is coming?',
        effect: (st) => {
          st.satisfied = true;
        },
      },
      {
        match: (_s, st) => st.satisfied,
        say: 'perfect, thank you so much for checking that for me!',
        effect: (st) => {
          st.resolved = true;
        },
      },
      {
        // catch-all early: acknowledge but nudge toward the info
        match: () => true,
        say: "thanks. i just want to make sure the order didn't fail since i got charged.",
      },
    ],
    impatientLine: () => 'Hello?? Are you still there?',
    closeLine: 'appreciate it, take care!',
  },
  {
    id: 'customer-b',
    name: 'Dana Kim',
    initials: 'DK',
    color: '#1FB47A',
    priority: 'low',
    joinAtSeconds: 0,
    openingMessage: 'My password reset link says it expired.',
    speedProfile: 'slow',
    beats: [
      {
        match: (_s, st) => st.step >= 1,
        say: 'Never mind, I figured it out. Requested a fresh link and it worked.',
        effect: (st) => {
          st.resolved = true;
        },
      },
      {
        match: () => true,
        say: 'It just says "this link has expired" when I click it.',
      },
    ],
    impatientLine: () => 'Never mind, I figured it out.',
    closeLine: 'Thanks anyway.',
  },
  {
    id: 'customer-c',
    name: 'Tré Watson',
    initials: 'TW',
    color: '#E0524A',
    priority: 'high',
    joinAtSeconds: 0,
    openingMessage: "I'm being charged twice on my credit card.",
    speedProfile: 'fast',
    beats: [
      {
        // If the agent promises an instant refund with no policy/timeframe,
        // push back — this is the accuracy trap.
        match: (s) => s.promisedInstantRefund && !s.mentionedRefundPolicy,
        say: 'wait, you can just refund $149.99 right now? how long does that actually take?',
        effect: (st) => {
          st.frustration = Math.min(3, st.frustration + 1);
        },
      },
      {
        match: (_s, st) => !st.gotIdentifier,
        say: 'its two charges of $149.99 on the same card, same day. this is not ok',
        effect: (st) => {
          st.gotIdentifier = true;
        },
      },
      {
        // Good path: agent references policy or gives a clear timeframe.
        match: (s) => s.mentionedRefundPolicy || s.gaveTimeframe,
        say: 'ok. as long as its being handled and i get the duplicate back, thank you.',
        effect: (st) => {
          st.satisfied = true;
        },
      },
      {
        match: (_s, st) => st.satisfied,
        say: 'appreciate you sorting this out.',
        effect: (st) => {
          st.resolved = true;
        },
      },
      {
        match: () => true,
        say: 'I need this fixed ASAP.',
        effect: (st) => {
          st.frustration = Math.min(3, st.frustration + 1);
        },
      },
    ],
    impatientLine: (st) =>
      st.frustration >= 2
        ? 'Is anyone actually going to help me here??'
        : 'I need this fixed ASAP.',
    closeLine: 'thanks.',
  },
  {
    id: 'customer-d',
    name: 'Priya Anand',
    initials: 'PA',
    color: '#E0A21A',
    priority: 'high',
    joinAtSeconds: 7 * 60,
    openingMessage:
      'Hi, I need help right now — my account is locked and I have a client call in 10 minutes.',
    speedProfile: 'fast',
    beats: [
      {
        match: (_s, st) => !st.gotIdentifier,
        say: "It's under priya.anand@email.com. Can you unlock it quickly?",
        effect: (st) => {
          st.gotIdentifier = true;
        },
      },
      {
        match: (_s, st) => st.gotIdentifier && !st.resolved,
        say: 'You unlocked it — I can log in now. Thank you so much, you saved my call!',
        effect: (st) => {
          st.resolved = true;
        },
      },
      {
        match: () => true,
        say: 'Please, I really am short on time here.',
      },
    ],
    impatientLine: () => "I'm running out of time — is anyone there?",
    closeLine: 'Thanks again!',
  },
];

export interface TimedEvent {
  atSeconds: number;
  kind: 'supervisor';
  text: string;
}

// Scheduled events stay on real timers so every candidate faces the same
// pressure spikes at the same moments.
export const TIMED_EVENTS: TimedEvent[] = [
  {
    atSeconds: 5 * 60,
    kind: 'supervisor',
    text: 'Attention agents: Effective immediately, refunds over $100 require supervisor approval.',
  },
];

// ---------------------------------------------------------------------------
// Signal detection: lightweight, deterministic text analysis of a reply.
// ---------------------------------------------------------------------------
export function detectSignals(text: string): ReplySignals {
  const t = text.toLowerCase();
  const has = (arr: string[]) => arr.some((w) => t.includes(w));
  return {
    greeted: has(['hi ', 'hello', 'hey', 'good morning', 'good afternoon', 'thanks for reaching', 'welcome']),
    apologized: has(['sorry', 'apologi', 'my apologies']),
    askedIdentifier: has([
      'order number', 'order #', 'order id', 'confirmation number',
      'email address', 'your email', 'account', 'last four', 'reference',
      'can you provide', 'could you provide', 'what is your', "what's your",
    ]),
    mentionedRefundPolicy: has([
      'supervisor', 'approval', 'approve', 'policy', 'over $100', 'over 100',
    ]),
    gaveTimeframe: has([
      'within', 'business day', 'business days', '24 hours', '24h', '48 hours',
      'shortly', 'by end of', 'today', 'tomorrow', 'hour', 'minutes',
    ]),
    promisedInstantRefund: has([
      'refund you now', 'refund right now', 'immediate refund', 'refund immediately',
      'refunding now', 'process the refund now', 'instant refund', "i'll refund",
      'i will refund', 'issue a refund now', 'refunded right away',
    ]),
    empathy: has([
      'understand', 'i see', 'i hear you', 'that must', 'frustrat', 'sorry to hear',
      'i know how', 'appreciate your patience', 'thanks for your patience',
    ]),
    closing: has([
      'anything else', 'is there anything', 'have a great', 'have a good',
      'glad i could', 'happy to help', 'take care',
    ]),
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
  };
}
