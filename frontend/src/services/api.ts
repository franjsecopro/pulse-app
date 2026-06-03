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

async function refreshSession(): Promise<boolean> {
  // refresh_token is httpOnly — not readable via document.cookie.
  // Just attempt the call; the backend rejects it if the token is absent or expired.
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  return response.ok
}

async function requestFull<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<{ data: T; headers: Headers }> {
  // FormData sets its own multipart boundary — never force a JSON Content-Type on it.
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',  // httpOnly cookies are sent automatically
  })

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return requestFull<T>(path, options, false)
    }
    window.dispatchEvent(new CustomEvent('session-expired'))
    throw new ApiError(401, 'Session expired')
  }

  if (response.status === 204) return { data: undefined as T, headers: response.headers }

  const data = await response.json()

  if (!response.ok) {
    let errorMessage = 'Request failed'

    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((err: unknown) => (err as { msg?: string }).msg || String(err))
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

/** Fetch a binary payload (e.g. a generated .xlsx) with the same 401-refresh flow. */
async function requestBlob(path: string, retry = true): Promise<Blob> {
  const response = await fetch(`${BASE_URL}${path}`, { credentials: 'include' })

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession()
    if (refreshed) return requestBlob(path, false)
    window.dispatchEvent(new CustomEvent('session-expired'))
    throw new ApiError(401, 'Session expired')
  }

  if (!response.ok) {
    throw new ApiError(response.status, 'No se pudo generar el archivo')
  }

  return response.blob()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getBlob: (path: string) => requestBlob(path),
  getPageable: <T>(path: string) =>
    requestFull<T>(path).then(({ data, headers }) => ({
      data,
      total: parseInt(headers.get('X-Total-Count') ?? '0', 10),
    })),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export { ApiError }
