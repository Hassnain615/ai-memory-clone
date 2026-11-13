import { Fragment } from 'react'

/**
 * Small, safe Markdown renderer for chat answers (no HTML injection — everything is React text).
 * Supports headings, lists, code blocks, bold/italic/inline code, links and [n] citations.
 */
function inline(text, onCite, keyBase = 'i') {
  const out = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[(\d{1,2})\](?!\())|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g
  let last = 0
  let m
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-${k++}`
    if (m[1]) out.push(<code key={key}>{m[1].slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={key}>{inline(m[2].slice(2, -2), onCite, key)}</strong>)
    else if (m[3]) out.push(<em key={key}>{m[3].slice(1, -1)}</em>)
    else if (m[4]) {
      const n = Number(m[5])
      out.push(
        <button
          key={key}
          type="button"
          onClick={() => onCite?.(n)}
          className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-electric/40 bg-electric/15 px-1 align-[1px] font-mono text-[10.5px] text-ice hover:bg-electric/30 hover:border-electric/70 transition-colors"
          aria-label={`Show source ${n}`}
        >
          {n}
        </button>,
      )
    } else if (m[6]) {
      out.push(<a key={key} href={m[8]} target="_blank" rel="noopener noreferrer">{m[7]}</a>)
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function Markdown({ text = '', onCite, streaming = false }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++])
      i++
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }
    const h = line.match(/^(#{1,3})\s+(.*)/)
    if (h) { blocks.push({ type: `h${h[1].length}`, text: h[2] }); i++; continue }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''))
      blocks.push({ type: 'ul', items }); continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))
      blocks.push({ type: 'ol', items }); continue
    }
    if (!line.trim()) { i++; continue }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*•]\s|\s*\d+[.)]\s|```)/.test(lines[i])) para.push(lines[i++])
    blocks.push({ type: 'p', text: para.join(' ') })
  }

  return (
    <div className={`prose-memory ${streaming ? 'caret' : ''}`}>
      {blocks.map((b, idx) => {
        const key = `b${idx}`
        switch (b.type) {
          case 'code': return <pre key={key}><code>{b.text}</code></pre>
          case 'h1': return <h1 key={key}>{inline(b.text, onCite, key)}</h1>
          case 'h2': return <h2 key={key}>{inline(b.text, onCite, key)}</h2>
          case 'h3': return <h3 key={key}>{inline(b.text, onCite, key)}</h3>
          case 'ul': return <ul key={key}>{b.items.map((it, j) => <li key={j}>{inline(it, onCite, `${key}-${j}`)}</li>)}</ul>
          case 'ol': return <ol key={key}>{b.items.map((it, j) => <li key={j}>{inline(it, onCite, `${key}-${j}`)}</li>)}</ol>
          default: return <p key={key}>{inline(b.text, onCite, key)}</p>
        }
      })}
      {!blocks.length && <Fragment>&nbsp;</Fragment>}
    </div>
  )
}
