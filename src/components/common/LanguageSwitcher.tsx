import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'light' | 'dark' | 'compact';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  variant = 'dark',
}) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language === 'kn' ? 'kn' : 'en';

  const setLanguage = (lang: 'en' | 'kn') => {
    if (currentLang !== lang) {
      i18n.changeLanguage(lang);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-lg border border-[#C8A46B]/40 bg-[#0B1F3A]/90 text-xs font-sans shadow-xs ${className}`}
      aria-label="Language Selector"
    >
      <Globe className="w-3.5 h-3.5 text-[#C8A46B] ml-1 mr-0.5 shrink-0" />
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C8A46B] ${
          currentLang === 'en'
            ? 'bg-[#C8A46B] text-[#08162A] shadow-xs'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
        }`}
        aria-pressed={currentLang === 'en'}
      >
        English
      </button>
      <span className="text-slate-500 text-[10px] select-none">|</span>
      <button
        type="button"
        onClick={() => setLanguage('kn')}
        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C8A46B] ${
          currentLang === 'kn'
            ? 'bg-[#C8A46B] text-[#08162A] shadow-xs'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
        }`}
        aria-pressed={currentLang === 'kn'}
      >
        ಕನ್ನಡ
      </button>
    </div>
  );
};
