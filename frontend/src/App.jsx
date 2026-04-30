import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import GraphView from './components/GraphView'
import InsightsPanel from './components/InsightsPanel'
import { getMemories } from './api'
import { MessageSquare, GitBranch, Zap } from 'lucide-react'

const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'graph', label: 'Graph', icon: GitBranch },
  { id: 'insights', label: 'Insights', icon: Zap },
]

export default function App() {
  const [tab, setTab] = useState('chat')
  const [memories, setMemories] = useState({ total_chunks: 0, sources: [] })

  const fetchMemories = async () => {
    try {
      const res = await getMemories()
      setMemories(res.data)
    } catch {
      // backend not running yet
    }
  }

  useEffect(() => { fetchMemories() }, [])

  const handleClearAll = () => {
    setMemories({ total_chunks: 0, sources: [] })
  }

  return (
    <div className="flex h-screen bg-void noise grid-bg overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[300px] bg-cyan/3 rounded-full blur-[100px] pointer-events-none" />

      {/* Sidebar */}
      <Sidebar
        memories={memories}
        onMemoriesUpdate={fetchMemories}
        onClearAll={handleClearAll}
      />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <nav className="flex items-center gap-1 px-4 pt-3 border-b border-border bg-panel/50 backdrop-blur-sm">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-mono uppercase tracking-widest transition-all border border-transparent ${
                tab === id
                  ? 'bg-surface border-border border-b-surface text-accent -mb-px relative z-10'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              <Icon size={13} />
              {label}
              {id === 'insights' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-surface/30">
          {tab === 'chat' && <Chat memoriesCount={memories.total_chunks} />}
          {tab === 'graph' && <GraphView />}
          {tab === 'insights' && (
            <InsightsPanel memoriesCount={memories.total_chunks} />
          )}
        </div>
      </main>
    </div>
  )
}
