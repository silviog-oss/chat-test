import { useState } from 'react';
import { AssessmentResult } from '../lib/types';
import { Card, Stat, Avatar } from './ui';

const CAT_META: { key: keyof AssessmentResult['categories']; label: string; max: number }[] = [
  { key: 'responseTime', label: 'Response time', max: 20 },
  { key: 'grammar', label: 'Grammar', max: 10 },
  { key: 'professionalTone', label: 'Professional tone', max: 15 },
  { key: 'accuracy', label: 'Accuracy', max: 20 },
  { key: 'conversationManagement', label: 'Conversation mgmt', max: 20 },
  { key: 'prioritization', label: 'Prioritization', max: 15 },
];

export default function ScoreReport({
  r,
  adminEmail,
  onSaveGrade,
}: {
  r: AssessmentResult;
  adminEmail?: string;
  onSaveGrade?: (grade: {
    manualScore: number | null;
    manualVerdict: 'pass' | 'fail' | null;
    manualNotes: string;
    manualGradedBy: string;
  }) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">{r.name}</h2>
          <p className="text-sm opacity-60">
            {r.email} · {new Date(r.dateTaken).toLocaleString()}
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            r.passed ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'
          }`}
        >
          Auto: {r.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>

      {/* Manual admin grade — only shown to admins (when handlers are passed) */}
      {adminEmail && onSaveGrade && (
        <ManualGradePanel r={r} adminEmail={adminEmail} onSave={onSaveGrade} />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Auto overall" value={`${r.overall}/100`} />
        <Stat label="WPM" value={r.typing.wpm} />
        <Stat label="Accuracy" value={`${r.typing.accuracy}%`} />
        <Stat
          label="Time spent"
          value={`${Math.round(r.timeSpentSeconds / 60)}m`}
        />
      </div>

      <Card>
        <h3 className="mb-3 font-display font-bold">Category breakdown</h3>
        <div className="space-y-2">
          {CAT_META.map((c) => {
            const val = r.categories[c.key];
            const pct = (val / c.max) * 100;
            return (
              <div key={c.key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{c.label}</span>
                  <span className="font-mono opacity-70">
                    {val}/{c.max}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-line/50">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display font-bold">AI feedback</h3>
        <div className="space-y-3 text-sm">
          <Fb label="Summary" text={r.aiFeedback.summary} highlight />
          <Fb label="Professionalism" text={r.aiFeedback.professionalism} />
          <Fb label="Grammar" text={r.aiFeedback.grammar} />
          <Fb label="Empathy" text={r.aiFeedback.empathy} />
          <Fb label="Problem-solving" text={r.aiFeedback.problemSolving} />
          <Fb label="Accuracy" text={r.aiFeedback.accuracy} />
          <Fb
            label="Conversation management"
            text={r.aiFeedback.conversationManagement}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display font-bold">Transcripts</h3>
        <div className="space-y-5">
          {r.transcripts.map((t) => (
            <div key={t.personaId}>
              <div className="mb-2 flex items-center gap-2">
                <Avatar
                  initials={t.personaName
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                  color="#2F6FED"
                  size={26}
                />
                <span className="font-medium">{t.personaName}</span>
                <span
                  className={`text-xs ${t.resolved ? 'text-good' : 'opacity-50'}`}
                >
                  {t.resolved ? 'resolved' : 'open'}
                </span>
              </div>
              <div className="space-y-1.5">
                {t.turns.map((turn, i) => (
                  <div
                    key={i}
                    className={`flex ${turn.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm ${
                        turn.role === 'agent'
                          ? 'bg-primary text-white'
                          : 'bg-line/40'
                      }`}
                    >
                      {turn.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Fb({
  label,
  text,
  highlight,
}: {
  label: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'rounded-lg bg-primary/10 p-3' : ''}>
      <span className="font-semibold">{label}: </span>
      <span className="opacity-80">{text}</span>
    </div>
  );
}

function ManualGradePanel({
  r,
  adminEmail,
  onSave,
}: {
  r: AssessmentResult;
  adminEmail: string;
  onSave: (grade: {
    manualScore: number | null;
    manualVerdict: 'pass' | 'fail' | null;
    manualNotes: string;
    manualGradedBy: string;
  }) => Promise<void>;
}) {
  const [score, setScore] = useState<string>(
    r.manualScore != null ? String(r.manualScore) : ''
  );
  const [verdict, setVerdict] = useState<'pass' | 'fail' | ''>(
    r.manualVerdict ?? ''
  );
  const [notes, setNotes] = useState<string>(r.manualNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave({
        manualScore: score === '' ? null : Math.max(0, Math.min(100, Number(score))),
        manualVerdict: verdict === '' ? null : verdict,
        manualNotes: notes,
        manualGradedBy: adminEmail,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/40 bg-primary/5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-bold">Manual grade (admin)</h3>
        {r.manualGradedBy && (
          <span className="text-xs text-muted">
            Last graded by {r.manualGradedBy}
            {r.manualGradedAt
              ? ` · ${new Date(r.manualGradedAt).toLocaleDateString()}`
              : ''}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[120px_160px_1fr]">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">
            Score /100
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="—"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">
            Verdict
          </label>
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as 'pass' | 'fail' | '')}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">—</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. EIN answer was incorrect — gave IRS record-update steps instead of offering the SSN retry."
            className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primarySoft disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save grade'}
        </button>
        {saved && <span className="text-sm text-good">Saved ✓</span>}
      </div>
    </Card>
  );
}
