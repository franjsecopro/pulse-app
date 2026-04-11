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

function getStoredTokens() {
  return {
    accessToken: localStorage.getItem('access_token'),
    refreshToken: localStorage.getItem('refresh_token'),
  }
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('access_token', accessToken)
  localStorage.setItem('refresh_token', refreshToken)
}

function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredTokens()
  if (!refreshToken) return null

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) {
    clearTokens()
    return null
  }

  const data = await response.json()
  storeTokens(data.access_token, data.refresh_token)
  return data.access_token
}

async function requestFull<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<{ data: T; headers: Headers }> {
  const { accessToken } = getStoredTokens()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (response.status === 401 && retry) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      return requestFull<T>(path, options, false)
    }
    // Token refresh failed — redirect to login
    clearTokens()
    window.location.href = '/login'
    throw new ApiError(401, 'Session expired')
  }

  if (response.status === 204) return { data: undefined as T, headers: response.headers }

  const data = await response.json()

  if (!response.ok) {
    let errorMessage = 'Request failed'

    if (data?.detail) {
      // Handle validation errors (array of error objects) or string errors
      if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((err: any) => err.msg || String(err))
          .join(', ')
      } else {
        errorMessage = String(data.detail)
      }
    }

    throw new ApiError(response.status, errorMessage)
  }

  return { data: data as T, headers: response.headers }
}

function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  return requestFull<T>(path, options, retry).then(r => r.data)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getPageable: <T>(path: string) =>
    requestFull<T>(path).then(({ data, headers }) => ({
      data,
      total: parseInt(headers.get('X-Total-Count') ?? '0', 10),
    })),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
  storeTokens,
  clearTokens,
  getStoredTokens,
}

export { ApiError }
