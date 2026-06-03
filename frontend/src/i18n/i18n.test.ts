import { describe, it, expect, beforeEach } from 'vitest'
import i18n, { SUPPORTED_LOCALES, isSupportedLocale, DEFAULT_LOCALE } from './index'

describe('i18n config', () => {
  beforeEach(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE)
  })

  it('exposes es-ES and fr-FR as supported locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['es-ES', 'fr-FR'])
  })

  it('validates supported locales', () => {
    expect(isSupportedLocale('fr-FR')).toBe(true)
    expect(isSupportedLocale('de-DE')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })

  it('resolves Spanish source strings by default', () => {
    expect(i18n.t('auth.login.welcome')).toBe('Bienvenido')
    expect(i18n.t('actions.save')).toBe('Guardar')
  })

  it('resolves French strings after changing language', async () => {
    await i18n.changeLanguage('fr-FR')
    expect(i18n.t('auth.login.welcome')).toBe('Bienvenue')
    expect(i18n.t('actions.save')).toBe('Enregistrer')
  })
})
