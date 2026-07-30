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

export default function ScoreReport({ r }: { r: AssessmentResult }) {
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
          {r.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Overall" value={`${r.overall}/100`} />
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
