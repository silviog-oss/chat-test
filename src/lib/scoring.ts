import {
  CategoryScores,
  AiFeedback,
  ConversationTranscript,
} from './types';
import { detectSignals } from './personas';

// ---------------------------------------------------------------------------
// Deterministic, client-side scoring. No API, no cost, fully reproducible.
// Same six categories and 100-point scale as the spec. "aiFeedback" here is
// rule-generated commentary, not an LLM — the field name is kept so the data
// model and dashboards stay identical.
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

interface ScoreInput {
  transcripts: ConversationTranscript[];
  responseTimesMs: number[];
  // order in which the candidate FIRST replied to each persona id
  firstReplyOrder: string[];
  // priority by persona id, for prioritization scoring
  priorityById: Record<string, 'low' | 'medium' | 'high'>;
}

export interface ScoreResult {
  categories: CategoryScores;
  feedback: AiFeedback;
}

export function scoreAssessment(input: ScoreInput): ScoreResult {
  const { transcripts, responseTimesMs, firstReplyOrder, priorityById } = input;

  const agentTurns = transcripts.flatMap((t) =>
    t.turns.filter((x) => x.role === 'agent')
  );
  const agentText = agentTurns.map((t) => t.text);
  const totalAgentMsgs = agentText.length;

  // ---- Response time (/20) ------------------------------------------------
  // Reward a low, consistent average. 15s or faster = full marks; 120s+ = 0.
  const avgMs =
    responseTimesMs.length > 0
      ? responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length
      : 120000;
  const avgSec = avgMs / 1000;
  const baseResponse =
    totalAgentMsgs === 0 ? 0 : clamp(20 - (avgSec - 15) * (20 / 105), 0, 20);

  // 4-minute rule: every reply that took longer than 4 minutes costs a flat
  // 3 points, deducted from Response Time and floored at 0.
  const FOUR_MIN_MS = 4 * 60 * 1000;
  const lateReplies = responseTimesMs.filter((ms) => ms > FOUR_MIN_MS).length;
  const responseTime = Math.round(clamp(baseResponse - lateReplies * 3, 0, 20));

  // ---- Grammar (/10) ------------------------------------------------------
  // Capitalization, sentence-ending punctuation, and non-trivial length.
  let grammarPoints = 0;
  let grammarChecks = 0;
  for (const msg of agentText) {
    const trimmed = msg.trim();
    if (!trimmed) continue;
    grammarChecks++;
    const startsUpper = /^[A-Z]/.test(trimmed);
    const endsPunct = /[.!?]$/.test(trimmed);
    const reasonableLen = trimmed.split(/\s+/).length >= 3;
    const noDoubleSpace = !/\s{2,}/.test(trimmed);
    grammarPoints +=
      (startsUpper ? 0.3 : 0) +
      (endsPunct ? 0.3 : 0) +
      (reasonableLen ? 0.25 : 0) +
      (noDoubleSpace ? 0.15 : 0);
  }
  const grammar =
    grammarChecks === 0
      ? 0
      : Math.round(clamp((grammarPoints / grammarChecks) * 10, 0, 10));

  // ---- Professional tone (/15) -------------------------------------------
  const anyGreeted = agentText.some((m) => detectSignals(m).greeted);
  const anyEmpathy = agentText.some((m) => detectSignals(m).empathy);
  const anyClosing = agentText.some((m) => detectSignals(m).closing);
  const noAllCaps = !agentText.some((m) => m.length > 4 && m === m.toUpperCase());
  let tone = 0;
  tone += anyGreeted ? 5 : 0;
  tone += anyEmpathy ? 5 : 0;
  tone += anyClosing ? 3 : 0;
  tone += noAllCaps ? 2 : 0;
  const professionalTone = Math.round(clamp(tone, 0, 15));

  // ---- Accuracy (/20) -----------------------------------------------------
  // For the Bizee scenarios, "accuracy" weights three things equally:
  //   (a) verifying the account before helping,
  //   (b) giving correct, policy-compliant information for each ticket,
  //   (c) proper escalation and/or clean close-out wording.
  const allAgent = agentText;
  const sig = (arr: string[], pred: (s: ReturnType<typeof detectSignals>) => boolean) =>
    arr.some((m) => pred(detectSignals(m)));

  // (a) Verification — asked for order # + last 4 / card on file.
  const didVerify = sig(allAgent, (s) => s.askedVerification);

  // (b) Correct policy info, per scenario present in the transcripts.
  const has = (id: string) => transcripts.some((t) => t.personaId === id);
  const agentFor = (id: string) =>
    transcripts
      .find((t) => t.personaId === id)
      ?.turns.filter((x) => x.role === 'agent')
      .map((x) => x.text) ?? [];

  let policyChecks = 0;
  let policyHits = 0;
  if (has('ein')) {
    policyChecks++;
    // EIN retry must mention escalation/timeframe AND the SSN duplicate risk.
    const a = agentFor('ein');
    const okEscalate = a.some((m) => detectSignals(m).mentionedEscalation || detectSignals(m).gaveTimeframe);
    const okRisk = a.some((m) => detectSignals(m).askedSsnRisk);
    if (okEscalate && okRisk) policyHits++;
    else if (okEscalate || okRisk) policyHits += 0.5;
  }
  if (has('fees')) {
    policyChecks++;
    const a = agentFor('fees');
    const okFees = a.some((m) => detectSignals(m).mentionedFees);
    const okBanksTax = a.some(
      (m) => detectSignals(m).mentionedBanks || detectSignals(m).mentionedVyde
    );
    if (okFees && okBanksTax) policyHits++;
    else if (okFees || okBanksTax) policyHits += 0.5;
  }
  if (has('members')) {
    policyChecks++;
    const a = agentFor('members');
    const okWyoming = a.some((m) => detectSignals(m).mentionedWyoming);
    const okEmail = a.some((m) => detectSignals(m).mentionedEmail);
    if (okWyoming && okEmail) policyHits++;
    else if (okWyoming || okEmail) policyHits += 0.5;
  }
  const policyRatio = policyChecks ? policyHits / policyChecks : 0;

  // (c) Proper close-out / escalation wording somewhere.
  const didClose = sig(allAgent, (s) => s.closing || s.mentionedEscalation);

  // Weight the three parts equally within the 20 points.
  let accuracy = 0;
  accuracy += didVerify ? 20 / 3 : 0;
  accuracy += policyRatio * (20 / 3);
  accuracy += didClose ? 20 / 3 : 0;
  const accuracyScore = Math.round(clamp(accuracy, 0, 20));

  // ---- Conversation management (/20) -------------------------------------
  // Did the candidate engage every customer, and get some resolved?
  const engaged = transcripts.filter((t) =>
    t.turns.some((x) => x.role === 'agent')
  ).length;
  const resolved = transcripts.filter((t) => t.resolved).length;
  const total = transcripts.length || 1;
  const conversationManagement = Math.round(
    clamp((engaged / total) * 10 + (resolved / total) * 10, 0, 20)
  );

  // ---- Prioritization (/15) ----------------------------------------------
  // Did the candidate reach high-priority customers before low-priority ones?
  let prioritization = 8; // neutral baseline
  const orderedPriorities = firstReplyOrder
    .map((id) => priorityById[id])
    .filter(Boolean);
  const rank = { high: 0, medium: 1, low: 2 } as const;
  let inversions = 0;
  for (let i = 0; i < orderedPriorities.length; i++) {
    for (let j = i + 1; j < orderedPriorities.length; j++) {
      if (rank[orderedPriorities[i]] > rank[orderedPriorities[j]]) inversions++;
    }
  }
  prioritization = Math.round(clamp(15 - inversions * 3, 0, 15));

  const categories: CategoryScores = {
    responseTime,
    grammar,
    professionalTone,
    accuracy: accuracyScore,
    conversationManagement,
    prioritization,
  };

  // ---- Rule-generated feedback -------------------------------------------
  const feedback: AiFeedback = {
    professionalism:
      professionalTone >= 11
        ? 'Consistently courteous — greetings, empathy, and a clean sign-off were present.'
        : 'Tone was serviceable but missed some professional markers (greeting, empathy, or a closing).',
    grammar:
      grammar >= 8
        ? 'Messages were well-formed with proper capitalization and punctuation.'
        : 'Several replies had grammar or formatting slips (missing capitals, punctuation, or very short fragments).',
    empathy: anyEmpathy
      ? 'Acknowledged customer frustration and showed understanding.'
      : 'Little explicit empathy shown; acknowledging how the customer feels would help.',
    problemSolving: didVerify
      ? 'Verified the account before acting, which is the right instinct.'
      : 'Did not verify the account (order # + last 4 digits) before proceeding.',
    accuracy:
      policyRatio >= 0.99
        ? 'Gave correct, policy-compliant information across the tickets handled.'
        : policyRatio >= 0.5
          ? 'Partially correct — some ticket answers missed a required policy point (e.g. SSN duplicate-filing risk, Vyde tax consult, or the Wyoming member rule).'
          : 'Policy answers were largely incorrect or incomplete for the tickets handled.',
    conversationManagement:
      conversationManagement >= 14
        ? 'Kept multiple chats moving and drove several to resolution.'
        : 'Some conversations were left unattended or unresolved.',
    summary: buildSummary(categories, lateReplies),
  };

  return { categories, feedback };
}

function buildSummary(c: CategoryScores, lateReplies: number): string {
  const total =
    c.responseTime +
    c.grammar +
    c.professionalTone +
    c.accuracy +
    c.conversationManagement +
    c.prioritization;
  const band =
    total >= 85
      ? 'a strong candidate'
      : total >= 70
        ? 'a solid candidate'
        : total >= 55
          ? 'a borderline candidate'
          : 'below the bar for this role';
  const weakest = (
    [
      ['response speed', c.responseTime / 20],
      ['grammar', c.grammar / 10],
      ['professional tone', c.professionalTone / 15],
      ['accuracy', c.accuracy / 20],
      ['conversation management', c.conversationManagement / 20],
      ['prioritization', c.prioritization / 15],
    ] as [string, number][]
  ).sort((a, b) => a[1] - b[1])[0][0];
  const lateNote =
    lateReplies > 0
      ? ` Note: ${lateReplies} repl${lateReplies === 1 ? 'y' : 'ies'} exceeded the 4-minute limit (−${lateReplies * 3} to response time).`
      : '';
  return `Overall ${total}/100 — ${band}. Weakest area was ${weakest}; focus coaching there.${lateNote} Scores are computed from measured response times and rule-based checks on the transcript.`;
}
