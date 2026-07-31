import { Priority } from './types';

// A "signal" is something we detect in the candidate (agent) message text.
// The branching simulator uses these to pick each customer's next scripted
// beat, so customers react to what the agent actually says without an LLM.
// These are tuned to real Bizee support conversations.
export interface ReplySignals {
  greeted: boolean;
  empathy: boolean;
  askedVerification: boolean; // order # + last 4 digits / card on file
  askedInfo: boolean; // asked for any additional detail
  mentionedEscalation: boolean; // escalate / department / follow up
  gaveTimeframe: boolean; // "1-2 business days", "shortly", etc.
  mentionedEmail: boolean; // will send by email
  mentionedFees: boolean; // registered agent / $149 / fee
  mentionedVyde: boolean; // tax consultation / Vyde
  mentionedBanks: boolean; // Relay / Bank of America / bank
  mentionedWyoming: boolean; // Wyoming / articles / members not listed
  askedSsnRisk: boolean; // notes duplicate-filing / IRS mismatch risk
  closing: boolean; // "anything else", "have a great day"
  wordCount: number;
}

export type Beat = {
  match: (s: ReplySignals, state: CustomerState) => boolean;
  say: string | ((state: CustomerState) => string);
  effect?: (state: CustomerState) => void;
};

export interface CustomerState {
  step: number;
  resolved: boolean;
  verified: boolean; // agent asked for order# + last 4
  gaveDetails: boolean; // customer handed over the requested info
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
  topic: string; // shown in the Zendesk header ("Change tax number", etc.)
  ticketId: string; // decorative Zendesk ticket number
  email: string; // shown in the right-hand customer panel
  openingMessage: string;
  speedProfile: 'fast' | 'normal' | 'slow';
  beats: Beat[];
  impatientLine: (state: CustomerState) => string;
  closeLine: string;
}

// Reply delay ranges in milliseconds, per speed profile.
export const SPEED_DELAYS: Record<
  CustomerPersona['speedProfile'],
  { min: number; max: number }
> = {
  fast: { min: 500, max: 1500 },
  normal: { min: 1500, max: 3200 },
  slow: { min: 3500, max: 7000 },
};

export const initialCustomerState = (): CustomerState => ({
  step: 0,
  resolved: false,
  verified: false,
  gaveDetails: false,
  satisfied: false,
  frustration: 0,
});

// ---------------------------------------------------------------------------
// Seed data: three real Bizee support scenarios.
// The "ideal" agent path is verify -> help with correct policy -> escalate or
// resolve -> close. Beats are ordered; the first match wins; last is a
// catch-all nudge.
// ---------------------------------------------------------------------------
export const PERSONAS: CustomerPersona[] = [
  // ----- Scenario 1: EIN update (based on the Jon / Venancio transcript) ---
  {
    id: 'ein',
    name: 'Jonathan Guzman',
    initials: 'JG',
    color: '#2F6FED',
    priority: 'medium',
    topic: 'EIN status',
    ticketId: '2747392',
    email: 'joya.designs14@gmail.com',
    joinAtSeconds: 0,
    openingMessage: 'i would like an update on the EIN?',
    speedProfile: 'normal',
    beats: [
      {
        // Agent verifies identity (order # + last 4) -> customer gives them.
        match: (s, st) => !st.verified && s.askedVerification,
        say: '226061005859  7856',
        effect: (st) => {
          st.verified = true;
        },
      },
      {
        // After verification, if the agent explains the SSN second attempt
        // AND flags the duplicate-filing risk, customer asks the name question.
        match: (s, st) => st.verified && !st.gaveDetails && s.askedSsnRisk,
        say: 'if i dont know if it has my middle initial or full middle name is it best to just give you the full middle name or would you like me to track it down?',
      },
      {
        // If agent asks for the info (SSN retry) without the risk disclosure,
        // customer still cooperates but this is a weaker path.
        match: (s, st) => st.verified && !st.gaveDetails && s.askedInfo,
        say: 'here is the information\nJONATHAN ALEXANDER GUZMAN  646-20-9310',
        effect: (st) => {
          st.gaveDetails = true;
        },
      },
      {
        // Once the agent gives a timeframe / escalates, customer wraps up.
        match: (s, st) =>
          st.verified && (s.gaveTimeframe || s.mentionedEscalation),
        say: 'thank you when will i receive the email?',
        effect: (st) => {
          st.satisfied = true;
        },
      },
      {
        match: (_s, st) => st.satisfied,
        say: 'thats everything thank you',
        effect: (st) => {
          st.resolved = true;
        },
      },
      {
        match: () => true,
        say: 'i just want an update on my EIN please',
      },
    ],
    impatientLine: (st) =>
      st.frustration >= 2 ? 'are you still there?' : 'any update?',
    closeLine: 'thank you',
  },

  // ----- Scenario 2: Yearly fees / banking / tax (Dayanira transcript) -----
  {
    id: 'fees',
    name: 'D. L. Majnomd',
    initials: 'DM',
    color: '#1FB47A',
    priority: 'low',
    topic: 'Pricing & fees',
    ticketId: '2746981',
    email: 'dlmajnomd@gmail.com',
    joinAtSeconds: 0,
    openingMessage: 'what will my yearly fee be ?',
    speedProfile: 'normal',
    beats: [
      {
        // Agent explains the fee breakdown -> customer thanks, then asks the
        // follow-up about banking + taxes.
        match: (s, st) => st.step === 0 && s.mentionedFees,
        say: 'ok thanks',
        effect: (st) => {
          st.verified = true; // (no ID needed here; mark first beat handled)
        },
      },
      {
        // The two-part follow-up question.
        match: (_s, st) => st.step >= 1 && !st.gaveDetails,
        say: 'what types of bank accounts can i open with the LLC and how much tax do i have to pay for income',
        effect: (st) => {
          st.gaveDetails = true;
        },
      },
      {
        // Good answer covers banks (Relay / BoA) and Vyde tax consult.
        match: (s, st) =>
          st.gaveDetails && (s.mentionedBanks || s.mentionedVyde),
        say: 'not at the moment thanks',
        effect: (st) => {
          st.satisfied = true;
          st.resolved = true;
        },
      },
      {
        match: (_s, st) => st.satisfied,
        say: 'thanks',
        effect: (st) => {
          st.resolved = true;
        },
      },
      {
        match: () => true,
        say: 'so what would the yearly cost be?',
      },
    ],
    impatientLine: () => 'hello? still waiting on the fee info',
    closeLine: 'thanks',
  },

  // ----- Scenario 3: Member/document correction (Mina transcript) ----------
  {
    id: 'members',
    name: 'Mohamed Ahmed',
    initials: 'MA',
    color: '#E0A21A',
    priority: 'high',
    topic: 'Company documents / members',
    ticketId: '2687705',
    email: 'elshzly.mohamed2015@gmail.com',
    joinAtSeconds: 5 * 60, // joins mid-shift to add pressure
    openingMessage:
      'The completed documents I can download still show the previous company members. Can this be fixed?',
    speedProfile: 'slow',
    beats: [
      {
        match: (s, st) => !st.verified && s.askedVerification,
        say: 'Order number 226060401230, card ending 8830. Company: HORIZON GLOBAL TRADING LLC.',
        effect: (st) => {
          st.verified = true;
        },
      },
      {
        // After verification, customer lays out the member change in detail.
        match: (_s, st) => st.verified && !st.gaveDetails,
        say: 'The current members should be: Ahmed Elsayed Youssef Youssef Ali, Mohamad Ramiz Youssef Qadi, Waleed Abdelmageed Abdelhameed Sobeah, Ramzi Youssef Hamza Qadi. But the downloadable Operating Agreement still lists the old members.',
        effect: (st) => {
          st.gaveDetails = true;
        },
      },
      {
        // Ideal: agent explains Wyoming rule AND offers to email updated docs.
        match: (s, st) =>
          st.gaveDetails && (s.mentionedWyoming || s.mentionedEmail),
        say: 'Thank you very much. I will wait for the updated documents by email.',
        effect: (st) => {
          st.satisfied = true;
        },
      },
      {
        match: (_s, st) => st.satisfied,
        say: 'Thank you for your assistance.',
        effect: (st) => {
          st.resolved = true;
        },
      },
      {
        // If not yet resolved and agent just says "refresh", push back.
        match: (_s, st) => st.gaveDetails && !st.satisfied,
        say: 'I already refreshed and cleared cache on a laptop. The downloaded Operating Agreement still shows the old members.',
        effect: (st) => {
          st.frustration = Math.min(3, st.frustration + 1);
        },
      },
      {
        match: () => true,
        say: 'Please, could you confirm the documents will be corrected?',
      },
    ],
    impatientLine: (st) =>
      st.frustration >= 2
        ? 'This is quite urgent for my registration — are you able to help?'
        : 'Any update on the corrected documents?',
    closeLine: 'Thank you.',
  },
];

export interface TimedEvent {
  atSeconds: number;
  kind: 'supervisor';
  text: string;
}

// Kept minimal now that scenarios are policy-driven. The supervisor note still
// fires to add mid-shift pressure.
export const TIMED_EVENTS: TimedEvent[] = [
  {
    atSeconds: 5 * 60,
    kind: 'supervisor',
    text: 'Attention agents: SSN second-attempt EIN filings must include the duplicate-filing risk disclosure before submitting.',
  },
];

// ---------------------------------------------------------------------------
// Signal detection: lightweight, deterministic text analysis of a reply.
// ---------------------------------------------------------------------------
export function detectSignals(text: string): ReplySignals {
  const t = text.toLowerCase();
  const has = (arr: string[]) => arr.some((w) => t.includes(w));
  return {
    greeted: has([
      'hi ', 'hello', 'hey', 'good morning', 'good afternoon',
      'thank you for contacting', 'thanks for reaching', 'welcome',
    ]),
    empathy: has([
      'understand', 'i see', 'i hear you', 'that must', 'frustrat',
      'sorry to hear', 'apologi', 'i know how', 'appreciate your patience',
      'thanks for your patience', 'happy to help',
    ]),
    askedVerification: has([
      'last 4', 'last four', 'card on file', 'primary card',
      'order number', 'order #', 'verify your account', 'verify the account',
      'digits of the', 'company name and the last',
    ]),
    askedInfo: has([
      'please provide', 'could you provide', 'can you provide', 'reply with',
      'full name', 'full ssn', 'social security', 'confirm the', 'confirm that',
      'send me', 'provide the following',
    ]),
    mentionedEscalation: has([
      'escalate', 'escalating', 'department', 'follow up', 'follow-up',
      'forward this', 'raise this', 'submit another application', 'file another',
    ]),
    gaveTimeframe: has([
      '1-2 business', '1 or 2 business', 'business day', 'business days',
      '24 hours', '48 hours', 'within', 'shortly', 'by end of', 'today',
      'tomorrow',
    ]),
    mentionedEmail: has([
      'email on file', 'send it to the email', 'by email', 'via email',
      'send you the', "we'll email", 'we will email', 'follow up with you via email',
    ]),
    mentionedFees: has([
      'registered agent', '149', '$149', 'per year', '/year', 'one-time',
      'virtual address', '$29', 'domain', 'renewal', 'annual',
    ]),
    mentionedVyde: has([
      'vyde', 'tax consultation', 'consultation', 'third party', 'third-party',
      '30-minute', '30 minute',
    ]),
    mentionedBanks: has([
      'relay', 'bank of america', 'bank account', 'banks', 'apply with them',
    ]),
    mentionedWyoming: has([
      'wyoming', 'articles of organization', 'not list', 'operating agreement',
      'statement of the organizer', 'internal template',
    ]),
    askedSsnRisk: has([
      'duplicate', 'mismatch', 'irs', 'same result', 'risk', 'authorize us',
      'inaccurate details',
    ]),
    closing: has([
      'anything else', 'is there anything', 'have a great', 'have a good',
      'glad i could', 'happy to help', 'take care', 'this chat will now end',
    ]),
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
  };
}
