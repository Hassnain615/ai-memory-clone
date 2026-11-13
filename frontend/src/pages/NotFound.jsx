import { Link } from 'react-router-dom'
import { Aura, Logo } from '../components/ui'

export default function NotFound() {
  return (
    <div className="relative min-h-screen grid place-items-center overflow-hidden px-6 text-center">
      <Aura className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] opacity-60" />
      <div className="relative">
        <Logo size={40} withText={false} />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">This page isn't in memory</h1>
        <p className="mt-2 text-mist">The link may be broken, or the page may have moved.</p>
        <Link to="/" className="btn-primary mt-8">Go to home page</Link>
      </div>
    </div>
  )
}
