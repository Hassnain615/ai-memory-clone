import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Library, MessageSquareText, Sparkles, Upload, RefreshCw } from 'lucide-react'
import { EmptyState, PageHeader, StatusDot } from '../components/ui'
import { System, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth.jsx'
import { compact, bytes, timeAgo, KIND_LABEL } from '../lib/format'

export default function Overview() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    System.analytics()
      .then((d) => { setData(d); setError('') })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const first = (user?.name || '').split(' ')[0]
  const t = data?.totals

  return (
    <div className="animate-fade">
      <PageHeader
        title={first ? `Hi ${first}` : 'Overview'}
        description="What's in your memory and how you've been using it."
        actions={
          <>
            <button onClick={load} className="btn-ghost" disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button>
            <Link to="/app/memories" className="btn-primary"><Upload size={15} />Add memories</Link>
          </>
        }
      />

      {error && <p role="alert" className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      ) : data && t.documents === 0 && t.processing === 0 ? (
        <EmptyState
          icon={Library}
          title="Your memory is empty"
          action={<Link to="/app/memories" className="btn-primary"><Upload size={15} />Upload your first document</Link>}
        >
          Upload a PDF, a text file or write a note. Once it's processed you can ask questions about it, explore connections and generate insights.
        </EmptyState>
      ) : data ? (
        <div className="space-y-4">
          {/* Headline stats: one hero metric + supporting ones */}
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
            <div className="relative overflow-hidden glass rounded-2xl p-6">
              <div aria-hidden className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-electric/30 blur-3xl" />
              <p className="relative text-sm text-mist">Documents in memory</p>
              <p className="relative mt-2 text-5xl font-semibold tracking-tight text-white tabular-nums">{t.documents}</p>
              <p className="relative mt-2 text-sm text-dim">
                {t.processing > 0 ? `${t.processing} processing · ` : ''}{bytes(t.storage_bytes)} stored{t.failed ? ` · ${t.failed} failed` : ''}
              </p>
            </div>
            <Stat label="Searchable passages" value={compact(t.chunks)} hint={`${compact(t.words)} words`} />
            <Stat label="Questions asked" value={compact(t.questions)} hint={`${t.conversations} conversation${t.conversations === 1 ? '' : 's'}`} />
            <Stat
              label="Average relevance"
              value={data.avg_relevance != null ? `${Math.round(data.avg_relevance * 100)}%` : '—'}
              hint="of cited passages"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass rounded-2xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Last 14 days</h2>
                <div className="flex items-center gap-4 text-xs text-mist">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-electric" />Uploads</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-cyan" />Questions</span>
                </div>
              </div>
              <ActivityChart days={data.activity} />
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="font-medium">Most cited sources</h2>
              {data.top_sources.length === 0 ? (
                <p className="mt-4 text-sm text-mist">Ask a question in Chat and the sources it relies on will be ranked here.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.top_sources.map((s) => {
                    const max = data.top_sources[0].citations
                    return (
                      <li key={s.title}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="truncate text-frost">{s.title}</span>
                          <span className="tabular-nums text-dim">{s.citations}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-white/[.05]">
                          <div className="h-full rounded-full bg-gradient-to-r from-electric to-cyan" style={{ width: `${(s.citations / max) * 100}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass rounded-2xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Recently added</h2>
                <Link to="/app/memories" className="text-sm text-ice hover:underline underline-offset-4">View all</Link>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {data.recent_documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <StatusDot status={d.status} />
                    <Link to={`/app/memories?doc=${d.id}`} className="flex-1 truncate text-sm text-frost hover:text-ice">{d.title}</Link>
                    <span className="chip">{KIND_LABEL[d.kind] || d.kind}</span>
                    <span className="hidden sm:block w-20 text-right text-xs text-dim">{timeAgo(d.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-2xl p-6">
              <h2 className="font-medium">By type</h2>
              <ul className="mt-4 space-y-2.5">
                {data.by_kind.map((k) => (
                  <li key={k.kind} className="flex items-center justify-between text-sm">
                    <span className="text-mist">{KIND_LABEL[k.kind] || k.kind}</span>
                    <span className="tabular-nums text-frost">{k.count}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid gap-2">
                <Link to="/app/chat" className="btn-ghost justify-start"><MessageSquareText size={15} />Ask your memory</Link>
                <Link to="/app/insights" className="btn-ghost justify-start"><Sparkles size={15} />Generate insights</Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-sm text-mist">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-dim">{hint}</p>
    </div>
  )
}

function ActivityChart({ days }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...days.map((d) => Math.max(d.uploads, d.questions)))
  const W = 700, H = 180, pad = 24
  const step = (W - pad * 2) / days.length
  const bw = Math.min(12, step / 3)
  const y = (v) => H - pad - (v / max) * (H - pad * 2)
  return (
    <div className="relative mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" role="img" aria-label="Uploads and questions per day over the last 14 days">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="rgba(148,163,184,.1)" strokeDasharray={f ? '3 4' : ''} />
        ))}
        {days.map((d, i) => {
          const cx = pad + step * i + step / 2
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - step / 2} y={0} width={step} height={H} fill={hover === i ? 'rgba(255,255,255,.03)' : 'transparent'} />
              <rect x={cx - bw - 1} y={y(d.uploads)} width={bw} height={H - pad - y(d.uploads)} rx={3} fill="#2F6BFF" />
              <rect x={cx + 1} y={y(d.questions)} width={bw} height={H - pad - y(d.questions)} rx={3} fill="#22D3EE" />
              {(i % 2 === 0 || i === days.length - 1) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#6B7489">
                  {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-0 rounded-lg glass-strong px-3 py-2 text-xs" style={{ left: `${((hover + 0.5) / days.length) * 100}%`, transform: 'translateX(-50%)' }}>
          <p className="text-frost">{new Date(`${days[hover].date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="text-mist">{days[hover].uploads} uploads, {days[hover].questions} questions</p>
        </div>
      )}
    </div>
  )
}
