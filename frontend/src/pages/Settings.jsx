import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ConfirmDialog, PageHeader, Spinner } from '../components/ui'
import { Auth, Docs, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/toast.jsx'

export default function Settings() {
  const { user, setUser, applySession, logout } = useAuth()
  const { health } = useOutletContext() || {}
  const toast = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [busy, setBusy] = useState('')
  const [dialog, setDialog] = useState(null) // 'memories' | 'account'
  const [deletePw, setDeletePw] = useState('')

  const run = async (key, fn, ok) => {
    setBusy(key)
    try { await fn(); if (ok) toast(ok) } catch (e) { toast(errorMessage(e), 'error') }
    setBusy('')
  }

  return (
    <div className="animate-fade max-w-3xl">
      <PageHeader title="Settings" description="Manage your profile, security and stored data." />

      <Section title="Profile">
        <form onSubmit={(e) => { e.preventDefault(); run('name', async () => setUser(await Auth.updateProfile({ name: name.trim() })), 'Profile updated') }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="s-name">Name</label><input id="s-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
            <div><label className="label" htmlFor="s-email">Email</label><input id="s-email" className="field opacity-70" value={user?.email || ''} disabled /></div>
          </div>
          <button className="btn-primary" disabled={busy === 'name' || !name.trim() || name.trim() === user?.name}>{busy === 'name' && <Spinner size={14} />}Save profile</button>
        </form>
      </Section>

      <Section title="Password" description="Changing your password signs you out on every other device.">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run('pw', async () => { applySession(await Auth.changePassword(pw)); setPw({ current_password: '', new_password: '' }) }, 'Password changed')
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="cur">Current password</label><input id="cur" type="password" autoComplete="current-password" className="field" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></div>
            <div><label className="label" htmlFor="new">New password</label><input id="new" type="password" autoComplete="new-password" className="field" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy === 'pw' || !pw.current_password || pw.new_password.length < 8}>{busy === 'pw' && <Spinner size={14} />}Change password</button>
            <button type="button" className="btn-ghost" disabled={busy === 'all'} onClick={() => run('all', async () => { await Auth.logoutAll(); logout(); navigate('/login') })}>
              Sign out everywhere
            </button>
          </div>
        </form>
      </Section>

      <Section title="System" description="What's powering your memory right now.">
        {health?.status === 'ok' ? (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Info label="Language model" value={health.llm.available ? `${health.llm.model} (${health.llm.provider})` : 'Not configured — extractive answers only'} warn={!health.llm.available} />
            <Info label="Embedding model" value={`${health.embeddings.model}`} />
            <Info label="Upload limit" value={`${health.max_upload_mb} MB per file`} />
            <Info label="API version" value={health.version} />
          </dl>
        ) : <p className="text-sm text-danger">The backend is not reachable.</p>}
        <button className="btn-ghost mt-4" disabled={busy === 'reindex'} onClick={() => run('reindex', Docs.reindex, 'Re-indexing started. Search may be incomplete for a minute.')}>
          {busy === 'reindex' && <Spinner size={14} />}Rebuild search index
        </button>
        <p className="mt-2 text-xs text-dim">Use this after changing the embedding model in backend/.env.</p>
      </Section>

      <Section title="Danger zone" danger>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">Delete all memories</p><p className="text-sm text-mist">Removes every document and passage. Conversations and your account stay.</p></div>
          <button className="btn-danger shrink-0" onClick={() => setDialog('memories')}>Delete memories</button>
        </div>
        <div className="mt-5 flex flex-col gap-4 border-t border-danger/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-medium">Delete account</p><p className="text-sm text-mist">Permanently deletes your account, memories, conversations and insights.</p></div>
          <button className="btn-danger shrink-0" onClick={() => setDialog('account')}>Delete account</button>
        </div>
      </Section>

      <ConfirmDialog
        open={dialog === 'memories'}
        title="Delete all memories?"
        message="Every document and its passages will be permanently removed. This can't be undone."
        confirmLabel="Delete all memories"
        busy={busy === 'wipe'}
        onClose={() => setDialog(null)}
        onConfirm={() => run('wipe', async () => { const r = await Docs.removeAll(); toast(`Deleted ${r.deleted} documents`); setDialog(null) })}
      />
      <ConfirmDialog
        open={dialog === 'account'}
        title="Delete your account?"
        message="This permanently deletes everything. Enter your password to confirm."
        confirmLabel="Delete account"
        busy={busy === 'account'}
        onClose={() => { setDialog(null); setDeletePw('') }}
        onConfirm={() => run('account', async () => { await Auth.deleteAccount(deletePw); logout(); navigate('/') })}
      >
        <input type="password" className="field mt-4" placeholder="Password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} aria-label="Password" autoComplete="current-password" />
      </ConfirmDialog>
    </div>
  )
}

function Section({ title, description, children, danger }) {
  return (
    <section className={`mb-5 rounded-2xl p-6 ${danger ? 'border border-danger/25 bg-danger/[.04]' : 'glass'}`}>
      <h2 className={`font-medium ${danger ? 'text-danger' : ''}`}>{title}</h2>
      {description && <p className="mt-1 text-sm text-mist">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Info({ label, value, warn }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <dt className="text-dim">{label}</dt>
      <dd className={`mt-0.5 break-words ${warn ? 'text-warn' : 'text-frost'}`}>{value}</dd>
    </div>
  )
}
