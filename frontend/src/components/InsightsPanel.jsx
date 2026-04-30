import { useState } from 'react'
import { Zap, Brain, TrendingUp, Lightbulb, Target, Loader2, ChevronRight, AlertCircle } from 'lucide-react'
import { analyzeBrain } from '../api'

export default function InsightsPanel({ memoriesCount, onClose }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await analyzeBrain()
      if (res.data.error) {
        setError(res.data.error)
      } else {
        setData(res.data)
      }
    } catch {
      setError('Analysis failed. Check backend connection.')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display font-700 text-text tracking-wide">Brain Analysis</h2>
          <p className="text-text-dim text-xs font-mono mt-0.5">Understand your knowledge patterns</p>
        </div>
        {!loading && !data && (
          <button
            onClick={analyze}
            disabled={memoriesCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/20 border border-accent/40 text-accent text-sm font-display font-600 hover:bg-accent/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed animate-glow"
          >
            <Zap size={14} />
            Analyze My Brain
          </button>
        )}
        {data && (
          <button onClick={() => setData(null)} className="text-text-dim text-xs font-mono hover:text-text transition-colors">
            ↺ Re-analyze
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Empty state */}
        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-3xl bg-accent-glow border border-accent/30 flex items-center justify-center mb-5 animate-float">
              <Brain size={36} className="text-accent" />
            </div>
            <h3 className="font-display font-700 text-text text-xl mb-2">Discover Your Mind</h3>
            <p className="text-text-dim text-sm font-mono max-w-sm">
              {memoriesCount === 0
                ? 'Upload at least a few notes or PDFs, then analyze your knowledge patterns'
                : `You have ${memoriesCount} memory chunks ready for analysis`
              }
            </p>
            {memoriesCount > 0 && (
              <button
                onClick={analyze}
                className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-accent border border-accent/60 text-void text-sm font-display font-700 hover:bg-accent-bright transition-all"
              >
                <Zap size={16} />
                Analyze My Brain
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-accent/20 animate-spin" style={{ borderTopColor: '#7c6aff' }} />
              <Brain size={20} className="text-accent absolute inset-0 m-auto" />
            </div>
            <div className="text-center">
              <p className="text-text font-display font-600">Scanning your knowledge base...</p>
              <p className="text-text-dim text-xs font-mono mt-1">Finding patterns and insights</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <AlertCircle size={16} className="text-red-400 mt-0.5" />
            <p className="text-red-400 text-sm font-mono">{error}</p>
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6 animate-fade-in">
            {/* Summary */}
            {data.summary && (
              <div className="bg-accent-glow/20 border border-accent/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} className="text-accent" />
                  <span className="text-accent text-xs font-mono uppercase tracking-widest">Overview</span>
                </div>
                <p className="text-text text-sm font-mono leading-relaxed">{data.summary}</p>
                {data.personality_insight && (
                  <p className="text-text-dim text-xs font-mono mt-3 italic">"{data.personality_insight}"</p>
                )}
              </div>
            )}

            {/* Focus Areas */}
            {data.focus_areas?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target size={14} className="text-cyan" />
                  <span className="text-cyan text-xs font-mono uppercase tracking-widest">Focus Areas</span>
                </div>
                <div className="space-y-3">
                  {data.focus_areas.map((area, i) => (
                    <div key={i} className="insight-card rounded-xl p-4 bg-surface">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-text text-sm font-display font-600">{area.topic}</span>
                        <span className="text-text-dim text-xs font-mono">{area.strength}%</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5 mb-2">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-accent to-cyan progress-fill"
                          style={{ width: `${area.strength}%` }}
                        />
                      </div>
                      <p className="text-text-dim text-xs font-mono">{area.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Patterns */}
            {data.patterns?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-emerald" />
                  <span className="text-emerald text-xs font-mono uppercase tracking-widest">Patterns Detected</span>
                </div>
                <div className="space-y-2">
                  {data.patterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 insight-card rounded-xl p-3 bg-surface">
                      <ChevronRight size={12} className="text-emerald mt-0.5 flex-shrink-0" />
                      <p className="text-text-dim text-sm font-mono">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {data.suggestions?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} className="text-amber" />
                  <span className="text-amber text-xs font-mono uppercase tracking-widest">Suggestions</span>
                </div>
                <div className="space-y-3">
                  {data.suggestions.map((s, i) => (
                    <div key={i} className="insight-card rounded-xl p-4 bg-surface border-l-2 border-amber/40">
                      <p className="text-text text-sm font-display font-600 mb-1">{s.title}</p>
                      <p className="text-text-dim text-xs font-mono">{s.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
