import { supabase } from '../lib/supabase'

const BASE_URL = '/api'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (response.status === 401 && retry) {
    // Force a session refresh and retry once
    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
    if (refreshedSession) {
      return request<T>(path, options, false)
    }
    await supabase.auth.signOut()
    window.location.href = '/login'
    throw new ApiError(401, 'Session expired')
  }

  if (response.status === 204) return undefined as T

  const data = await response.json()

  if (!response.ok) {
    let errorMessage = 'Request failed'

    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((err: { msg?: string }) => err.msg || String(err))
          .join(', ')
      } else {
        errorMessage = String(data.detail)
      }
    }

    throw new ApiError(response.status, errorMessage)
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}

export { ApiError }
