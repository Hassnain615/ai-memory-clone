import { useEffect, useRef } from 'react'
import { Loader2, X } from 'lucide-react'

export function Logo({ size = 28, withText = true }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
        <span className="absolute inset-0 rounded-[30%] bg-electric/40 blur-md" />
        <svg viewBox="0 0 32 32" className="relative" width={size} height={size}>
          <defs>
            <radialGradient id="lg" cx="50%" cy="45%" r="60%">
              <stop offset="0" stopColor="#7DE7FF" />
              <stop offset=".6" stopColor="#2F6BFF" />
              <stop offset="1" stopColor="#1A3FB8" />
            </radialGradient>
          </defs>
          <rect width="32" height="32" rx="10" fill="#03050B" stroke="rgba(125,231,255,.35)" />
          <circle cx="16" cy="16" r="9" fill="url(#lg)" />
          <circle cx="16" cy="16" r="3.2" fill="#fff" />
          <circle cx="24.5" cy="8.5" r="1.6" fill="#7DE7FF" />
          <circle cx="7.5" cy="23" r="1.2" fill="#5B8CFF" />
        </svg>
      </span>
      {withText && <span className="font-semibold tracking-tight text-frost text-[15px]">Memory Clone</span>}
    </span>
  )
}

export function Spinner({ size = 16, className = '' }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} aria-label="Loading" />
}

export function FullScreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-void">
      <div className="relative">
        <div className="absolute -inset-10 rounded-full bg-electric/25 blur-3xl animate-breathe" />
        <Logo size={44} withText={false} />
      </div>
    </div>
  )
}

/** Soft electric aura used behind hero areas and empty states. */
export function Aura({ className = '' }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(47,107,255,.55),rgba(47,107,255,0)_65%)] blur-2xl animate-breathe" />
      <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,.45),rgba(34,211,238,0)_70%)] blur-2xl" />
    </div>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-frost">{title}</h1>
        {description && <p className="mt-1.5 text-mist text-[15px] max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="relative overflow-hidden glass rounded-2xl px-6 py-14 text-center">
      <Aura className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-72 h-72 opacity-50" />
      <div className="relative">
        {Icon && (
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-electric/30 bg-electric/10 text-ice">
            <Icon size={22} />
          </div>
        )}
        <h3 className="text-lg font-semibold text-frost">{title}</h3>
        {children && <p className="mx-auto mt-2 max-w-md text-[15px] text-mist leading-relaxed">{children}</p>}
        {action && <div className="mt-6 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} glass-strong rounded-2xl shadow-glass animate-rise outline-none`}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-semibold text-frost">{title}</h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose, busy, children }) {
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title} width="max-w-md">
      <p className="text-sm text-mist leading-relaxed">{message}</p>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner size={14} />} {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function StatusDot({ status }) {
  const map = {
    ready: 'bg-success shadow-[0_0_10px_rgba(52,229,164,.8)]',
    processing: 'bg-ice shadow-[0_0_10px_rgba(125,231,255,.9)] animate-pulse',
    failed: 'bg-danger shadow-[0_0_10px_rgba(255,92,122,.8)]',
  }
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${map[status] || 'bg-dim'}`} />
}
