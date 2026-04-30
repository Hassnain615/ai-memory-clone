import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, File, Brain, Trash2, ChevronRight, Loader2, Plus } from 'lucide-react'
import { uploadText, uploadPDF, clearMemories } from '../api'

export default function Sidebar({ memories, onMemoriesUpdate, onClearAll }) {
  const [tab, setTab] = useState('upload') // upload | memories
  const [uploading, setUploading] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const fileRef = useRef()

  const showFeedback = (msg, type = 'success') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleTextUpload = async () => {
    if (!noteText.trim()) return
    setUploading(true)
    try {
      const res = await uploadText(noteText, noteTitle || 'Untitled Note')
      showFeedback(`✓ Stored ${res.data.chunks} memory chunks`)
      setNoteText('')
      setNoteTitle('')
      onMemoriesUpdate()
    } catch {
      showFeedback('Upload failed', 'error')
    }
    setUploading(false)
  }

  const handlePDFUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadPDF(file)
      showFeedback(`✓ ${res.data.message}`)
      onMemoriesUpdate()
    } catch {
      showFeedback('PDF upload failed', 'error')
    }
    setUploading(false)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') handlePDFUpload(file)
  }, [])

  const handleClear = async () => {
    if (!confirm('Clear all memories? This cannot be undone.')) return
    await clearMemories()
    onClearAll()
    showFeedback('All memories cleared')
  }

  return (
    <aside className="w-72 flex flex-col bg-panel border-r border-border h-full">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent-glow border border-accent/30 flex items-center justify-center animate-glow">
            <Brain size={16} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display font-800 text-sm text-text tracking-wide">MEMORYCLONE</h1>
            <p className="text-[10px] text-text-dim font-mono">second brain v1.0</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          <div className="flex-1 bg-surface rounded-lg p-2 border border-border text-center">
            <div className="text-accent font-display font-700 text-lg">{memories.total_chunks || 0}</div>
            <div className="text-text-dim text-[10px] font-mono">chunks</div>
          </div>
          <div className="flex-1 bg-surface rounded-lg p-2 border border-border text-center">
            <div className="text-cyan font-display font-700 text-lg">{memories.sources?.length || 0}</div>
            <div className="text-text-dim text-[10px] font-mono">sources</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {['upload', 'memories'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-widest transition-all ${
              tab === t
                ? 'text-accent border-b-2 border-accent bg-accent-glow/20'
                : 'text-text-dim hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'upload' && (
          <div className="space-y-4 animate-fade-in">
            {/* PDF Drop Zone */}
            <div
              className={`upload-zone rounded-xl border-2 border-dashed border-border p-5 text-center cursor-pointer transition-all hover:border-accent/50 ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => handlePDFUpload(e.target.files[0])} />
              <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center mx-auto mb-3">
                {uploading ? <Loader2 size={18} className="text-accent animate-spin" /> : <File size={18} className="text-accent" />}
              </div>
              <p className="text-text text-sm font-display font-600">Drop PDF here</p>
              <p className="text-text-dim text-xs font-mono mt-1">or click to browse</p>
            </div>

            {/* Text Note */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono text-text-dim uppercase tracking-widest">Quick Note</label>
              <input
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-dim/50 font-mono focus:outline-none focus:border-accent/50 transition-colors"
              />
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Paste your notes, ideas, research..."
                rows={6}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-dim/50 font-mono focus:outline-none focus:border-accent/50 transition-colors resize-none"
              />
              <button
                onClick={handleTextUpload}
                disabled={uploading || !noteText.trim()}
                className="w-full py-2.5 rounded-lg bg-accent/20 border border-accent/40 text-accent text-sm font-display font-600 hover:bg-accent/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Store in Memory
              </button>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`rounded-lg px-3 py-2 text-xs font-mono animate-fade-in ${
                feedback.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-emerald/10 border border-emerald/30 text-emerald'
              }`}>
                {feedback.msg}
              </div>
            )}
          </div>
        )}

        {tab === 'memories' && (
          <div className="animate-fade-in space-y-2">
            {memories.sources?.length === 0 && (
              <div className="text-center py-8">
                <Brain size={32} className="text-border mx-auto mb-3" />
                <p className="text-text-dim text-sm font-mono">No memories yet</p>
                <p className="text-text-dim/60 text-xs font-mono mt-1">Upload notes or PDFs</p>
              </div>
            )}
            {memories.sources?.map((src, i) => (
              <div key={i} className="insight-card rounded-xl p-3 bg-surface">
                <div className="flex items-start gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${src.type === 'pdf' ? 'bg-cyan-dim' : 'bg-accent-glow'}`}>
                    {src.type === 'pdf'
                      ? <File size={13} className="text-cyan" />
                      : <FileText size={13} className="text-accent" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-xs font-display font-600 truncate">{src.title}</p>
                    <p className="text-text-dim text-[10px] font-mono mt-0.5">{src.chunks} chunks stored</p>
                  </div>
                  <ChevronRight size={12} className="text-border mt-1 flex-shrink-0" />
                </div>
              </div>
            ))}
            {memories.sources?.length > 0 && (
              <button
                onClick={handleClear}
                className="w-full mt-3 py-2 rounded-lg border border-red-500/20 text-red-400/60 text-xs font-mono hover:border-red-500/40 hover:text-red-400 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={12} /> Clear All Memory
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
