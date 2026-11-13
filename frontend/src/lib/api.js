import axios from 'axios'

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const TOKEN_KEY = 'mc_token'

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* storage unavailable */ } },
}

export const api = axios.create({ baseURL: API_BASE, timeout: 120000 })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ''
    if (err.response?.status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/auth/signup')) {
      tokenStore.clear()
      window.dispatchEvent(new Event('auth:expired'))
    }
    return Promise.reject(err)
  },
)

/** Human-readable message from an axios / fetch error. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Make sure the backend is running on port 8000.'
  const detail = err.response?.data?.detail ?? err.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const d = detail[0]
    const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : ''
    return field && field !== 'body' ? `${field}: ${d.msg}` : d.msg
  }
  return err.message || fallback
}

// ---------------------------------------------------------------- endpoints
export const Auth = {
  signup: (data) => api.post('/auth/signup', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateProfile: (data) => api.patch('/auth/me', data).then((r) => r.data),
  changePassword: (data) => api.post('/auth/change-password', data).then((r) => r.data),
  logoutAll: () => api.post('/auth/logout-all').then((r) => r.data),
  deleteAccount: (password) => api.delete('/auth/me', { data: { password } }).then((r) => r.data),
}

export const Docs = {
  list: () => api.get('/documents').then((r) => r.data),
  get: (id) => api.get(`/documents/${id}`).then((r) => r.data),
  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post('/documents/upload', form, {
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      })
      .then((r) => r.data)
  },
  createNote: (title, content) => api.post('/documents/note', { title, content }).then((r) => r.data),
  update: (id, data) => api.patch(`/documents/${id}`, data).then((r) => r.data),
  summarize: (id) => api.post(`/documents/${id}/summarize`).then((r) => r.data),
  remove: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
  removeAll: () => api.delete('/documents').then((r) => r.data),
  reindex: () => api.post('/documents/reindex').then((r) => r.data),
  search: (q, k = 8) => api.get('/search', { params: { q, k } }).then((r) => r.data),
}

export const Conversations = {
  list: () => api.get('/conversations').then((r) => r.data),
  get: (id) => api.get(`/conversations/${id}`).then((r) => r.data),
  rename: (id, title) => api.patch(`/conversations/${id}`, { title }).then((r) => r.data),
  remove: (id) => api.delete(`/conversations/${id}`).then((r) => r.data),
}

export const Insights = {
  latest: () => api.get('/insights/latest').then((r) => r.data.insight),
  generate: () => api.post('/insights/generate', null, { timeout: 180000 }).then((r) => r.data.insight),
  topics: () => api.get('/insights/topics').then((r) => r.data.topics),
}

export const System = {
  health: () => api.get('/health').then((r) => r.data),
  analytics: () => api.get('/analytics').then((r) => r.data),
  graph: () => api.get('/graph').then((r) => r.data),
}

/**
 * Stream a RAG answer over Server-Sent Events (POST + fetch reader).
 * Handlers: onMeta({conversation_id, sources, mode}), onToken(text), onDone({message_id}), onError(message)
 */
export async function streamChat(body, { onMeta, onToken, onDone, onError, signal } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStore.get() || ''}` },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') return
    onError?.('Cannot reach the server. Make sure the backend is running.')
    return
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try { detail = errorMessage({ detail: (await res.json()).detail }, detail) } catch { /* not json */ }
    if (res.status === 401) { tokenStore.clear(); window.dispatchEvent(new Event('auth:expired')) }
    onError?.(detail)
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 2)
        if (!raw.startsWith('data:')) continue
        let event
        try { event = JSON.parse(raw.slice(5).trim()) } catch { continue }
        if (event.type === 'meta') onMeta?.(event)
        else if (event.type === 'token') onToken?.(event.content)
        else if (event.type === 'done') onDone?.(event)
        else if (event.type === 'error') onError?.(event.message, event)
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') onError?.('The connection was interrupted.')
  }
}
