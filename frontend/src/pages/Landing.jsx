import { Link } from 'react-router-dom'
import { FileText, MessageSquareText, Network, Sparkles, ShieldCheck, Quote, Upload, Brain, Search } from 'lucide-react'
import { Logo } from '../components/ui'
import Constellation from '../components/Constellation'
import { useAuth } from '../lib/auth.jsx'

const STEPS = [
  { icon: Upload, title: 'Add what you know', body: 'Drop in PDFs, text and Markdown files, or write notes straight into your memory.' },
  { icon: Brain, title: 'It reads and remembers', body: 'Each document is split into passages, embedded with Sentence Transformers and stored in your private vector space.' },
  { icon: Search, title: 'Ask in your own words', body: 'Questions are matched by meaning, not keywords, and answered from your passages with numbered citations.' },
]

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-void">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 px-3">
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 glass-strong">
          <Link to="/" aria-label="Memory Clone home"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-mist">
            <a href="#how" className="btn-quiet h-9">How it works</a>
            <a href="#features" className="btn-quiet h-9">Features</a>
            <a href="#privacy" className="btn-quiet h-9">Privacy</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/app" className="btn-primary h-9">Open dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-quiet h-9">Log in</Link>
                <Link to="/signup" className="btn-primary h-9">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[100svh] flex items-center">
        <Constellation className="absolute inset-0 h-full w-full" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[46%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(47,107,255,.42)_0%,rgba(47,107,255,0)_62%)] blur-2xl animate-breathe" />
          <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.35)_0%,rgba(34,211,238,0)_65%)] blur-xl" />
          <div className="absolute inset-[8%] rounded-full border border-ice/10 animate-orbit">
            <span className="absolute -top-1 left-1/2 h-2 w-2 rounded-full bg-ice shadow-[0_0_16px_#7DE7FF]" />
          </div>
          <div className="absolute inset-[28%] rounded-full border border-electric/15" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-void to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-6 pt-28 pb-20 text-center">
          <h1 className="mx-auto max-w-4xl text-[44px] leading-[1.02] sm:text-7xl font-semibold tracking-[-0.035em] text-gradient animate-rise">
            Everything you've read, ready when you ask.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-mist animate-rise [animation-delay:120ms]">
            Memory Clone turns your notes and documents into a private memory you can talk to.
            Every answer shows exactly which page it came from.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 animate-rise [animation-delay:220ms]">
            <Link to={user ? '/app' : '/signup'} className="btn-primary h-12 px-6 text-[15px]">
              {user ? 'Open your memory' : 'Create your memory'}
            </Link>
            <a href="#how" className="btn-ghost h-12 px-6 text-[15px]">See how it works</a>
          </div>
        </div>
      </section>

      {/* How it works — a real sequence, so it is numbered */}
      <section id="how" className="relative mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight max-w-xl">From a pile of files to answers you can trust</h2>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative bg-abyss p-7">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-electric/30 bg-electric/10 text-ice"><Icon size={17} /></span>
                <span className="font-mono text-xs text-dim">Step {i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-mist">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features bento */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Built for thinking, not filing</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <div className="relative overflow-hidden glass rounded-3xl p-8 md:col-span-4 md:row-span-2">
            <div aria-hidden className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-electric/25 blur-3xl" />
            <MessageSquareText className="text-ice" size={22} />
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">Answers with receipts</h3>
            <p className="mt-2 max-w-md text-mist leading-relaxed">
              Chat answers stream in live and cite the passages they rely on. Click a citation to see the exact text, page and relevance score.
            </p>
            <div className="mt-8 rounded-2xl border border-line bg-black/50 p-5 text-left">
              <div className="flex gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-electric/20 text-ice"><Quote size={14} /></span>
                <div className="text-[15px] leading-7 text-frost/90">
                  Your notes describe retrieval as a two-step process: find the closest passages, then let the model write from them
                  <Cite n={1} />. The lecture slides add that chunk overlap keeps ideas from being cut in half <Cite n={2} />.
                </div>
              </div>
              <p className="mt-4 text-xs text-dim">Example of how a cited answer is laid out</p>
            </div>
          </div>
          <Feature className="md:col-span-2" icon={Network} title="Knowledge graph">
            See which documents share ideas. Links come from keyword overlap and semantic similarity between documents.
          </Feature>
          <Feature className="md:col-span-2" icon={Sparkles} title="Insights on demand">
            Get focus areas, patterns, gaps and next steps drawn from everything you've stored.
          </Feature>
          <Feature className="md:col-span-3" icon={FileText} title="Summaries for every file">
            Each upload gets a short summary and topic tags as soon as it's processed, so your library stays scannable.
          </Feature>
          <Feature id="privacy" className="md:col-span-3" icon={ShieldCheck} title="Private by account">
            Each account has its own vector collection. Passwords are salted and hashed, sessions expire, and you can delete everything in one step.
          </Feature>
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-6xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-3xl border border-electric/25 bg-gradient-to-b from-electric/15 to-transparent px-8 py-16 text-center">
          <div aria-hidden className="absolute left-1/2 top-0 h-64 w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/30 blur-3xl" />
          <h2 className="relative text-3xl sm:text-4xl font-semibold tracking-tight">Start with one document</h2>
          <p className="relative mx-auto mt-3 max-w-md text-mist">Upload a PDF you care about and ask it a question. It takes under a minute.</p>
          <Link to={user ? '/app/memories' : '/signup'} className="btn-primary relative mt-8 h-12 px-6 text-[15px]">
            {user ? 'Upload a document' : 'Create a free account'}
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-6 py-8 text-sm text-dim">
          <Logo size={22} />
          <p>FastAPI, ChromaDB, Sentence Transformers and React.</p>
        </div>
      </footer>
    </div>
  )
}

function Cite({ n }) {
  return (
    <span className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-electric/40 bg-electric/15 px-1 align-[1px] font-mono text-[10.5px] text-ice">
      {n}
    </span>
  )
}

function Feature({ icon: Icon, title, children, className = '', id }) {
  return (
    <div id={id} className={`glass rounded-3xl p-7 transition-colors hover:border-electric/30 ${className}`}>
      <Icon className="text-ice" size={20} />
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-mist">{children}</p>
    </div>
  )
}
