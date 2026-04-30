import axios from 'axios'

const API = axios.create({ baseURL: 'http://localhost:8000' })

export const uploadText = (content, title) =>
  API.post('/upload/text', { content, title })

export const uploadPDF = (file) => {
  const form = new FormData()
  form.append('file', file)
  return API.post('/upload/pdf', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const sendChat = (message, session_id = 'default') =>
  API.post('/chat', { message, session_id })

export const getMemories = () => API.get('/memories')

export const analyzeBrain = () => API.post('/analyze')

export const getGraph = () => API.get('/graph')

export const clearMemories = () => API.delete('/memories/clear')
