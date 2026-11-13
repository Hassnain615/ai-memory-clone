import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Plus, Send, Square, Trash2, MessageSquareText, X, Filter, FileText, PanelLeft, Copy, Check, BookOpen, Pencil,
} from 'lucide-react'
import Markdown from '../components/Markdown'
import { ConfirmDialog, Logo, Modal, Spinner } from '../components/ui'
import { Conversations, Docs, errorMessage, streamChat } from '../lib/api'
import { useToast } from '../lib/toast.jsx'
import { timeAgo } from '../lib/format'

const STARTERS = [
  'Summarize what I have stored so far',
  'What are the key ideas that connect my documents?',
  'What should I review or study next?',
  'List any open questions or to-dos in my notes',
]

export default function Chat() {
  const toast = useToast()
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const [search, setSearch] = useSearchParams()
  const activeId = conversationId ? Number(conversationId) : null

  const [convs, setConvs] = useState([])
  const [messages, setMessages] = useState([])
  const [loadingConv, setLoadingConv] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [docs, setDocs] = useState([])
  const [scope, setScope] = useState([]) // document ids
  const [pickerOpen, setPickerOpen] = useState(false)
  const [source, setSource] = useState(null) // {msgIdx, n}
  const [listOpen, setListOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const abortRef = useRef(null)
  const skipLoadRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const loadConvs = useCallback(() => Conversations.list().then(setConvs).catch(() => {}), [])
  useEffect(() => { loadConvs() }, [loadConvs])
  useEffect(() => {
    Docs.list().then((d) => setDocs(d.filter((x) => x.status === 'ready'))).catch(() => {})
  }, [])

  // ?doc=ID → scope chat to a document
  useEffect(() => {
    const d = search.get('doc')
    const q = search.get('q')
    if (!d && !q) return
    if (d) setScope([Number(d)])
    if (q) setInput(q)
    setSearch({}, { replace: true })
  }, [search, setSearch])

  // Load conversation messages
  useEffect(() => {
    setSource(null); setListOpen(false)
    if (!activeId) { setMessages([]); return }
    if (skipLoadRef.current === activeId) { skipLoadRef.current = null; return }
    setLoadingConv(true)
    Conversations.get(activeId)
      .then((c) => setMessages(c.messages))
      .catch((e) => { toast(errorMessage(e), 'error'); navigate('/app/chat', { replace: true }) })
      .finally(() => setLoadingConv(false))
  }, [activeId, navigate, toast])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])
  useEffect(() => () => abortRef.current?.abort(), [])

  const send = async (text) => {
    const message = (text ?? input).trim()
    if (!message || sending) return
    setInput('')
    setSending(true)
    setSource(null)
    const startIdx = messages.length
    setMessages((m) => [...m, { role: 'user', content: message }, { role: 'assistant', content: '', sources: [], streaming: true }])
    const controller = new AbortController()
    abortRef.current = controller
    const patchLast = (fn) => setMessages((m) => {
      const copy = m.slice(); const i = copy.length - 1
      copy[i] = fn(copy[i]); return copy
    })
    let convId = activeId

    await streamChat(
      { message, conversation_id: activeId, document_ids: scope.length ? scope : null },
      {
        signal: controller.signal,
        onMeta: (meta) => {
          patchLast((a) => ({ ...a, sources: meta.sources, mode: meta.mode }))
          if (!activeId && meta.conversation_id) {
            convId = meta.conversation_id
            skipLoadRef.current = meta.conversation_id
            navigate(`/app/chat/${meta.conversation_id}`, { replace: true })
          }
        },
        onToken: (t) => patchLast((a) => ({ ...a, content: a.content + t })),
        onDone: (d) => patchLast((a) => ({ ...a, id: d.message_id, streaming: false })),
        onError: (msg) => patchLast((a) => ({ ...a, streaming: false, error: msg, content: a.content || '' })),
      },
    )
    patchLast((a) => ({ ...a, streaming: false }))
    setSending(false)
    abortRef.current = null
    loadConvs()
    if (startIdx === 0 && convId) inputRef.current?.focus()
  }

  const stop = () => { abortRef.current?.abort(); setSending(false) }

  const deleteConv = async () => {
    const id = toDelete.id
    try {
      await Conversations.remove(id)
      setConvs((c) => c.filter((x) => x.id !== id))
      if (id === activeId) navigate('/app/chat')
      toast('Conversation deleted')
    } catch (e) { toast(errorMessage(e), 'error') }
    setToDelete(null)
  }

  const renameConv = async (conv) => {
    const title = window.prompt('Rename conversation', conv.title)
    if (!title?.trim() || title === conv.title) return
    try { await Conversations.rename(conv.id, title.trim()); loadConvs() } catch (e) { toast(errorMessage(e), 'error') }
  }

  const activeSource = source ? messages[source.msgIdx]?.sources?.find((s) => s.n === source.n) : null
  const scopedDocs = docs.filter((d) => scope.includes(d.id))
  const activeConv = convs.find((c) => c.id === activeId)

  const list = (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button onClick={() => navigate('/app/chat')} className="btn-primary w-full"><Plus size={16} />New chat</button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {convs.length === 0 ? (
          <p className="px-3 py-6 text-sm text-dim">Your conversations will appear here.</p>
        ) : (
          <ul className="space-y-0.5">
            {convs.map((c) => (
              <li key={c.id} className="group relative">
                <Link to={`/app/chat/${c.id}`} className={`block rounded-xl px-3 py-2.5 pr-16 transition-colors ${c.id === activeId ? 'bg-electric/[.13] text-frost' : 'text-mist hover:bg-white/[.04] hover:text-frost'}`}>
                  <p className="truncate text-sm">{c.title}</p>
                  <p className="mt-0.5 text-xs text-dim">{timeAgo(c.updated_at)}</p>
                </Link>
                <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => renameConv(c)} className="icon-btn h-7 w-7" aria-label={`Rename ${c.title}`}><Pencil size={13} /></button>
                  <button onClick={() => setToDelete(c)} className="icon-btn h-7 w-7 hover:text-danger" aria-label={`Delete ${c.title}`}><Trash2 size={13} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] lg:h-screen">
      {/* Conversations */}
      <aside className="hidden md:block w-72 shrink-0 border-r border-line bg-abyss/50">{list}</aside>
      {listOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setListOpen(false)} />
          <aside className="relative h-full w-72 border-r border-line bg-abyss animate-rise">{list}</aside>
        </div>
      )}

      {/* Thread */}
      <section className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          <button className="icon-btn md:hidden" onClick={() => setListOpen(true)} aria-label="Conversations"><PanelLeft size={17} /></button>
          <h1 className="truncate text-sm font-medium">{activeConv?.title || (activeId ? 'Conversation' : 'New chat')}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setPickerOpen(true)} className={`btn-ghost h-8 px-3 text-xs ${scope.length ? 'border-electric/50 text-ice' : ''}`}>
              <Filter size={13} />{scope.length ? `${scope.length} document${scope.length > 1 ? 's' : ''}` : 'All memories'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8">
            {loadingConv ? (
              <div className="space-y-4"><div className="skeleton h-10 w-1/2 ml-auto" /><div className="skeleton h-32" /></div>
            ) : messages.length === 0 ? (
              <div className="relative pt-10 text-center">
                <div aria-hidden className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-electric/25 blur-3xl animate-breathe" />
                <div className="relative">
                  <div className="inline-block"><Logo size={48} withText={false} /></div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-tight">What do you want to remember?</h2>
                  <p className="mx-auto mt-2 max-w-md text-mist">
                    {docs.length === 0
                      ? 'Your memory is empty. Add documents first so there is something to answer from.'
                      : scope.length
                        ? `Answers will only use ${scopedDocs.map((d) => `“${d.title}”`).join(', ')}.`
                        : `Ask anything about your ${docs.length} document${docs.length === 1 ? '' : 's'}. Answers cite their sources.`}
                  </p>
                  {docs.length === 0 ? (
                    <Link to="/app/memories" className="btn-primary mt-6">Add memories</Link>
                  ) : (
                    <div className="mx-auto mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
                      {STARTERS.map((s) => (
                        <button key={s} onClick={() => send(s)} className="glass rounded-xl px-4 py-3 text-left text-sm text-mist hover:text-frost hover:border-electric/40 transition-colors">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ul className="space-y-6">
                {messages.map((m, idx) => (
                  <Message key={m.id ?? `tmp-${idx}`} m={m} onCite={(n) => setSource({ msgIdx: idx, n })} activeN={source?.msgIdx === idx ? source.n : null} />
                ))}
              </ul>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 px-4 pb-4">
          <form
            onSubmit={(e) => { e.preventDefault(); send() }}
            className="mx-auto max-w-3xl glass-strong rounded-2xl p-2 shadow-glass focus-within:border-electric/50 focus-within:shadow-aura transition-shadow"
          >
            {scopedDocs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
                {scopedDocs.map((d) => (
                  <span key={d.id} className="chip border-electric/40 text-ice">
                    <FileText size={11} />{d.title}
                    <button type="button" onClick={() => setScope((s) => s.filter((x) => x !== d.id))} aria-label={`Remove ${d.title}`}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px` }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask your memory…"
                aria-label="Message"
                maxLength={4000}
                className="max-h-[200px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-frost placeholder:text-dim outline-none"
              />
              {sending ? (
                <button type="button" onClick={stop} className="btn-ghost h-10 w-10 px-0" aria-label="Stop generating"><Square size={14} /></button>
              ) : (
                <button type="submit" className="btn-primary h-10 w-10 px-0" disabled={!input.trim()} aria-label="Send"><Send size={15} /></button>
              )}
            </div>
          </form>
          <p className="mt-2 text-center text-xs text-dim">Enter to send, Shift + Enter for a new line</p>
        </div>
      </section>

      {/* Source panel */}
      {activeSource && (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-line glass-strong animate-rise xl:static xl:z-auto xl:w-96 xl:max-w-none xl:animate-none">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <h2 className="flex items-center gap-2 text-sm font-medium"><BookOpen size={15} className="text-ice" />Source {activeSource.n}</h2>
            <button className="icon-btn" onClick={() => setSource(null)} aria-label="Close source"><X size={16} /></button>
          </div>
          <div className="space-y-4 overflow-y-auto p-5">
            <div>
              <p className="font-medium">{activeSource.title}</p>
              <p className="mt-1 text-sm text-dim">{activeSource.page ? `Page ${activeSource.page} · ` : ''}{Math.round(activeSource.score * 100)}% relevance</p>
              <div className="mt-3 h-1.5 rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-electric to-cyan" style={{ width: `${Math.max(4, activeSource.score * 100)}%` }} /></div>
            </div>
            <blockquote className="rounded-xl border border-electric/25 bg-electric/[.06] p-4 text-sm leading-7 text-frost/90">{activeSource.snippet}{activeSource.snippet?.length >= 420 ? '…' : ''}</blockquote>
            <Link to={`/app/memories?doc=${activeSource.doc_id}`} className="btn-ghost w-full">Open document</Link>
          </div>
        </aside>
      )}

      <SourcePicker open={pickerOpen} onClose={() => setPickerOpen(false)} docs={docs} scope={scope} setScope={setScope} />
      <ConfirmDialog open={!!toDelete} title="Delete conversation?" message={`“${toDelete?.title}” and its messages will be permanently removed.`} onConfirm={deleteConv} onClose={() => setToDelete(null)} />
    </div>
  )
}

function Message({ m, onCite, activeN }) {
  const [copied, setCopied] = useState(false)
  if (m.role === 'user') {
    return (
      <li className="flex justify-end animate-rise">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-electric/30 to-electric/10 border border-electric/30 px-4 py-2.5 text-[15px] leading-relaxed text-frost whitespace-pre-wrap break-words">
          {m.content}
        </div>
      </li>
    )
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }
  return (
    <li className="flex gap-3 animate-rise">
      <div className="mt-1 shrink-0"><Logo size={26} withText={false} /></div>
      <div className="min-w-0 flex-1">
        {m.streaming && !m.content ? (
          <div className="flex items-center gap-2 py-2 text-sm text-mist">
            <Spinner size={14} className="text-ice" />
            {m.sources?.length ? `Found ${m.sources.length} relevant passages. Writing…` : 'Searching your memory…'}
          </div>
        ) : (
          <Markdown text={m.content} onCite={onCite} streaming={m.streaming} />
        )}
        {m.error && <p role="alert" className="mt-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{m.error}</p>}
        {m.sources?.length > 0 && !m.streaming && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {m.sources.map((s) => (
              <button key={s.n} onClick={() => onCite(s.n)}
                className={`chip max-w-[240px] transition-colors hover:border-electric/50 hover:text-frost ${activeN === s.n ? 'border-electric/60 text-ice bg-electric/10' : ''}`}>
                <span className="font-mono text-[10px] text-ice">{s.n}</span>
                <span className="truncate">{s.title}{s.page ? ` p.${s.page}` : ''}</span>
              </button>
            ))}
            <button onClick={copy} className="icon-btn h-7 w-7 ml-1" aria-label="Copy answer">{copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}</button>
          </div>
        )}
      </div>
    </li>
  )
}

function SourcePicker({ open, onClose, docs, scope, setScope }) {
  const [q, setQ] = useState('')
  const toggle = (id) => setScope((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(0, 50)))
  const shown = docs.filter((d) => d.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal open={open} onClose={onClose} title="Choose what to search">
      <p className="text-sm text-mist">Limit answers to specific documents, or leave everything unselected to search all memories.</p>
      <input className="field mt-4" placeholder="Filter documents" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter documents" />
      <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
        {shown.length === 0 && <li className="py-6 text-center text-sm text-dim">No ready documents match.</li>}
        {shown.map((d) => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[.04]">
              <input type="checkbox" checked={scope.includes(d.id)} onChange={() => toggle(d.id)} className="h-4 w-4 accent-[#2F6BFF]" />
              <span className="flex-1 truncate text-sm">{d.title}</span>
              <span className="text-xs text-dim">{d.chunk_count} passages</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-between">
        <button className="btn-quiet" onClick={() => setScope([])} disabled={!scope.length}>Search all memories</button>
        <button className="btn-primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}
