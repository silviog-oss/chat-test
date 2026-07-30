import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { getAllResults, deleteResult } from '../lib/data';
import { AssessmentResult } from '../lib/types';
import { Logo, Spinner, Stat, Card } from '../components/ui';
import ScoreReport from '../components/ScoreReport';

type SortKey = 'overall' | 'wpm' | 'date' | 'name';

export default function AdminDashboard() {
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('overall');
  const [selected, setSelected] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    getAllResults()
      .then(setRows)
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    const list = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term)
    );
    list.sort((a, b) => {
      switch (sort) {
        case 'wpm':
          return b.typing.wpm - a.typing.wpm;
        case 'date':
          return b.dateTaken - a.dateTaken;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return b.overall - a.overall;
      }
    });
    return list;
  }, [rows, q, sort]);

  const stats = useMemo(() => {
    if (!rows.length)
      return { avg: 0, hi: 0, lo: 0, typing: 0, passRate: 0 };
    const overalls = rows.map((r) => r.overall);
    const passes = rows.filter((r) => r.passed).length;
    return {
      avg: Math.round(overalls.reduce((a, b) => a + b, 0) / rows.length),
      hi: Math.max(...overalls),
      lo: Math.min(...overalls),
      typing: Math.round(
        rows.reduce((a, r) => a + r.typing.wpm, 0) / rows.length
      ),
      passRate: Math.round((passes / rows.length) * 100),
    };
  }, [rows]);

  function exportCsv() {
    const header = [
      'Name',
      'Email',
      'Date',
      'Overall',
      'WPM',
      'Accuracy',
      'ResponseTime',
      'Grammar',
      'ProfessionalTone',
      'AccuracyScore',
      'ConversationMgmt',
      'Prioritization',
      'Passed',
    ];
    const lines = filtered.map((r) =>
      [
        r.name,
        r.email,
        new Date(r.dateTaken).toISOString(),
        r.overall,
        r.typing.wpm,
        r.typing.accuracy,
        r.categories.responseTime,
        r.categories.grammar,
        r.categories.professionalTone,
        r.categories.accuracy,
        r.categories.conversationManagement,
        r.categories.prioritization,
        r.passed ? 'PASS' : 'FAIL',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assessment-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onDelete(r: AssessmentResult) {
    if (!confirm(`Delete ${r.name}'s submission? This frees their attempt.`))
      return;
    await deleteResult(r.uid);
    setRows((prev) => prev.filter((x) => x.uid !== r.uid));
    if (selected?.uid === r.uid) setSelected(null);
  }

  if (!isAdmin)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold">Admins only</h2>
          <button
            onClick={() => nav('/')}
            className="mt-4 rounded-lg border border-line px-4 py-2"
          >
            Back
          </button>
        </div>
      </div>
    );

  const chartData = [...filtered]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 10)
    .map((r) => ({ name: r.name.split(' ')[0], score: r.overall }));

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-60">{user?.email}</span>
          <button
            onClick={() => signOut().then(() => nav('/'))}
            className="rounded-lg border border-line px-3 py-1.5 hover:bg-line/30"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {selected ? (
          <>
            <button
              onClick={() => setSelected(null)}
              className="mb-6 text-sm text-primary hover:underline"
            >
              ← Back to all candidates
            </button>
            <ScoreReport r={selected} />
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h1 className="font-display text-3xl font-bold">
                Candidates
                <span className="ml-2 text-lg opacity-50">{rows.length}</span>
              </h1>
              <button
                onClick={exportCsv}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primarySoft"
              >
                Export CSV
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Avg score" value={stats.avg} />
              <Stat label="Highest" value={stats.hi} />
              <Stat label="Lowest" value={stats.lo} />
              <Stat label="Avg WPM" value={stats.typing} />
              <Stat label="Pass rate" value={`${stats.passRate}%`} />
              <Stat label="Total" value={rows.length} />
            </div>

            {loading ? (
              <Spinner label="Loading candidates…" />
            ) : rows.length === 0 ? (
              <Card>No submissions yet.</Card>
            ) : (
              <>
                <Card className="mb-6">
                  <h3 className="mb-3 font-display font-bold">
                    Top 10 leaderboard
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#E6E8EF"
                        />
                        <XAxis dataKey="name" stroke="#5B6070" fontSize={12} />
                        <YAxis
                          domain={[0, 100]}
                          stroke="#5B6070"
                          fontSize={12}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#FFFFFF',
                            border: '1px solid #E6E8EF',
                            borderRadius: 8,
                            color: '#1A1A2E',
                          }}
                        />
                        <Bar dataKey="score" fill="#F26522" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div className="mb-4 flex flex-wrap gap-3">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name or email…"
                    className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none dark:bg-slate1"
                  />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none dark:bg-slate1"
                  >
                    <option value="overall">Sort: Overall</option>
                    <option value="wpm">Sort: WPM</option>
                    <option value="date">Sort: Date</option>
                    <option value="name">Sort: Name</option>
                  </select>
                </div>

                <Card className="overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-line text-left opacity-60">
                      <tr>
                        <th className="p-3">Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">WPM</th>
                        <th className="p-3" title="Response time /20">Resp</th>
                        <th className="p-3" title="Grammar /10">Gram</th>
                        <th className="p-3" title="Professional tone /15">Tone</th>
                        <th className="p-3" title="Accuracy /20">Acc</th>
                        <th className="p-3" title="Conversation management /20">Conv</th>
                        <th className="p-3" title="Prioritization /15">Prio</th>
                        <th className="p-3">Overall</th>
                        <th className="p-3">Result</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr
                          key={r.uid}
                          className="border-b border-line/40 hover:bg-line/10"
                        >
                          <td className="p-3 font-medium">{r.name}</td>
                          <td className="p-3 opacity-70">{r.email}</td>
                          <td className="p-3 opacity-70">
                            {new Date(r.dateTaken).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono">{r.typing.wpm}</td>
                          <td className="p-3 font-mono opacity-80">{r.categories.responseTime}</td>
                          <td className="p-3 font-mono opacity-80">{r.categories.grammar}</td>
                          <td className="p-3 font-mono opacity-80">{r.categories.professionalTone}</td>
                          <td className="p-3 font-mono opacity-80">{r.categories.accuracy}</td>
                          <td className="p-3 font-mono opacity-80">{r.categories.conversationManagement}</td>
                          <td className="p-3 font-mono opacity-80">{r.categories.prioritization}</td>
                          <td className="p-3 font-mono font-semibold">{r.overall}</td>
                          <td className="p-3">
                            <span
                              className={
                                r.passed ? 'text-good' : 'text-bad'
                              }
                            >
                              {r.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelected(r)}
                              className="mr-2 text-primary hover:underline"
                            >
                              View
                            </button>
                            <button
                              onClick={() => onDelete(r)}
                              className="text-bad hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
