import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Sparkles, RefreshCw, Target, Repeat, Link2, HelpCircle, Lightbulb, Library } from 'lucide-react'
import { EmptyState, PageHeader, Spinner } from '../components/ui'
import { Insights as InsightsApi, errorMessage } from '../lib/api'
import { useToast } from '../lib/toast.jsx'
import { timeAgo } from '../lib/format'

export default function Insights() {
  const toast = useToast()
  const { health } = useOutletContext() || {}
  const [insight, setInsight] = useState(undefined)
  const [topics, setTopics] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    InsightsApi.latest().then(setInsight).catch((e) => { setInsight(null); setError(errorMessage(e)) })
    InsightsApi.topics().then(setTopics).catch(() => {})
  }, [])

  const generate = async () => {
    setBusy(true); setError('')
    try { setInsight(await InsightsApi.generate()); toast('Fresh insights generated') } catch (e) { setError(errorMessage(e)) }
    setBusy(false)
  }

  const llmMissing = health?.status === 'ok' && !health?.llm?.available
  const maxScore = Math.max(...topics.map((t) => t.score), 0.0001)

  return (
    <div className="animate-fade">
      <PageHeader
        title="Insights"
        description="An AI read of everything in your memory: what you focus on, recurring patterns, gaps and what to do next."
        actions={
          <button className="btn-primary" onClick={generate} disabled={busy || llmMissing || topics.length === 0}>
            {busy ? <Spinner size={15} /> : insight ? <RefreshCw size={15} /> : <Sparkles size={15} />}
            {busy ? 'Analyzing your memory…' : insight ? 'Regenerate insights' : 'Generate insights'}
          </button>
        }
      />

      {llmMissing && (
        <p className="mb-6 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Insights need a language model. Add <code className="font-mono">GEMINI_API_KEY</code> to <code className="font-mono">backend/.env</code> and restart the backend. Topic analysis below still works without it.
        </p>
      )}
      {error && <p role="alert" className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {topics.length > 0 && (
        <section className="glass rounded-2xl p-6 mb-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Recurring topics</h2>
            <p className="text-xs text-dim">Ranked by how many documents mention them</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {topics.map((t) => {
              const s = t.score / maxScore
              return (
                <Link
                  key={t.term}
                  to={`/app/chat?q=${encodeURIComponent(`What do my notes say about ${t.term}?`)}`}
                  className="rounded-full border px-3 py-1 transition-colors hover:border-ice/60 hover:text-white"
                  style={{
                    fontSize: `${12 + s * 7}px`,
                    borderColor: `rgba(47,107,255,${0.2 + s * 0.5})`,
                    background: `rgba(47,107,255,${0.04 + s * 0.16})`,
                    color: s > 0.5 ? '#E6EDF7' : '#A3AEC2',
                  }}
                  title={`${t.documents} document${t.documents === 1 ? '' : 's'}`}
                >
                  {t.term}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {insight === undefined ? (
        <div className="space-y-4"><div className="skeleton h-36" /><div className="grid gap-4 md:grid-cols-2"><div className="skeleton h-48" /><div className="skeleton h-48" /></div></div>
      ) : !insight ? (
        topics.length === 0 ? (
          <EmptyState icon={Library} title="Add memories to unlock insights" action={<Link to="/app/memories" className="btn-primary">Add memories</Link>}>
            Insights look across all your documents, so they work best with at least a few notes or files.
          </EmptyState>
        ) : (
          <EmptyState icon={Sparkles} title="No insights yet" action={!llmMissing && <button className="btn-primary" onClick={generate} disabled={busy}>{busy ? <Spinner size={15} /> : <Sparkles size={15} />}Generate insights</button>}>
            Generate an analysis of your memory. It takes 10 to 30 seconds depending on how much you've stored.
          </EmptyState>
        )
      ) : (
        <div className={`space-y-4 ${busy ? 'opacity-60 transition-opacity' : ''}`}>
          <section className="relative overflow-hidden rounded-2xl border border-electric/30 bg-gradient-to-br from-electric/[.14] via-abyss to-abyss p-7">
            <div aria-hidden className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan/20 blur-3xl" />
            <p className="relative text-xs text-dim">Generated {timeAgo(insight.created_at)} from {insight.documents_analyzed} documents{insight.model ? ` with ${insight.model}` : ''}</p>
            <p className="relative mt-3 text-xl leading-relaxed text-frost max-w-3xl">{insight.summary}</p>
            {insight.personality_insight && <p className="relative mt-4 text-[15px] text-ice/90 max-w-3xl">{insight.personality_insight}</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel icon={Target} title="Focus areas">
              <ul className="space-y-4">
                {insight.focus_areas.map((f) => (
                  <li key={f.topic}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{f.topic}</span>
                      <span className="font-mono text-xs text-ice tabular-nums">{f.strength}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/[.06]">
                      <div className="h-full rounded-full bg-gradient-to-r from-electric to-cyan transition-[width] duration-700" style={{ width: `${f.strength}%` }} />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-mist">{f.description}</p>
                  </li>
                ))}
              </ul>
            </Panel>
            <div className="space-y-4">
              <Panel icon={Repeat} title="Patterns">
                <ul className="space-y-2.5">{insight.patterns.map((p, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed text-mist"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ice" />{p}</li>)}</ul>
              </Panel>
              {insight.knowledge_gaps?.length > 0 && (
                <Panel icon={HelpCircle} title="Knowledge gaps">
                  <ul className="space-y-2.5">{insight.knowledge_gaps.map((g, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed text-mist"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn" />{g}</li>)}</ul>
                </Panel>
              )}
            </div>
          </div>

          {insight.connections?.length > 0 && (
            <Panel icon={Link2} title="Connections between ideas">
              <ul className="grid gap-3 md:grid-cols-2">
                {insight.connections.map((c, i) => (
                  <li key={i} className="rounded-xl border border-line bg-white/[.02] p-4">
                    <p className="text-sm font-medium"><span className="text-frost">{c.from}</span> <span className="text-dim">and</span> <span className="text-frost">{c.to}</span></p>
                    <p className="mt-1.5 text-sm leading-relaxed text-mist">{c.insight}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel icon={Lightbulb} title="Suggested next steps">
            <ol className="grid gap-3 md:grid-cols-2">
              {insight.suggestions.map((s, i) => (
                <li key={i} className="rounded-xl border border-line bg-white/[.02] p-4">
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist">{s.detail}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      )}
    </div>
  )
}

function Panel({ icon: Icon, title, children }) {
  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="mb-4 flex items-center gap-2 font-medium"><Icon size={16} className="text-ice" />{title}</h2>
      {children}
    </section>
  )
}
