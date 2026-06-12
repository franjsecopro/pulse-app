import { beforeEach, describe, expect, it } from 'vitest'
import esES from '../locales/es-ES/common.json'
import frFR from '../locales/fr-FR/common.json'
import i18n, { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES } from './index'

/** Flattens nested translation objects into dot-paths ("toasts.classCreated"). */
function flattenKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return [prefix]
  return Object.entries(node).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  )
}

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

describe('locale completeness', () => {
  it('fr-FR has exactly the same keys as es-ES (no missing, no extra)', () => {
    const esKeys = flattenKeys(esES).sort()
    const frKeys = flattenKeys(frFR).sort()

    const missingInFr = esKeys.filter((k) => !frKeys.includes(k))
    const extraInFr = frKeys.filter((k) => !esKeys.includes(k))

    expect(missingInFr, `keys missing in fr-FR: ${missingInFr.join(', ')}`).toEqual([])
    expect(extraInFr, `extra keys in fr-FR: ${extraInFr.join(', ')}`).toEqual([])
  })
})
