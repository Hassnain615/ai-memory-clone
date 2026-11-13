import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Library, MessageSquareText, Network, Sparkles, Settings, LogOut, Menu, X } from 'lucide-react'
import { Logo } from './ui'
import { useAuth } from '../lib/auth.jsx'
import { System } from '../lib/api'

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/memories', label: 'Memories', icon: Library },
  { to: '/app/chat', label: 'Chat', icon: MessageSquareText },
  { to: '/app/graph', label: 'Knowledge graph', icon: Network },
  { to: '/app/insights', label: 'Insights', icon: Sparkles },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [health, setHealth] = useState(null)

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    System.health().then(setHealth).catch(() => setHealth({ status: 'down' }))
  }, [])

  const doLogout = () => { logout(); navigate('/login') }
  const initials = (user?.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const fullBleed = location.pathname.startsWith('/app/chat') || location.pathname.startsWith('/app/graph')

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 h-16">
        <NavLink to="/app" aria-label="Overview"><Logo /></NavLink>
        <button className="icon-btn lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
      </div>
      <nav className="mt-2 flex-1 space-y-0.5 px-3" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 h-10 text-sm transition-colors ${
                isActive ? 'bg-electric/[.12] text-frost' : 'text-mist hover:text-frost hover:bg-white/[.04]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-ice to-electric shadow-[0_0_12px_#2F6BFF]" />}
                <Icon size={17} className={isActive ? 'text-ice' : 'text-dim group-hover:text-mist'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-3 space-y-2">
        {health && (
          <div className="rounded-xl border border-line bg-white/[.02] px-3 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-mist">
              <span className={`h-1.5 w-1.5 rounded-full ${health.status === 'ok' ? (health.llm?.available ? 'bg-success' : 'bg-warn') : 'bg-danger'}`} />
              {health.status !== 'ok' ? 'Backend unreachable' : health.llm?.available ? `AI: ${health.llm.model}` : 'AI model not configured'}
            </div>
            {health.status === 'ok' && !health.llm?.available && (
              <p className="mt-1 text-dim leading-snug">Chat shows matching passages only. Add a Gemini key in backend/.env for full answers.</p>
            )}
          </div>
        )}
        <NavLink
          to="/app/settings"
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 h-10 text-sm ${isActive ? 'bg-electric/[.12] text-frost' : 'text-mist hover:text-frost hover:bg-white/[.04]'}`}
        >
          <Settings size={17} className="text-dim" /> Settings
        </NavLink>
        <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-electric to-cyan text-xs font-semibold text-white">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-frost">{user?.name}</p>
            <p className="truncate text-xs text-dim">{user?.email}</p>
          </div>
          <button onClick={doLogout} className="icon-btn" aria-label="Log out" title="Log out"><LogOut size={16} /></button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen bg-void">
      <div aria-hidden className="pointer-events-none fixed inset-0 grid-faint" />
      <div aria-hidden className="pointer-events-none fixed -top-40 left-1/3 h-[420px] w-[720px] rounded-full bg-electric/[.13] blur-[120px]" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-abyss/80 backdrop-blur-xl lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 animate-fade" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 border-r border-line bg-abyss animate-rise">{sidebar}</aside>
        </div>
      )}

      <div className="relative lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-void/70 px-4 backdrop-blur-xl lg:hidden">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <Logo size={24} />
        </header>
        <main className={fullBleed ? '' : 'mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10'}>
          <Outlet context={{ health }} />
        </main>
      </div>
    </div>
  )
}
