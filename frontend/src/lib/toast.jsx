import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(() => {})
let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback((message, type = 'success') => {
    const id = nextId++
    setToasts((t) => [...t.slice(-3), { id, message, type }])
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500)
  }, [dismiss])

  const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
  const tones = { success: 'text-success', error: 'text-danger', info: 'text-ice' }
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info
          return (
            <div key={t.id} className="glass-strong rounded-xl px-4 py-3 flex items-start gap-3 animate-rise shadow-glass">
              <Icon size={18} className={`${tones[t.type]} mt-0.5 shrink-0`} />
              <p className="text-sm text-frost flex-1 leading-relaxed">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-dim hover:text-frost" aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
