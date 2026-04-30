import { useState, useRef, useEffect } from 'react'
import { Send, Brain, User, Sparkles, Database, Loader2, Zap } from 'lucide-react'
import { sendChat } from '../api'

const SUGGESTIONS = [
  "What should I focus on today?",
  "What patterns do you see in my notes?",
  "Summarize what you know about me",
  "What topics come up most in my data?",
]

export default function Chat({ memoriesCount }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()
  const inputRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await sendChat(msg)
      const { reply, sources, chunks_used } = res.data
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        sources,
        chunks_used,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "⚡ Connection error. Make sure the backend is running on port 8000.",
        sources: [],
        chunks_used: 0,
      }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display font-700 text-text tracking-wide">Memory Chat</h2>
          <p className="text-text-dim text-xs font-mono mt-0.5">
            {memoriesCount > 0 ? `${memoriesCount} chunks in memory` : 'No memories loaded'}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono ${
          memoriesCount > 0 ? 'border-emerald/30 bg-emerald/5 text-emerald' : 'border-border text-text-dim'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${memoriesCount > 0 ? 'bg-emerald animate-pulse' : 'bg-muted'}`} />
          {memoriesCount > 0 ? 'RAG Active' : 'No Memory'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-accent-glow border border-accent/30 flex items-center justify-center mb-5 animate-float">
              <Brain size={28} className="text-accent" />
            </div>
            <h3 className="font-display font-700 text-text text-xl mb-2">Ask Your Second Brain</h3>
            <p className="text-text-dim text-sm font-mono max-w-xs mb-8">
              {memoriesCount === 0
                ? 'Upload some notes or PDFs first, then start chatting'
                : 'Your AI has processed your memories. Start asking questions.'
              }
            </p>
            {memoriesCount > 0 && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="text-left p-3 rounded-xl bg-surface border border-border hover:border-accent/40 text-text-dim hover:text-text text-xs font-mono transition-all hover:bg-accent-glow/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 message-enter ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user'
                ? 'bg-accent/20 border border-accent/30'
                : 'bg-surface border border-border'
            }`}>
              {msg.role === 'user'
                ? <User size={14} className="text-accent" />
                : <Brain size={14} className="text-text-dim" />
              }
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent/20 border border-accent/30 text-text rounded-tr-sm'
                  : 'bg-surface border border-border text-text rounded-tl-sm'
              }`}>
                <p className="whitespace-pre-wrap font-mono text-[13px]">{msg.content}</p>
              </div>

              {/* Sources */}
              {msg.role === 'assistant' && msg.sources?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Database size={10} className="text-text-dim" />
                  {msg.sources.map((s, j) => (
                    <span key={j} className="text-[10px] font-mono text-text-dim bg-surface border border-border rounded-full px-2 py-0.5 truncate max-w-[120px]">
                      {s}
                    </span>
                  ))}
                  <span className="text-[10px] font-mono text-text-dim/60">{msg.chunks_used} chunks</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3 message-enter">
            <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center">
              <Brain size={14} className="text-text-dim" />
            </div>
            <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        <div className="flex gap-3 items-end">
          <div className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 focus-within:border-accent/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask your second brain anything..."
              rows={1}
              className="w-full bg-transparent text-text text-sm font-mono resize-none focus:outline-none placeholder-text-dim/40 max-h-24"
              style={{ lineHeight: '1.5' }}
            />
          </div>
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center hover:bg-accent/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            {loading ? <Loader2 size={16} className="text-accent animate-spin" /> : <Send size={16} className="text-accent" />}
          </button>
        </div>
        <p className="text-text-dim/40 text-[10px] font-mono mt-2 text-center">↵ Enter to send · Shift+↵ for newline</p>
      </div>
    </div>
  )
}
