import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { GitBranch, Loader2, RefreshCw } from 'lucide-react'
import { getGraph } from '../api'

export default function GraphView() {
  const svgRef = useRef()
  const [loading, setLoading] = useState(false)
  const [graphData, setGraphData] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  const fetchGraph = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getGraph()
      setGraphData(res.data)
    } catch {
      setError('Failed to load graph')
    }
    setLoading(false)
  }

  useEffect(() => { fetchGraph() }, [])

  useEffect(() => {
    if (!graphData || !svgRef.current) return
    if (graphData.nodes.length === 0) return

    const el = svgRef.current
    const W = el.clientWidth || 800
    const H = el.clientHeight || 500

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('width', W)
      .attr('height', H)

    // Defs: glow filter
    const defs = svg.append('defs')
    const glowFilter = defs.append('filter').attr('id', 'glow')
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const feMerge = glowFilter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const nodes = graphData.nodes.map(n => ({ ...n }))
    const links = graphData.edges.map(e => ({ ...e }))

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(d => d.size + 10))

    // Links
    const link = svg.append('g').selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#1e1e2e')
      .attr('stroke-width', d => Math.min(d.weight, 3))
      .attr('stroke-opacity', 0.6)

    // Node groups
    const node = svg.append('g').selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )
      .on('click', (event, d) => setSelected(d))

    // Circles
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => d.type === 'source' ? '#7c6aff22' : '#00e5ff11')
      .attr('stroke', d => d.type === 'source' ? '#7c6aff' : '#00e5ff')
      .attr('stroke-width', d => d.type === 'source' ? 2 : 1)
      .attr('filter', d => d.type === 'source' ? 'url(#glow)' : 'none')

    // Labels
    node.append('text')
      .text(d => d.label.length > 14 ? d.label.slice(0, 12) + '…' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.size + 14)
      .attr('fill', d => d.type === 'source' ? '#c8c8e8' : '#6868a8')
      .attr('font-size', d => d.type === 'source' ? 11 : 9)
      .attr('font-family', 'JetBrains Mono, monospace')

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Zoom
    svg.call(d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', e => {
        svg.selectAll('g').attr('transform', e.transform)
      })
    )
  }, [graphData])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-display font-700 text-text tracking-wide">Knowledge Graph</h2>
          <p className="text-text-dim text-xs font-mono mt-0.5">
            {graphData ? `${graphData.nodes.length} nodes · ${graphData.edges.length} connections` : 'Visualize your memory structure'}
          </p>
        </div>
        <button
          onClick={fetchGraph}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-text-dim text-xs font-mono hover:border-accent/40 hover:text-accent transition-all disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex-1 relative graph-canvas overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-void/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-accent animate-spin" />
              <p className="text-text-dim text-sm font-mono">Building knowledge graph...</p>
            </div>
          </div>
        )}

        {!loading && graphData?.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <GitBranch size={40} className="text-border mx-auto mb-4" />
              <p className="text-text-dim font-display font-600">No graph data yet</p>
              <p className="text-text-dim/60 text-sm font-mono mt-1">Upload memories to generate the graph</p>
            </div>
          </div>
        )}

        <svg ref={svgRef} className="w-full h-full" />

        {/* Legend */}
        {graphData?.nodes.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-panel/80 border border-border rounded-xl p-3 backdrop-blur-sm">
            <p className="text-text-dim text-[10px] font-mono uppercase tracking-widest mb-2">Legend</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-accent" />
                <span className="text-text-dim text-[11px] font-mono">Source document</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full border border-cyan" />
                <span className="text-text-dim text-[11px] font-mono">Keyword concept</span>
              </div>
            </div>
            <p className="text-text-dim/50 text-[10px] font-mono mt-2">Scroll to zoom · Drag to pan</p>
          </div>
        )}

        {/* Selected node info */}
        {selected && (
          <div className="absolute top-4 right-4 bg-panel border border-border rounded-xl p-3 max-w-[200px] animate-fade-in">
            <p className="text-text text-xs font-display font-600 mb-1">{selected.label}</p>
            <p className="text-text-dim text-[10px] font-mono capitalize">{selected.type}</p>
            {selected.size && (
              <p className="text-accent text-[10px] font-mono mt-1">Weight: {selected.size}</p>
            )}
            <button onClick={() => setSelected(null)} className="text-text-dim/40 text-[10px] font-mono mt-2 hover:text-text-dim">✕ close</button>
          </div>
        )}
      </div>
    </div>
  )
}
