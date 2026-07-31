import { Priority } from './types';

// Signals detected in the agent's message text. Deterministic, no LLM.
export interface ReplySignals {
  greeted: boolean;
  empathy: boolean;
  askedVerification: boolean;
  askedInfo: boolean;
  mentionedEscalation: boolean;
  gaveTimeframe: boolean;
  mentionedEmail: boolean;
  mentionedFees: boolean;
  mentionedVyde: boolean;
  mentionedBanks: boolean;
  mentionedWyoming: boolean;
  askedSsnRisk: boolean;
  closing: boolean;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// STEP-BASED BRANCHING
// Each scenario is an ordered list of steps. A step has:
//   - advance(signals): did the agent's reply satisfy THIS step?
//   - onAdvance: what the customer says when moving to the next step.
//   - nudge: what the customer says if the agent's reply did NOT satisfy the
//     step (a gentle re-prompt), so the conversation never "bugs out".
// The customer advances exactly ONE step per qualifying agent reply and can
// never skip or repeat, which keeps replies consistent.
// ---------------------------------------------------------------------------
export interface Step {
  advance: (s: ReplySignals) => boolean;
  onAdvance: string;
  nudge: string;
}

export interface CustomerPersona {
  id: string;
  name: string;
  initials: string;
  color: string;
  priority: Priority;
  joinAtSeconds: number;
  topic: string;
  ticketId: string;
  email: string;
  openingMessage: string;
  speedProfile: 'fast' | 'normal' | 'slow';
  steps: Step[];
  // Impatience: if set, the customer nudges after this many seconds of agent
  // silence, and escalates (gets angrier) after escalateAfterSeconds.
  impatient?: {
    nudgeAfterSeconds: number;
    escalateAfterSeconds: number;
    nudgeLine: string;
    angryLines: string[]; // used progressively as frustration grows
  };
}

export const SPEED_DELAYS: Record<
  CustomerPersona['speedProfile'],
  { min: number; max: number }
> = {
  fast: { min: 500, max: 1500 },
  normal: { min: 1500, max: 3200 },
  slow: { min: 3500, max: 6000 },
};

// ---------------------------------------------------------------------------
// Three real Bizee scenarios.
// ---------------------------------------------------------------------------
export const PERSONAS: CustomerPersona[] = [
  // ----- Scenario 1: EIN update (Jonathan / Venancio) ----------------------
  {
    id: 'ein',
    name: 'Jonathan Guzman',
    initials: 'JG',
    color: '#2F6FED',
    priority: 'medium',
    joinAtSeconds: 0,
    topic: 'EIN status',
    ticketId: '2747392',
    email: 'joya.designs14@gmail.com',
    openingMessage: 'i would like an update on the EIN?',
    speedProfile: 'normal',
    steps: [
      {
        // Step 0: agent should verify the account.
        advance: (s) => s.askedVerification,
        onAdvance: '226061005859  7856',
        nudge: 'i just want an update on my EIN please',
      },
      {
        // Step 1: agent explains the SSN second attempt WITH the risk note.
        advance: (s) => s.askedSsnRisk || s.askedInfo,
        onAdvance:
          'if i dont know if it has my middle initial or full middle name is it best to just give you the full middle name?',
        nudge: 'so is there any update on the EIN?',
      },
      {
        // Step 2: agent answers the name question / asks for details.
        advance: (s) => s.askedInfo || s.wordCount >= 4,
        onAdvance: 'ok here is the information\nJONATHAN ALEXANDER GUZMAN  646-20-9310',
        nudge: 'should i give you the full middle name or track it down?',
      },
      {
        // Step 3: agent escalates / gives a timeframe.
        advance: (s) => s.mentionedEscalation || s.gaveTimeframe,
        onAdvance: 'thank you, when will i receive the email?',
        nudge: 'did you get my information?',
      },
      {
        // Step 4: agent confirms email/timeframe -> customer wraps up.
        advance: (s) => s.gaveTimeframe || s.mentionedEmail || s.closing,
        onAdvance: 'thats everything, thank you',
        nudge: 'how long until i hear back?',
      },
    ],
  },

  // ----- Scenario 2: Fees / banking / tax (Dayanira) — IMPATIENT -----------
  {
    id: 'fees',
    name: 'D. L. Majnomd',
    initials: 'DM',
    color: '#1FB47A',
    priority: 'low',
    joinAtSeconds: 60, // joins ~1 min in
    topic: 'Pricing & fees',
    ticketId: '2746981',
    email: 'dlmajnomd@gmail.com',
    openingMessage: 'what will my yearly fee be ?',
    speedProfile: 'fast',
    steps: [
      {
        // Step 0: agent explains fees.
        advance: (s) => s.mentionedFees,
        onAdvance: 'ok thanks',
        nudge: 'so what would the yearly cost actually be?',
      },
      {
        // Step 1: customer asks the banking + tax follow-up.
        advance: (s) => s.wordCount >= 3 || s.closing,
        onAdvance:
          'what types of bank accounts can i open with the LLC and how much tax do i have to pay for income?',
        nudge: 'i also had another question',
      },
      {
        // Step 2: agent covers banks (Relay/BoA) and/or Vyde tax consult.
        advance: (s) => s.mentionedBanks || s.mentionedVyde,
        onAdvance: 'not at the moment thanks',
        nudge: 'so which banks can i use, and what about taxes?',
      },
    ],
    impatient: {
      nudgeAfterSeconds: 30,
      escalateAfterSeconds: 60,
      nudgeLine: 'hello? are you there?',
      angryLines: [
        'i am still waiting…',
        'is anyone going to help me??',
        'this is taking way too long.',
      ],
    },
  },

  // ----- Scenario 3: Member/document correction (Mohamed / Mina) -----------
  {
    id: 'members',
    name: 'Mohamed Ahmed',
    initials: 'MA',
    color: '#E0A21A',
    priority: 'high',
    joinAtSeconds: 0,
    topic: 'Company documents / members',
    ticketId: '2687705',
    email: 'elshzly.mohamed2015@gmail.com',
    openingMessage:
      'The completed documents I can download still show the previous company members. Can this be fixed?',
    speedProfile: 'slow',
    steps: [
      {
        advance: (s) => s.askedVerification,
        onAdvance:
          'Order number 226060401230, card ending 8830. Company: HORIZON GLOBAL TRADING LLC.',
        nudge: 'Could you please help with the document members issue?',
      },
      {
        advance: (s) => s.askedInfo || s.wordCount >= 4,
        onAdvance:
          'The current members should be: Ahmed Elsayed Youssef Youssef Ali, Mohamad Ramiz Youssef Qadi, Waleed Abdelmageed Abdelhameed Sobeah, Ramzi Youssef Hamza Qadi. But the downloadable Operating Agreement still lists the old ones.',
        nudge: 'What information do you need from me?',
      },
      {
        // agent explains Wyoming rule and/or offers email.
        advance: (s) => s.mentionedWyoming || s.mentionedEmail,
        onAdvance:
          'Thank you very much. I will wait for the updated documents by email.',
        nudge:
          'I already refreshed and cleared cache on a laptop, and the download still shows the old members.',
      },
      {
        advance: (s) => s.mentionedEmail || s.closing,
        onAdvance: 'Thank you for your assistance.',
        nudge: 'Could you confirm the corrected documents will be sent?',
      },
    ],
  },
];

export interface TimedEvent {
  atSeconds: number;
  kind: 'supervisor';
  text: string;
}

export const TIMED_EVENTS: TimedEvent[] = [
  {
    atSeconds: 5 * 60,
    kind: 'supervisor',
    text: 'Attention agents: SSN second-attempt EIN filings must include the duplicate-filing risk disclosure before submitting.',
  },
];

// ---------------------------------------------------------------------------
// Signal detection.
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
      'thanks for your patience', 'happy to help', 'glad',
    ]),
    askedVerification: has([
      'last 4', 'last four', 'card on file', 'primary card',
      'order number', 'order #', 'verify your account', 'verify the account',
      'digits of the', 'last 4 digits', 'four digits',
    ]),
    askedInfo: has([
      'please provide', 'could you provide', 'can you provide', 'reply with',
      'full name', 'full ssn', 'social security', 'confirm the', 'confirm that',
      'send me', 'provide the following', 'what is your', "what's your",
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
      'send you the', "we'll email", 'we will email', 'to your email',
      'follow up with you via email',
    ]),
    mentionedFees: has([
      'registered agent', '149', '$149', 'per year', '/year', 'one-time',
      'one time', 'virtual address', '$29', 'domain', 'renewal', 'annual',
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
      'statement of the organizer', 'internal template', 'does not list',
    ]),
    askedSsnRisk: has([
      'duplicate', 'mismatch', 'irs', 'same result', 'risk', 'authorize',
      'inaccurate', 'second attempt',
    ]),
    closing: has([
      'anything else', 'is there anything', 'have a great', 'have a good',
      'glad i could', 'happy to help', 'take care', 'this chat will now end',
    ]),
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
  };
}
