import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireAuth } from './lib/auth.jsx'
import { FullScreenLoader } from './components/ui'
import Landing from './pages/Landing'
import AuthPage from './pages/AuthPage'
import AppShell from './components/AppShell'

const Overview = lazy(() => import('./pages/Overview'))
const Memories = lazy(() => import('./pages/Memories'))
const Chat = lazy(() => import('./pages/Chat'))
const Graph = lazy(() => import('./pages/Graph'))
const InsightsPage = lazy(() => import('./pages/Insights'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
        <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="memories" element={<Memories />} />
          <Route path="chat/:conversationId?" element={<Chat />} />
          <Route path="graph" element={<Graph />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
