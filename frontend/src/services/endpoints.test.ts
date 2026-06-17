import { describe, expect, it } from 'vitest'
import { ENDPOINTS } from './endpoints'

describe('ENDPOINTS', () => {
  it('exposes static auth paths', () => {
    expect(ENDPOINTS.auth.login).toBe('/auth/login')
    expect(ENDPOINTS.auth.refresh).toBe('/auth/refresh')
    expect(ENDPOINTS.auth.me).toBe('/auth/me')
  })

  it('builds client paths from ids', () => {
    expect(ENDPOINTS.clients.base).toBe('/clients')
    expect(ENDPOINTS.clients.byId(42)).toBe('/clients/42')
    expect(ENDPOINTS.clients.archive(42)).toBe('/clients/42/archive')
    expect(ENDPOINTS.clients.contracts(7)).toBe('/clients/7/contracts')
    expect(ENDPOINTS.clients.contractById(7, 99)).toBe('/clients/7/contracts/99')
  })

  it('builds invoice paths from ids', () => {
    expect(ENDPOINTS.invoices.base).toBe('/invoices')
    expect(ENDPOINTS.invoices.byId(5)).toBe('/invoices/5')
    expect(ENDPOINTS.invoices.issue(5)).toBe('/invoices/5/issue')
    expect(ENDPOINTS.invoices.send(5)).toBe('/invoices/5/send')
    expect(ENDPOINTS.invoices.pdf(5)).toBe('/invoices/5/pdf')
  })

  it('returns the full browser URL for invoice previews', () => {
    expect(ENDPOINTS.invoices.previewUrl(5)).toBe('/api/invoices/5/preview')
  })

  it('builds admin paths from ids', () => {
    expect(ENDPOINTS.admin.users).toBe('/admin/users')
    expect(ENDPOINTS.admin.userById(3)).toBe('/admin/users/3')
    expect(ENDPOINTS.admin.clientById(8)).toBe('/admin/clients/8')
    expect(ENDPOINTS.admin.clientMoveFromDemo(8)).toBe('/admin/clients/8/move-from-demo')
  })
})
