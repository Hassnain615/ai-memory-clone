import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Logo, Spinner } from '../components/ui'
import Constellation from '../components/Constellation'
import { useAuth } from '../lib/auth.jsx'
import { errorMessage } from '../lib/api'

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const pwChecks = [
    { ok: form.password.length >= 8, label: '8+ characters' },
    { ok: /[A-Za-z]/.test(form.password), label: 'a letter' },
    { ok: /\d/.test(form.password), label: 'a number' },
  ]

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (isSignup && pwChecks.some((c) => !c.ok)) {
      setError('Password needs at least 8 characters, including a letter and a number.')
      return
    }
    setBusy(true)
    try {
      if (isSignup) await signup(form.name.trim(), form.email.trim(), form.password)
      else await login(form.email.trim(), form.password)
      navigate(location.state?.from?.startsWith('/app') ? location.state.from : '/app', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-void">
      {/* Visual side */}
      <div className="relative hidden lg:block overflow-hidden border-r border-line">
        <Constellation className="absolute inset-0 h-full w-full" density={45} />
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(47,107,255,.4),transparent_62%)] blur-2xl animate-breathe" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/" aria-label="Home"><Logo /></Link>
          <div className="max-w-md">
            <p className="text-3xl font-semibold leading-tight tracking-tight">
              {isSignup ? 'Give your notes a memory.' : 'Pick up where your thinking left off.'}
            </p>
            <p className="mt-3 text-mist">Your documents stay in your account. Answers always point back to their sources.</p>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex items-center justify-center px-6 py-12">
        <div aria-hidden className="absolute right-0 top-0 h-80 w-80 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative w-full max-w-[400px] animate-rise">
          <Link to="/" className="lg:hidden mb-10 inline-block" aria-label="Home"><Logo /></Link>
          <h1 className="text-[28px] font-semibold tracking-tight">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1.5 text-mist">
            {isSignup ? 'Already have an account? ' : 'New to Memory Clone? '}
            <Link to={isSignup ? '/login' : '/signup'} className="text-ice hover:underline underline-offset-4">
              {isSignup ? 'Log in' : 'Create an account'}
            </Link>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {isSignup && (
              <div>
                <label htmlFor="name" className="label">Name</label>
                <input id="name" className="field" autoComplete="name" required maxLength={80} value={form.name} onChange={set('name')} placeholder="Ayesha Khan" />
              </div>
            )}
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" className="field" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  className="field pr-11"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  maxLength={128}
                  value={form.password}
                  onChange={set('password')}
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="icon-btn absolute right-1.5 top-1.5" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {isSignup && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {pwChecks.map((c) => (
                    <li key={c.label} className={c.ok ? 'text-success' : 'text-dim'}>{c.ok ? '✓' : '○'} {c.label}</li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full h-11" disabled={busy || !form.email || !form.password || (isSignup && !form.name)}>
              {busy && <Spinner size={15} />}
              {isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
