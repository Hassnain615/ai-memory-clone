import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  Upload, FileText, StickyNote, FileType2, Search, X, Trash2, PenLine, MessageSquareText,
  RefreshCw, AlertCircle, Library, Sparkles, Check,
} from 'lucide-react'
import { ConfirmDialog, EmptyState, Modal, PageHeader, Spinner, StatusDot } from '../components/ui'
import { Docs, errorMessage } from '../lib/api'
import { useToast } from '../lib/toast.jsx'
import { bytes, timeAgo, KIND_LABEL } from '../lib/format'

const KIND_ICON = { pdf: FileType2, text: FileText, markdown: FileText, note: StickyNote }
const ACCEPT = '.pdf,.txt,.md,.markdown'

export default function Memories() {
  const toast = useToast()
  const { health } = useOutletContext() || {}
  const [params, setParams] = useSearchParams()
  const [docs, setDocs] = useState(null)
  const [error, setError] = useState('')
  const [uploads, setUploads] = useState([]) // {id, name, progress, error}
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const fileRef = useRef(null)
  const openId = params.get('doc') ? Number(params.get('doc')) : null
  const maxMb = health?.max_upload_mb || 20

  const load = useCallback(async () => {
    try { setDocs(await Docs.list()); setError('') } catch (e) { setError(errorMessage(e)) }
  }, [])
  useEffect(() => { load() }, [load])

  // Poll while anything is processing
  const processing = docs?.some((d) => d.status === 'processing')
  useEffect(() => {
    if (!processing) return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [processing, load])

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    for (const file of files) {
      const id = `${file.name}-${Date.now()}-${Math.random()}`
      const ext = file.name.split('.').pop().toLowerCase()
      if (!['pdf', 'txt', 'md', 'markdown'].includes(ext)) {
        toast(`${file.name}: only PDF, TXT and Markdown files are supported`, 'error'); continue
      }
      if (file.size > maxMb * 1024 * 1024) {
        toast(`${file.name} is larger than ${maxMb} MB`, 'error'); continue
      }
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }])
      try {
        const doc = await Docs.upload(file, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))))
        setDocs((d) => [doc, ...(d || [])])
        setUploads((u) => u.filter((x) => x.id !== id))
        toast(`Uploaded ${file.name}. Processing has started.`)
      } catch (e) {
        setUploads((u) => u.filter((x) => x.id !== id))
        toast(`${file.name}: ${errorMessage(e)}`, 'error')
      }
    }
  }

  const runSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) { setResults(null); return }
    setSearching(true)
    try { setResults((await Docs.search(query.trim(), 10)).results) } catch (err) { toast(errorMessage(err), 'error') }
    setSearching(false)
  }

  const visible = useMemo(() => (docs || []).filter((d) => filter === 'all' || d.kind === filter || (filter === 'text' && d.kind === 'markdown')), [docs, filter])
  const counts = useMemo(() => {
    const c = { all: docs?.length || 0, pdf: 0, text: 0, note: 0 }
    for (const d of docs || []) { if (d.kind === 'markdown') c.text++; else c[d.kind] = (c[d.kind] || 0) + 1 }
    return c
  }, [docs])

  const openDoc = (id) => setParams(id ? { doc: String(id) } : {})

  return (
    <div className="animate-fade">
      <PageHeader
        title="Memories"
        description="Everything you've taught your memory. Upload files, write notes, and search by meaning."
        actions={
          <>
            <button className="btn-ghost" onClick={() => { setEditing(null); setNoteOpen(true) }}><PenLine size={15} />Write a note</button>
            <button className="btn-primary" onClick={() => fileRef.current?.click()}><Upload size={15} />Upload files</button>
          </>
        }
      />
      <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = '' }} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`relative overflow-hidden rounded-2xl border border-dashed px-6 py-8 text-center cursor-pointer transition-all ${
          dragging ? 'border-ice bg-electric/10 shadow-aura' : 'border-line hover:border-electric/50 bg-white/[.015]'
        }`}
      >
        {dragging && <div aria-hidden className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/30 blur-3xl" />}
        <div className="relative flex flex-col items-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-electric/30 bg-electric/10 text-ice"><Upload size={19} /></span>
          <p className="font-medium">{dragging ? 'Drop to add to memory' : 'Drag files here or click to browse'}</p>
          <p className="text-sm text-dim">PDF, TXT or Markdown, up to {maxMb} MB each</p>
        </div>
      </div>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.map((u) => (
            <li key={u.id} className="glass rounded-xl px-4 py-3">
              <div className="flex items-center justify-between text-sm"><span className="truncate">{u.name}</span><span className="tabular-nums text-dim">{u.progress}%</span></div>
              <div className="mt-2 h-1 rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-electric to-cyan transition-[width]" style={{ width: `${u.progress}%` }} /></div>
            </li>
          ))}
        </ul>
      )}

      {/* Search + filters */}
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form onSubmit={runSearch} className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            className="field pl-10 pr-24"
            placeholder="Search by meaning, e.g. “what did I note about exam strategy?”"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setResults(null) }}
            aria-label="Semantic search"
          />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            {results && <button type="button" className="icon-btn h-8" onClick={() => { setQuery(''); setResults(null) }} aria-label="Clear search"><X size={15} /></button>}
            <button type="submit" className="btn-primary h-8 px-3 text-xs" disabled={searching || !query.trim()}>{searching ? <Spinner size={13} /> : 'Search'}</button>
          </div>
        </form>
        <div className="flex gap-1 rounded-xl border border-line bg-white/[.02] p-1" role="tablist" aria-label="Filter by type">
          {[['all', 'All'], ['pdf', 'PDFs'], ['text', 'Files'], ['note', 'Notes']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`rounded-lg px-3 h-8 text-sm transition-colors ${filter === k ? 'bg-electric/20 text-frost' : 'text-mist hover:text-frost'}`}>
              {label} <span className="ml-1 text-xs text-dim tabular-nums">{counts[k] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Search results */}
      {results && (
        <section className="mt-6" aria-label="Search results">
          <h2 className="mb-3 text-sm text-mist">{results.length ? `${results.length} matching passages` : 'No matching passages. Try different wording.'}</h2>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={`${r.doc_id}-${r.chunk_index}-${i}`}>
                <button onClick={() => openDoc(r.doc_id)} className="w-full text-left glass rounded-xl p-4 hover:border-electric/40 transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-frost truncate">{r.title}</span>
                    {r.page && <span className="text-dim">p.{r.page}</span>}
                    <span className="ml-auto font-mono text-xs text-ice">{Math.round(r.score * 100)}% match</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mist">{r.text}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Library */}
      {!results && (
        <section className="mt-6">
          {docs === null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>
          ) : docs.length === 0 ? (
            <EmptyState icon={Library} title="Nothing here yet" action={<button className="btn-primary" onClick={() => fileRef.current?.click()}><Upload size={15} />Upload a document</button>}>
              Add a PDF of lecture slides, an article you saved, or a quick note. It becomes searchable in a few seconds.
            </EmptyState>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-mist">No {filter === 'note' ? 'notes' : 'documents'} of this type yet.</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((d) => <DocRow key={d.id} doc={d} onOpen={() => openDoc(d.id)} />)}
            </ul>
          )}
        </section>
      )}

      <NoteEditor
        open={noteOpen}
        note={editing}
        onClose={() => { setNoteOpen(false); setEditing(null) }}
        onSaved={(doc) => {
          setDocs((list) => [doc, ...(list || []).filter((x) => x.id !== doc.id)])
          toast(editing ? 'Note updated. Re-indexing now.' : 'Note saved. Indexing now.')
          if (editing) openDoc(null)
          setNoteOpen(false); setEditing(null)
        }}
      />

      {openId && (
        <DocumentDrawer
          id={openId}
          onClose={() => openDoc(null)}
          onChanged={load}
          onEdit={(note) => { setEditing(note); setNoteOpen(true) }}
        />
      )}
    </div>
  )
}

function DocRow({ doc, onOpen }) {
  const Icon = KIND_ICON[doc.kind] || FileText
  return (
    <li>
      <button onClick={onOpen} className="group w-full text-left glass rounded-xl px-4 py-4 hover:border-electric/40 transition-colors">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white/[.03] text-mist group-hover:text-ice group-hover:border-electric/40 transition-colors"><Icon size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusDot status={doc.status} />
              <h3 className="truncate font-medium text-frost">{doc.title}</h3>
            </div>
            {doc.status === 'processing' && <p className="mt-1 text-sm text-ice">Reading, chunking and embedding…</p>}
            {doc.status === 'failed' && <p className="mt-1 text-sm text-danger flex items-center gap-1.5"><AlertCircle size={14} />{doc.error || 'Processing failed'}</p>}
            {doc.status === 'ready' && doc.summary && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-mist">{doc.summary}</p>}
            {doc.topics?.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">{doc.topics.slice(0, 5).map((t) => <span key={t} className="chip">{t}</span>)}</div>
            )}
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 text-xs text-dim shrink-0">
            <span>{KIND_LABEL[doc.kind]}</span>
            {doc.status === 'ready' && <span className="tabular-nums">{doc.chunk_count} passages{doc.page_count ? ` · ${doc.page_count} pages` : ''}</span>}
            <span>{timeAgo(doc.created_at)}</span>
          </div>
        </div>
      </button>
    </li>
  )
}

function NoteEditor({ open, note, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) { setTitle(note?.title || ''); setContent(note?.content || ''); setError('') }
  }, [open, note])

  const save = async (e) => {
    e.preventDefault()
    if (!content.trim()) { setError('Write something before saving.'); return }
    setBusy(true)
    try {
      const doc = note ? await Docs.update(note.id, { title: title || 'Untitled note', content }) : await Docs.createNote(title || 'Untitled note', content)
      onSaved(doc)
    } catch (err) { setError(errorMessage(err)) }
    setBusy(false)
  }
  const words = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={note ? 'Edit note' : 'New note'} width="max-w-2xl">
      <form onSubmit={save} className="space-y-3">
        <input className="field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Note title" autoFocus />
        <textarea className="field min-h-[280px]" placeholder="Ideas, meeting notes, things you learned today…" value={content} onChange={(e) => setContent(e.target.value)} aria-label="Note content" />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-dim tabular-nums">{words} words</span>
          <div className="flex gap-2">
            <button type="button" className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || !content.trim()}>{busy && <Spinner size={14} />}{note ? 'Save changes' : 'Save note'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function DocumentDrawer({ id, onClose, onChanged, onEdit }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('summary')
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(false)

  const load = useCallback(async () => {
    try { const d = await Docs.get(id); setDoc(d); setTitle(d.title); setError('') } catch (e) { setError(errorMessage(e)) }
  }, [id])
  useEffect(() => { setDoc(null); setTab('summary'); load() }, [load])
  useEffect(() => {
    if (doc?.status !== 'processing') return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [doc?.status, load])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !confirm && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, confirm])

  const rename = async () => {
    if (!title.trim() || title === doc.title) { setRenaming(false); return }
    setBusy('rename')
    try { const d = await Docs.update(id, { title: title.trim() }); setDoc((o) => ({ ...o, ...d })); onChanged(); toast('Renamed') } catch (e) { toast(errorMessage(e), 'error') }
    setBusy(''); setRenaming(false)
  }
  const summarize = async () => {
    setBusy('summary')
    try { const d = await Docs.summarize(id); setDoc((o) => ({ ...o, ...d })); onChanged(); toast('Summary regenerated') } catch (e) { toast(errorMessage(e), 'error') }
    setBusy('')
  }
  const remove = async () => {
    setBusy('delete')
    try { await Docs.remove(id); toast('Deleted from memory'); onChanged(); onClose() } catch (e) { toast(errorMessage(e), 'error'); setBusy('') }
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Document details" className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col glass-strong border-l border-line animate-rise">
        <div className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form onSubmit={(e) => { e.preventDefault(); rename() }} className="flex gap-2">
                <input className="field h-9" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200} aria-label="Document title" />
                <button className="btn-primary h-9 px-3" disabled={busy === 'rename'}>{busy === 'rename' ? <Spinner size={14} /> : <Check size={15} />}</button>
              </form>
            ) : (
              <h2 className="text-lg font-semibold leading-snug break-words">{doc?.title || 'Loading…'}</h2>
            )}
            {doc && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-dim">
                <StatusDot status={doc.status} /> {KIND_LABEL[doc.kind]} · {bytes(doc.size_bytes)}
                {doc.status === 'ready' && <> · {doc.word_count.toLocaleString()} words · {doc.chunk_count} passages{doc.page_count ? ` · ${doc.page_count} pages` : ''}</>}
              </p>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {error && <p className="m-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
        {!doc && !error && <div className="p-5 space-y-3"><div className="skeleton h-6 w-2/3" /><div className="skeleton h-24" /><div className="skeleton h-40" /></div>}

        {doc && (
          <>
            <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
              <button className="btn-primary h-9" disabled={doc.status !== 'ready'} onClick={() => navigate(`/app/chat?doc=${doc.id}`)}><MessageSquareText size={15} />Ask about this</button>
              {doc.kind === 'note' && <button className="btn-ghost h-9" disabled={doc.status === 'processing'} onClick={() => onEdit({ id: doc.id, title: doc.title, content: doc.content })}><PenLine size={15} />Edit</button>}
              <button className="btn-ghost h-9" onClick={() => setRenaming(true)} disabled={doc.status === 'processing'}>Rename</button>
              <button className="btn-danger h-9 ml-auto" onClick={() => setConfirm(true)}><Trash2 size={15} />Delete</button>
            </div>

            {doc.status === 'processing' && (
              <div className="m-5 flex items-center gap-3 rounded-xl border border-ice/20 bg-ice/5 px-4 py-3 text-sm text-ice"><Spinner size={15} />Processing. This view updates automatically.</div>
            )}
            {doc.status === 'failed' && (
              <div className="m-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <p className="font-medium">Processing failed</p><p className="mt-1">{doc.error}</p>
                <p className="mt-2 text-danger/80">Delete this item and upload the file again, or try a different export of it.</p>
              </div>
            )}

            {doc.status === 'ready' && (
              <>
                <div className="flex gap-1 px-5 pt-4" role="tablist">
                  {[['summary', 'Summary'], ['content', 'Content'], ['chunks', `Passages (${doc.chunks?.length || 0})`]].map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                      className={`rounded-lg px-3 h-8 text-sm ${tab === k ? 'bg-electric/20 text-frost' : 'text-mist hover:text-frost'}`}>{l}</button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {tab === 'summary' && (
                    <div className="space-y-5">
                      <div className="relative overflow-hidden rounded-2xl border border-electric/25 bg-electric/[.07] p-5">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-medium text-ice"><Sparkles size={15} />Summary</h3>
                          <button className="btn-quiet h-8 text-xs" onClick={summarize} disabled={busy === 'summary'}>
                            {busy === 'summary' ? <Spinner size={13} /> : <RefreshCw size={13} />}Regenerate
                          </button>
                        </div>
                        <p className="mt-3 text-[15px] leading-7 text-frost/90">{doc.summary || 'No summary yet. Click Regenerate to create one.'}</p>
                      </div>
                      {doc.topics?.length > 0 && (
                        <div>
                          <h3 className="text-sm text-mist">Topics</h3>
                          <div className="mt-2 flex flex-wrap gap-1.5">{doc.topics.map((t) => <span key={t} className="chip">{t}</span>)}</div>
                        </div>
                      )}
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-line p-3"><dt className="text-dim">Added</dt><dd className="mt-0.5">{new Date(doc.created_at).toLocaleString()}</dd></div>
                        <div className="rounded-xl border border-line p-3"><dt className="text-dim">File</dt><dd className="mt-0.5 truncate">{doc.filename || 'Written in app'}</dd></div>
                      </dl>
                    </div>
                  )}
                  {tab === 'content' && (
                    <div>
                      <pre className="whitespace-pre-wrap break-words font-sans text-[14px] leading-7 text-frost/85">{doc.content}</pre>
                      {doc.content_truncated && <p className="mt-4 text-xs text-dim">Showing the first 20,000 characters.</p>}
                    </div>
                  )}
                  {tab === 'chunks' && (
                    <ol className="space-y-3">
                      {doc.chunks.map((c) => (
                        <li key={c.chunk_index} className="rounded-xl border border-line bg-white/[.02] p-4">
                          <p className="mb-2 font-mono text-xs text-dim">Passage {c.chunk_index + 1}{c.page ? ` · page ${c.page}` : ''}</p>
                          <p className="text-sm leading-relaxed text-mist">{c.text}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </aside>
      <ConfirmDialog
        open={confirm}
        title="Delete from memory?"
        message={`“${doc?.title}” and all of its passages will be removed. Chat answers will no longer use it. This can't be undone.`}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
        busy={busy === 'delete'}
      />
    </div>
  )
}
