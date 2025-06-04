import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

async function loadTranslations() {
  try {
    const [zhTWResponse, enResponse] = await Promise.all([
      fetch(chrome.runtime.getURL('locales/zh-TW/translation.json')),
      fetch(chrome.runtime.getURL('locales/en/translation.json'))
    ]);
    
    const zhTWTranslation = await zhTWResponse.json();
    const enTranslation = await enResponse.json();
    
    return { zhTWTranslation, enTranslation };
  } catch (error) {
    console.error('❌ Failed to load translations:', error);
    throw error;
  }
}

export async function initI18n() {
  try {
    const savedLanguage = await getSavedLanguage();
    const { zhTWTranslation, enTranslation } = await loadTranslations();
    
    await i18next
      .use(LanguageDetector)
      .init({
        lng: savedLanguage || 'zh-TW',
        fallbackLng: 'zh-TW',
        debug: false,
        
        detection: {
          order: ['localStorage', 'navigator'],
          caches: ['localStorage'],
          lookupLocalStorage: 'i18nextLng'
        },
        
        resources: {
          'zh-TW': { translation: zhTWTranslation },
          'en': { translation: enTranslation }
        },
        
        interpolation: {
          escapeValue: false
        }
      });
      
    console.log('✅ i18n initialized, language:', i18next.language);
    return i18next;
  } catch (error) {
    console.error('❌ Failed to initialize i18n:', error);
    throw error;
  }
}function getSavedLanguage() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['selectedLanguage'], (result) => {
        resolve(result.selectedLanguage || null);
      });
    } else {
      resolve(localStorage.getItem('i18nextLng'));
    }
  });
}

export async function changeLanguage(language) {
  try {
    await i18next.changeLanguage(language);
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ selectedLanguage: language });
    }
    localStorage.setItem('i18nextLng', language);
    
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language } 
    }));
    
    console.log('✅ Language changed to:', language);
  } catch (error) {
    console.error('❌ Failed to change language:', error);
    throw error;
  }
}

export function getCurrentLanguage() {
  return i18next.language || 'zh-TW';
}

export function getAvailableLanguages() {
  return ['zh-TW', 'en'];
}

export function getAvailableLanguagesWithDetails() {
  return [
    { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
    { code: 'en', name: 'English', flag: '🇺🇸' }
  ];
}

export function t(key, options = {}) {
  return i18next.t(key, options);
}

export function isI18nReady() {
  return i18next.isInitialized;
}

export { i18next };