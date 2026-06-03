import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
export { useTranslation } from 'react-i18next';
import esES from '../locales/es-ES/common.json';
import frFR from '../locales/fr-FR/common.json';

export const SUPPORTED_LOCALES = ['es-ES', 'fr-FR'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es-ES';
export const STORAGE_KEY = 'locale';

export function isSupportedLocale(value: string | null): value is Locale {
  return (
    value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

const stored = localStorage.getItem(STORAGE_KEY);
const initialLocale: Locale = isSupportedLocale(stored)
  ? stored
  : DEFAULT_LOCALE;

i18n.use(initReactI18next).init({
  resources: {
    'es-ES': { common: esES },
    'fr-FR': { common: frFR },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: ['common'],
  load: 'currentOnly',
  interpolation: { escapeValue: false },
});

export default i18n;
