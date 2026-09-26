import React from 'react';

interface LogoProps {
  variant?: 'full' | 'compact' | 'light' | 'dark';
  showSubtitle?: boolean;
  showSIHBadge?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  showSubtitle = true,
  showSIHBadge = false,
}) => {
  const isDarkBg = variant === 'dark' || variant === 'full';

  return (
    <div className="flex items-center gap-3 select-none">
      {/* Custom Weighing Scale + Verification Checkmark Emblem */}
      <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-md shadow-teal-900/20 border border-teal-500/30 shrink-0">
        <svg
          className="w-6 h-6 text-teal-100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Balance beam and central fulcrum */}
          <path d="M12 3v7" />
          <path d="M5 10h14" />
          {/* Left pan */}
          <path d="M5 10l-2 5h6l-2-5" />
          {/* Right pan */}
          <path d="M19 10l-2 5h6l-2-5" />
          {/* Base */}
          <path d="M8 21h8" />
          <path d="M12 17v4" />
        </svg>

        {/* Verification Checkmark Shield Badge */}
        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full ring-2 ring-slate-900 flex items-center justify-center">
          <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`font-bold tracking-tight text-lg ${isDarkBg ? 'text-white' : 'text-slate-900'}`}>
            NAWI<span className="text-teal-400 font-semibold ml-0.5">Verify</span>
          </span>
          {showSIHBadge && (
            <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded">
              SIH26035
            </span>
          )}
        </div>

        {showSubtitle && (
          <span className={`text-[11px] leading-tight font-medium ${isDarkBg ? 'text-slate-400' : 'text-slate-500'}`}>
            OIML R 76 Test & Compliance System
          </span>
        )}
      </div>
    </div>
  );
};
