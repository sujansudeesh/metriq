import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import kn from './locales/kn.json';

const STORAGE_KEY = 'metriq.uiLanguage';

const getInitialLanguage = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'kn') {
      return saved;
    }
  } catch (err) {
    console.warn('localStorage not accessible for language preference:', err);
  }
  return 'en';
};

const initialLang = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      kn: { translation: kn },
    },
    lng: initialLang,
    fallbackLng: 'en',
    supportedLngs: ['en', 'kn'],
    interpolation: {
      escapeValue: false, // React handles XSS escaping
    },
    returnNull: false,
  });

// Update html lang attribute on language change
i18n.on('languageChanged', (lng: string) => {
  try {
    if (lng === 'en' || lng === 'kn') {
      localStorage.setItem(STORAGE_KEY, lng);
    }
  } catch (err) {
    console.warn('Failed to save language preference:', err);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

// Set initial document lang
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
}

export default i18n;
