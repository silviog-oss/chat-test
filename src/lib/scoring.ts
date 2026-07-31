import {
  CategoryScores,
  AiFeedback,
  ConversationTranscript,
} from './types';
import { detectSignals } from './personas';
import { PASS_THRESHOLDS } from './config';

// ---------------------------------------------------------------------------
// Deterministic, client-side scoring. Six evenly-weighted categories (100 pts):
//   Grammar 17 · Typing speed 17 · Response speed 17 · Professionalism 17 ·
//   Tone 16 · Empathy 16.
// The automated score is a first pass; admins can override with a manual grade.
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

interface ScoreInput {
  transcripts: ConversationTranscript[];
  responseTimesMs: number[];
  firstReplyOrder: string[];
  priorityById: Record<string, 'low' | 'medium' | 'high'>;
  // Typing test result, so typing speed can be one of the six categories.
  typingWpm: number;
  typingAccuracy: number;
}

export interface ScoreResult {
  categories: CategoryScores;
  feedback: AiFeedback;
}

export function scoreAssessment(input: ScoreInput): ScoreResult {
  const { transcripts, responseTimesMs, typingWpm } = input;

  const agentText = transcripts.flatMap((t) =>
    t.turns.filter((x) => x.role === 'agent').map((x) => x.text)
  );
  const totalAgentMsgs = agentText.length;

  // ---- Grammar (/17) ------------------------------------------------------
  // Capitalization, sentence-ending punctuation, sensible length, no double
  // spaces. Also softly penalize if there are many likely errors.
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
      : Math.round(clamp((grammarPoints / grammarChecks) * 17, 0, 17));

  // ---- Typing speed (/17) -------------------------------------------------
  // Scales with WPM against the passing target. At/above target -> full marks;
  // 0 wpm -> 0. Linear in between.
  const target = PASS_THRESHOLDS.minWpm; // e.g. 45
  const typingSpeed = Math.round(clamp((typingWpm / target) * 17, 0, 17));

  // ---- Response speed (/17) -----------------------------------------------
  // Reward a low average reply time. <=15s -> full; >=4min -> 0. Also apply the
  // 4-minute rule as a flat penalty per late reply.
  const avgMs =
    responseTimesMs.length > 0
      ? responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length
      : 240000;
  const avgSec = avgMs / 1000;
  const FOUR_MIN = 240; // seconds
  const base =
    totalAgentMsgs === 0
      ? 0
      : clamp(17 - ((avgSec - 15) * 17) / (FOUR_MIN - 15), 0, 17);
  const lateReplies = responseTimesMs.filter((ms) => ms > FOUR_MIN * 1000).length;
  const responseSpeed = Math.round(clamp(base - lateReplies * 3, 0, 17));

  // ---- Professionalism (/17) ---------------------------------------------
  // Greeting at the start, a closure before ending, offering further help,
  // verifying before sharing info, and no shouting (all caps).
  const anyGreeted = agentText.some((m) => detectSignals(m).greeted);
  const anyClosing = agentText.some((m) => detectSignals(m).closing);
  const offeredMore = agentText.some((m) => {
    const t = m.toLowerCase();
    return (
      t.includes('anything else') ||
      t.includes('is there anything') ||
      t.includes('further assistance') ||
      t.includes('help you with')
    );
  });
  const verified = agentText.some((m) => detectSignals(m).askedVerification);
  const noAllCaps = !agentText.some((m) => m.length > 4 && m === m.toUpperCase());
  let prof = 0;
  prof += anyGreeted ? 4 : 0;
  prof += anyClosing ? 4 : 0;
  prof += offeredMore ? 3 : 0;
  prof += verified ? 3 : 0;
  prof += noAllCaps ? 3 : 0;
  const professionalism = Math.round(clamp(prof, 0, 17));

  // ---- Tone (/16) ---------------------------------------------------------
  // Warm, courteous phrasing: pleasantries, "please/thank you", positive
  // language; penalize curtness (very short one-word replies) and rudeness.
  const politeMarkers = agentText.filter((m) => {
    const t = m.toLowerCase();
    return (
      t.includes('please') ||
      t.includes('thank you') ||
      t.includes('thanks') ||
      t.includes('happy to') ||
      t.includes('glad') ||
      t.includes('of course') ||
      t.includes('certainly') ||
      t.includes('my pleasure') ||
      t.includes('appreciate')
    );
  }).length;
  const politeRatio = totalAgentMsgs ? politeMarkers / totalAgentMsgs : 0;
  const curtReplies = agentText.filter(
    (m) => m.trim().split(/\s+/).filter(Boolean).length <= 2
  ).length;
  const rude = agentText.some((m) => {
    const t = m.toLowerCase();
    return (
      t.includes('whatever') ||
      t.includes('calm down') ||
      t.includes('not my problem') ||
      t.includes("that's not") ||
      t.includes('you should have')
    );
  });
  let tone = 4 + politeRatio * 12; // base 4, up to +12 for consistent warmth
  tone -= curtReplies * 1.5;
  if (rude) tone -= 6;
  const toneScore = Math.round(clamp(tone, 0, 16));

  // ---- Empathy (/16) ------------------------------------------------------
  // Acknowledging feelings / situation, reassurance, understanding.
  const empathyHits = agentText.filter((m) => detectSignals(m).empathy).length;
  const acknowledgedIssue = agentText.some((m) => {
    const t = m.toLowerCase();
    return (
      t.includes('sorry') ||
      t.includes('i understand') ||
      t.includes('i see how') ||
      t.includes('that must') ||
      t.includes('i realize') ||
      t.includes('i know this') ||
      t.includes('rest assured') ||
      t.includes('i can imagine')
    );
  });
  let emp = 0;
  emp += Math.min(empathyHits, 3) * 3; // up to 9 for repeated empathy
  emp += acknowledgedIssue ? 5 : 0;
  emp += empathyHits > 0 && politeRatio > 0.3 ? 2 : 0;
  const empathy = Math.round(clamp(emp, 0, 16));

  const categories: CategoryScores = {
    grammar,
    typingSpeed,
    responseSpeed,
    professionalism,
    tone: toneScore,
    empathy,
  };

  const total =
    grammar + typingSpeed + responseSpeed + professionalism + toneScore + empathy;

  const feedback: AiFeedback = {
    grammar:
      grammar >= 13
        ? 'Messages were well-formed with proper capitalization and punctuation.'
        : 'Several replies had grammar or formatting slips (missing capitals, punctuation, or very short fragments).',
    typingSpeed:
      typingSpeed >= 13
        ? `Typing speed was strong (${typingWpm} WPM, target ${target}).`
        : `Typing speed was below target (${typingWpm} WPM vs ${target} WPM expected).`,
    responseSpeed:
      responseSpeed >= 13
        ? `Replied promptly (avg ${Math.round(avgSec)}s).`
        : `Replies were slow (avg ${Math.round(avgSec)}s; target under 4 minutes each)${
            lateReplies ? `, with ${lateReplies} over the 4-minute limit` : ''
          }.`,
    professionalism:
      professionalism >= 13
        ? 'Professional throughout — greeted, verified, offered further help, and closed cleanly.'
        : 'Missed some professional steps (greeting, verification, offering more help, or a closing message).',
    tone:
      toneScore >= 12
        ? 'Warm and courteous tone with consistent pleasantries.'
        : rude
          ? 'Tone came across as curt or dismissive at points — avoid brush-off phrasing.'
          : 'Tone was serviceable but could be warmer (more please/thank-you, fuller replies).',
    empathy: acknowledgedIssue
      ? 'Acknowledged the customer’s situation and showed understanding.'
      : 'Little empathy shown; acknowledging how the customer feels would help.',
    summary: buildSummary(categories, total, avgSec, responseTimesMs.length, lateReplies, typingWpm, target),
  };

  return { categories, feedback };
}

function buildSummary(
  c: CategoryScores,
  total: number,
  avgSec: number,
  replyCount: number,
  lateReplies: number,
  wpm: number,
  wpmTarget: number
): string {
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
      ['grammar', c.grammar / 17],
      ['typing speed', c.typingSpeed / 17],
      ['response speed', c.responseSpeed / 17],
      ['professionalism', c.professionalism / 17],
      ['tone', c.tone / 16],
      ['empathy', c.empathy / 16],
    ] as [string, number][]
  ).sort((a, b) => a[1] - b[1])[0][0];
  const avgNote =
    replyCount > 0
      ? ` Avg response time ${Math.round(avgSec)}s across ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}${
          lateReplies ? ` (${lateReplies} over 4 min)` : ''
        }.`
      : '';
  const wpmNote = ` Typing ${wpm} WPM (target ${wpmTarget}).`;
  return `Overall ${total}/100 — ${band}. Weakest area was ${weakest}; focus coaching there.${avgNote}${wpmNote} Scores are rule-based; use the manual grade for the final verdict.`;
}
