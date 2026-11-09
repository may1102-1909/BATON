import { supabase } from './supabase'

let demoContext = { enabled: false, user: 'demo-admin' }

export function setDemoContext(enabled, user = 'demo-admin') {
  demoContext = { enabled: Boolean(enabled), user }
}

async function headers(extra = {}) {
  const result = { Accept: 'application/json', ...extra }
  if (demoContext.enabled) {
    result['x-baton-demo-user'] = demoContext.user
  } else if (supabase) {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (token) result.Authorization = `Bearer ${token}`
  }
  return result
}

export async function api(path, options = {}) {
  const requestHeaders = await headers(options.headers)
  const response = await fetch(path, {
    ...options,
    headers: {
      ...requestHeaders,
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined || typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body),
  })
  const text = await response.text()
  let payload
  try { payload = text ? JSON.parse(text) : {} } catch { payload = { error: text || 'Unexpected server response' } }
  if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`)
  return payload
}

export const get = path => api(path)
export const post = (path, body = {}) => api(path, { method: 'POST', body })
export const patch = (path, body = {}) => api(path, { method: 'PATCH', body })
export const del = path => api(path, { method: 'DELETE' })
export const orgPath = (orgId, suffix = '') => `/api/orgs/${encodeURIComponent(orgId)}${suffix}`
