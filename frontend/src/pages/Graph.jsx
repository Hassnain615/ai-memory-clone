import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as d3 from 'd3'
import { Network, RefreshCw, Search, X, Maximize2, MessageSquareText } from 'lucide-react'
import { EmptyState, Spinner } from '../components/ui'
import { System, errorMessage } from '../lib/api'

const KIND_COLOR = { pdf: '#2F6BFF', note: '#22D3EE', text: '#8FA8FF', markdown: '#8FA8FF' }

export default function Graph() {
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const zoomRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [showConcepts, setShowConcepts] = useState(true)
  const [showSimilar, setShowSimilar] = useState(true)
  const [query, setQuery] = useState('')

  const load = () => {
    setLoading(true)
    System.graph().then((g) => { setData(g); setError('') }).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const view = useMemo(() => {
    if (!data) return null
    const nodes = data.nodes.filter((n) => showConcepts || n.type === 'document')
    const ids = new Set(nodes.map((n) => n.id))
    const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && (showSimilar || e.kind !== 'similar'))
    return { nodes, edges }
  }, [data, showConcepts, showSimilar])

  // Neighbour lookup for the detail panel
  const neighbours = useMemo(() => {
    const map = new Map()
    for (const e of data?.edges || []) {
      if (!map.has(e.source)) map.set(e.source, [])
      if (!map.has(e.target)) map.set(e.target, [])
      map.get(e.source).push({ id: e.target, edge: e })
      map.get(e.target).push({ id: e.source, edge: e })
    }
    return map
  }, [data])
  const byId = useMemo(() => new Map((data?.nodes || []).map((n) => [n.id, n])), [data])

  useEffect(() => {
    if (!view || !svgRef.current || view.nodes.length === 0) return
    const el = svgRef.current
    const { width: W, height: H } = wrapRef.current.getBoundingClientRect()
    const svg = d3.select(el).attr('viewBox', `0 0 ${W} ${H}`)
    svg.selectAll('*').remove()

    const defs = svg.append('defs')
    const glow = defs.append('filter').attr('id', 'node-glow').attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%')
    glow.append('feGaussianBlur').attr('stdDeviation', 5).attr('result', 'b')
    const merge = glow.append('feMerge'); merge.append('feMergeNode').attr('in', 'b'); merge.append('feMergeNode').attr('in', 'SourceGraphic')

    const root = svg.append('g')
    const nodes = view.nodes.map((n) => ({ ...n }))
    const links = view.edges.map((e) => ({ ...e }))
    const adjacency = new Set(links.map((l) => `${l.source}|${l.target}`))
    const linked = (a, b) => a === b || adjacency.has(`${a}|${b}`) || adjacency.has(`${b}|${a}`)

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance((l) => (l.kind === 'similar' ? 160 : 70)).strength((l) => (l.kind === 'similar' ? 0.25 : 0.5)))
      .force('charge', d3.forceManyBody().strength((d) => (d.type === 'document' ? -520 : -110)))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collide', d3.forceCollide().radius((d) => d.size + 12))
      .force('x', d3.forceX(W / 2).strength(0.03))
      .force('y', d3.forceY(H / 2).strength(0.03))

    const link = root.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', (d) => (d.kind === 'similar' ? 'rgba(125,231,255,.55)' : 'rgba(91,140,255,.16)'))
      .attr('stroke-width', (d) => (d.kind === 'similar' ? 1 + d.weight * 2 : 1))
      .attr('stroke-dasharray', (d) => (d.kind === 'similar' ? '4 4' : null))

    const node = root.append('g').selectAll('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.type === 'document' ? 'Document' : 'Concept'}: ${d.label}`)
      .on('click', (_, d) => setSelected(d.id))
      .on('keydown', (e, d) => { if (e.key === 'Enter') setSelected(d.id) })
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    node.filter((d) => d.type === 'document').append('circle')
      .attr('r', (d) => d.size + 8).attr('fill', (d) => KIND_COLOR[d.kind] || '#2F6BFF').attr('opacity', 0.14)
    node.append('circle')
      .attr('r', (d) => d.size)
      .attr('fill', (d) => (d.type === 'document' ? '#03050B' : 'rgba(34,211,238,.12)'))
      .attr('stroke', (d) => (d.type === 'document' ? KIND_COLOR[d.kind] || '#2F6BFF' : '#22D3EE'))
      .attr('stroke-width', (d) => (d.type === 'document' ? 2 : 1))
      .attr('filter', (d) => (d.type === 'document' ? 'url(#node-glow)' : null))
    node.filter((d) => d.type === 'document').append('circle').attr('r', 3.5).attr('fill', '#fff')
    node.append('text')
      .text((d) => (d.label.length > 22 ? `${d.label.slice(0, 20)}…` : d.label))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.size + 15)
      .attr('fill', (d) => (d.type === 'document' ? '#E6EDF7' : '#7DE7FF'))
      .attr('font-size', (d) => (d.type === 'document' ? 12 : 10.5))
      .attr('font-weight', (d) => (d.type === 'document' ? 500 : 400))
      .attr('font-family', 'Geist, sans-serif')
      .attr('paint-order', 'stroke').attr('stroke', '#000').attr('stroke-width', 3)

    node.on('mouseenter', (_, d) => {
      node.attr('opacity', (o) => (linked(d.id, o.id) ? 1 : 0.18))
      link.attr('opacity', (l) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.06))
    }).on('mouseleave', () => { node.attr('opacity', 1); link.attr('opacity', 1) })

    sim.on('tick', () => {
      link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    const zoom = d3.zoom().scaleExtent([0.25, 4]).on('zoom', (e) => root.attr('transform', e.transform))
    svg.call(zoom).on('dblclick.zoom', null)
    zoomRef.current = () => svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity)

    // Expose highlight for search
    el.__highlight = (q) => {
      const term = q.trim().toLowerCase()
      node.attr('opacity', (d) => (!term || d.label.toLowerCase().includes(term) ? 1 : 0.15))
    }
    return () => sim.stop()
  }, [view])

  useEffect(() => { svgRef.current?.__highlight?.(query) }, [query, view])

  const sel = selected ? byId.get(selected) : null
  const selNeighbours = sel ? (neighbours.get(sel.id) || []).map((n) => ({ ...byId.get(n.id), edge: n.edge })).filter((n) => n.id) : []

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] lg:h-screen flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <div className="mr-auto">
          <h1 className="font-semibold tracking-tight">Knowledge graph</h1>
          <p className="text-xs text-dim">
            {data?.stats ? `${data.stats.documents} documents, ${data.stats.concepts} concepts, ${data.stats.semantic_links || 0} semantic links` : 'How your documents connect'}
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input className="field h-9 w-48 pl-8 text-sm" placeholder="Find a node" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a node" />
        </div>
        <Toggle on={showConcepts} onClick={() => setShowConcepts((v) => !v)}>Concepts</Toggle>
        <Toggle on={showSimilar} onClick={() => setShowSimilar((v) => !v)}>Similarity links</Toggle>
        <button className="icon-btn" onClick={() => zoomRef.current?.()} aria-label="Reset view" title="Reset view"><Maximize2 size={15} /></button>
        <button className="btn-ghost h-9" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
      </div>

      <div ref={wrapRef} className="relative flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,#07112B_0%,#000_70%)]">
        {loading && !data && <div className="absolute inset-0 grid place-items-center"><div className="flex items-center gap-3 text-mist"><Spinner className="text-ice" />Mapping your memory…</div></div>}
        {error && <p className="absolute left-1/2 top-8 -translate-x-1/2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
        {data && data.nodes.length === 0 && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-md w-full">
              <EmptyState icon={Network} title="No connections yet" action={<Link to="/app/memories" className="btn-primary">Add memories</Link>}>
                The graph appears once you have processed documents. Two or more documents reveal how ideas connect.
              </EmptyState>
            </div>
          </div>
        )}
        <svg ref={svgRef} className="h-full w-full" />

        {data?.nodes.length > 0 && (
          <div className="absolute bottom-4 left-4 glass-strong rounded-xl px-4 py-3 text-xs text-mist space-y-1.5">
            <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-electric" />PDF</p>
            <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-cyan" />Note</p>
            <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan/30 border border-cyan" />Concept</p>
            <p className="flex items-center gap-2"><span className="w-4 border-t border-dashed border-ice" />Similar content</p>
            <p className="pt-1 text-dim">Scroll to zoom, drag to move</p>
          </div>
        )}

        {sel && (
          <aside className="absolute right-4 top-4 bottom-4 w-[min(340px,calc(100%-2rem))] overflow-y-auto glass-strong rounded-2xl p-5 animate-rise">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-dim">{sel.type === 'document' ? 'Document' : `Concept in ${sel.documents} document${sel.documents === 1 ? '' : 's'}`}</p>
                <h2 className="mt-1 text-lg font-semibold leading-snug break-words">{sel.label}</h2>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Close"><X size={16} /></button>
            </div>
            {sel.type === 'document' ? (
              <>
                {sel.summary && <p className="mt-3 text-sm leading-relaxed text-mist">{sel.summary}</p>}
                <div className="mt-4 flex gap-2">
                  <Link to={`/app/memories?doc=${sel.doc_id}`} className="btn-ghost h-9 flex-1">Open</Link>
                  <Link to={`/app/chat?doc=${sel.doc_id}`} className="btn-primary h-9 flex-1"><MessageSquareText size={14} />Ask</Link>
                </div>
                <NeighbourList title="Similar documents" items={selNeighbours.filter((n) => n.type === 'document')} onPick={setSelected} showScore />
                <NeighbourList title="Key concepts" items={selNeighbours.filter((n) => n.type === 'concept')} onPick={setSelected} chips />
              </>
            ) : (
              <>
                <Link to={`/app/chat?q=${encodeURIComponent(`What do my notes say about ${sel.label}?`)}`} className="btn-primary mt-4 h-9 w-full"><MessageSquareText size={14} />Ask about “{sel.label}”</Link>
                <NeighbourList title="Mentioned in" items={selNeighbours} onPick={setSelected} />
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function Toggle({ on, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`h-9 rounded-xl border px-3 text-sm transition-colors ${on ? 'border-electric/50 bg-electric/15 text-frost' : 'border-line text-dim hover:text-mist'}`}>
      {children}
    </button>
  )
}

function NeighbourList({ title, items, onPick, chips, showScore }) {
  if (!items.length) return null
  return (
    <div className="mt-5">
      <h3 className="text-sm text-mist">{title}</h3>
      {chips ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((n) => <button key={n.id} onClick={() => onPick(n.id)} className="chip hover:border-cyan/50 hover:text-ice">{n.label}</button>)}
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => onPick(n.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/[.05]">
                <span className="truncate">{n.label}</span>
                {showScore && n.edge?.kind === 'similar' && <span className="font-mono text-xs text-ice">{Math.round(n.edge.weight * 100)}%</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
