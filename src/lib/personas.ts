import { Priority } from './types';

// Signals detected in the agent's message text. Deterministic, no LLM.
export interface ReplySignals {
  greeted: boolean;
  empathy: boolean;
  askedVerification: boolean;
  askedBillingAddress: boolean; // KB step 3
  askedLastCharge: boolean; // KB step 4
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
//   - nudges: varied re-prompts if the agent reply did NOT satisfy the step
//     step (a gentle re-prompt), so the conversation never "bugs out".
// The customer advances exactly ONE step per qualifying agent reply and can
// never skip or repeat, which keeps replies consistent.
// ---------------------------------------------------------------------------
export interface Step {
  advance: (s: ReplySignals) => boolean;
  onAdvance: string;
  // One or more re-prompt lines. If the agent's reply doesn't satisfy the
  // step, the customer cycles through these (varied, not the same line looped).
  nudges: string[];
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
        nudges: [
          'i just want an update on my EIN please',
          'can you check the status of my EIN?',
          'sorry, i just need to know where my EIN is at',
        ],
      },
      {
        // Step 1: agent explains the SSN second attempt WITH the risk note.
        // If the agent instead CLAIMS it's already obtained / in the dashboard,
        // the customer pushes back (the premise is it was NOT received).
        advance: (s) => s.askedSsnRisk || s.askedInfo,
        onAdvance:
          'if i dont know if it has my middle initial or full middle name is it best to just give you the full middle name?',
        nudges: [
          "but i never got the EIN — it's not in my dashboard under completed documents",
          "i already checked the dashboard and there's no EIN there",
          "are you sure? i don't see any EIN on my account",
          'so what actually happened with the filing then?',
        ],
      },
      {
        // Step 2: agent answers the name question / asks for the details.
        advance: (s) => s.askedInfo || s.wordCount >= 6,
        onAdvance: 'ok here is the information\nJONATHAN ALEXANDER GUZMAN  646-20-9310',
        nudges: [
          'should i give you the full middle name or track it down?',
          'do you need my full name or the SSN?',
          'let me know exactly what info you need from me',
        ],
      },
      {
        // Step 3: agent escalates / gives a timeframe.
        advance: (s) => s.mentionedEscalation || s.gaveTimeframe,
        onAdvance: 'thank you, when will i receive the email?',
        nudges: [
          'did you get my information?',
          'so what happens next?',
          'is this being submitted now?',
        ],
      },
      {
        // Step 4: agent confirms email/timeframe -> customer wraps up.
        advance: (s) => s.gaveTimeframe || s.mentionedEmail || s.closing,
        onAdvance: 'thats everything, thank you',
        nudges: [
          'how long until i hear back?',
          'when should i expect the update?',
        ],
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
        nudges: [
          'so what would the yearly cost actually be?',
          'i just need to know the yearly fee',
          'can you tell me the annual cost?',
        ],
      },
      {
        // Step 1: customer asks the banking + tax follow-up.
        advance: (s) => s.wordCount >= 3 || s.closing,
        onAdvance:
          'what types of bank accounts can i open with the LLC and how much tax do i have to pay for income?',
        nudges: [
          'i also had another question',
          'one more thing actually',
        ],
      },
      {
        // Step 2: agent covers banks (Relay/BoA) and/or Vyde tax consult.
        advance: (s) => s.mentionedBanks || s.mentionedVyde,
        onAdvance: 'not at the moment thanks',
        nudges: [
          'so which banks can i use, and what about taxes?',
          'what about the bank accounts and the tax side?',
          'can you answer the banking and tax question?',
        ],
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
        nudges: [
          'Could you please help with the document members issue?',
          'The downloaded documents still list the wrong members.',
          'I need the member list on my documents corrected.',
        ],
      },
      {
        advance: (s) => s.askedInfo || s.wordCount >= 6,
        onAdvance:
          'The current members should be: Ahmed Elsayed Youssef Youssef Ali, Mohamad Ramiz Youssef Qadi, Waleed Abdelmageed Abdelhameed Sobeah, Ramzi Youssef Hamza Qadi. But the downloadable Operating Agreement still lists the old ones.',
        nudges: [
          'What information do you need from me?',
          'Let me know what details you need to fix this.',
        ],
      },
      {
        // agent explains Wyoming rule and/or offers email.
        advance: (s) => s.mentionedWyoming || s.mentionedEmail,
        onAdvance:
          'Thank you very much. I will wait for the updated documents by email.',
        nudges: [
          'I already refreshed and cleared cache on a laptop, and the download still shows the old members.',
          'I have tried re-downloading — it still shows the previous members.',
          'So how will the corrected documents reach me?',
        ],
      },
      {
        advance: (s) => s.mentionedEmail || s.closing,
        onAdvance: 'Thank you for your assistance.',
        nudges: [
          'Could you confirm the corrected documents will be sent?',
          'Will I receive the updated version?',
        ],
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
  const t = ' ' + text.toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  const has = (arr: string[]) => arr.some((w) => t.includes(w));

  const askedVerification = has([
    'last 4', 'last four', 'last 4 digits', 'last four digits', 'four digits',
    '4 digits', 'card on file', 'primary card', 'card ending', 'card number',
    'order number', 'order #', 'order id', 'order no', 'your order',
    'verify your account', 'verify the account', 'verify your identity',
    'to verify', 'for verification', 'confirm your account',
    'digits of the', 'digits of your', 'company name and the last',
    'account number', 'reference number', 'confirmation number',
  ]);

  const askedBillingAddress = has([
    'billing address', 'full billing', 'address on file', 'billing zip',
    'mailing address',
  ]);
  const askedLastCharge = has([
    'last charge', 'amount and date', 'amount of the last', 'date of the last',
    'recent charge', 'last payment', 'last transaction',
  ]);

  const askedInfo = has([
    'please provide', 'could you provide', 'can you provide', 'kindly provide',
    'please share', 'could you share', 'can you share', 'please send',
    'could you send', 'can you send', 'send me', 'reply with', 'respond with',
    'provide the following', 'provide me with', 'provide us with',
    'full name', 'your full name', 'full ssn', 'social security',
    'ssn', 'as it appears', 'as shown on', 'exactly as', 'middle name',
    'what is your', "what's your", 'may i have', 'can i have', 'i need your',
    'i will need', 'let me know your', 'confirm the', 'confirm that',
    'please confirm', 'could you confirm', 'can you confirm',
  ]);

  const askedSsnRisk = has([
    'duplicate', 'duplicate filing', 'mismatch', 'irs', 'same result',
    'risk', 'authorize us', 'authorize', 'inaccurate', 'second attempt',
    'another attempt', 'another application', 'file again', 'refile',
    're-file', 'may return the same', 'no control over', 'potential risk',
    'acknowledge',
  ]);

  const mentionedEscalation = has([
    'escalate', 'escalating', 'escalation', 'department', 'the team',
    'our team', 'follow up', 'follow-up', 'forward this', 'forward it',
    'raise this', 'raise it', 'submit another', 'file another',
    'send this over', 'pass this', 'pass it', 'get this to', 'reach out to',
    'i will submit', "i'll submit", 'i will file', "i'll file",
    'looking into', 'look into', 'check on this', 'check this for you',
  ]);

  const gaveTimeframe = has([
    '1-2 business', '1 to 2 business', '1 or 2 business', 'one to two business',
    'business day', 'business days', '24 hours', '48 hours', '72 hours',
    'within', 'in a few', 'couple of days', 'a couple days', 'shortly',
    'by end of', 'by the end', 'soon', 'today', 'tomorrow', 'this week',
    'next few days', 'as soon as', 'asap', 'momentarily',
  ]);

  const mentionedEmail = has([
    'email on file', 'send it to the email', 'send to the email',
    'by email', 'via email', 'over email', 'through email', 'send you the',
    "we'll email", 'we will email', "i'll email", 'i will email',
    'to your email', 'email you', 'emailed to you', 'sent to your email',
    'follow up with you via email', 'update you by email', 'reach you by email',
  ]);

  const mentionedFees = has([
    'registered agent', '149', '$149', 'per year', '/year', 'a year',
    'yearly', 'annual', 'annually', 'one-time', 'one time', 'single payment',
    'virtual address', '$29', '29/month', 'domain', 'renewal', 'renew',
    'no recurring', 'free the first', 'free for the first', 'first year free',
    'no yearly', 'no annual fee', 'compliance', 'state fee', 'filing fee',
  ]);

  const mentionedVyde = has([
    'vyde', 'tax consultation', 'consultation', 'tax consult', 'tax advisor',
    'tax professional', 'third party', 'third-party', '30-minute', '30 minute',
    'thirty minute', 'tax service', 'tax-related', 'we do not assist with tax',
    "don't assist with tax", 'do not handle tax', 'we partner', 'partnership',
  ]);

  const mentionedBanks = has([
    'relay', 'bank of america', 'boa', 'bank account', 'banks', 'bank',
    'apply with them', 'open an account', 'business account', 'checking account',
    'financial institution',
  ]);

  const mentionedWyoming = has([
    'wyoming', 'articles of organization', 'not list', 'does not list',
    "doesn't list", 'not listed', 'operating agreement', 'statement of the organizer',
    'internal template', 'internal document', 'member information',
    'members are not', 'not shown on', 'not on the articles',
  ]);

  const greeted = has([
    'hi ', 'hi!', 'hi.', 'hi,', 'hello', 'hey', 'good morning',
    'good afternoon', 'good evening', 'thank you for contacting',
    'thanks for contacting', 'thanks for reaching', 'thank you for reaching',
    'welcome', 'how can i help', 'how may i help', 'how can i assist',
    'how may i assist', 'happy to help', 'glad to help',
  ]);

  const empathy = has([
    'understand', 'i see', 'i hear you', 'that must', 'frustrat', 'frustrating',
    'sorry to hear', 'sorry for', 'apologi', 'i know how', 'i realize',
    'appreciate your patience', 'thanks for your patience',
    'thank you for your patience', 'thank you for waiting', 'thanks for waiting',
    'no worries', 'not a problem', "i'd be happy", 'i would be happy',
    'rest assured', 'i completely understand', 'totally understand',
  ]);

  const closing = has([
    'anything else', 'is there anything', 'anything more', 'anything further',
    'have a great', 'have a good', 'have a wonderful', 'have a nice',
    'glad i could', 'happy i could', 'happy to have', 'take care',
    'this chat will now end', 'this chat will end', 'concluding this chat',
    'conclude this chat', 'thank you for chatting', 'wishing you', 'all the best',
    'is that all',
  ]);

  return {
    greeted,
    empathy,
    askedVerification,
    askedBillingAddress,
    askedLastCharge,
    askedInfo,
    mentionedEscalation,
    gaveTimeframe,
    mentionedEmail,
    mentionedFees,
    mentionedVyde,
    mentionedBanks,
    mentionedWyoming,
    askedSsnRisk,
    closing,
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
  };
}
