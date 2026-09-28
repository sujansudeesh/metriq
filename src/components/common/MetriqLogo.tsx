import React, { useState } from 'react';

export interface MetriqLogoProps {
  variant?: 'full' | 'compact' | 'logo-only' | 'mark-only' | 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  showSIHBadge?: boolean;
  className?: string;
  isLight?: boolean;
}

export const MetriqLogo: React.FC<MetriqLogoProps> = ({
  variant = 'full',
  size = 'md',
  showSubtitle = false,
  showSIHBadge = true,
  className = '',
  isLight = true,
}) => {
  const [imgError, setImgError] = useState(false);

  const effectiveIsLight = variant === 'light' ? true : variant === 'dark' ? false : isLight;
  const effectiveVariant = variant === 'light' || variant === 'dark' ? 'full' : variant;

  // Size mapping for mark container & full logo height
  const markSizeClasses = {
    sm: 'w-8 h-8 min-w-[32px] min-h-[32px]',
    md: 'w-9 h-9 min-w-[36px] min-h-[36px]',
    lg: 'w-12 h-12 min-w-[48px] min-h-[48px]',
    xl: 'w-16 h-16 min-w-[64px] min-h-[64px]',
  };

  const fullLogoSizeClasses = {
    sm: 'h-8 max-w-[140px]',
    md: 'h-10 max-w-[190px]',
    lg: 'h-14 max-w-[240px]',
    xl: 'h-20 max-w-[320px]',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const isCompact = effectiveVariant === 'compact' || effectiveVariant === 'mark-only';

  if (isCompact) {
    return (
      <div className={`flex items-center gap-2.5 select-none ${className}`}>
        <div className={`${markSizeClasses[size]} shrink-0 flex items-center justify-center`}>
          {!imgError ? (
            <img
              src="/branding/metriq-mark.png"
              alt="METRIQ Emblem"
              onError={() => setImgError(true)}
              className="w-full h-full object-contain object-center"
            />
          ) : (
            <span className="font-extrabold text-[#C8A46B] text-xs border border-[#C8A46B] px-1 py-0.5 rounded">
              M
            </span>
          )}
        </div>

        {effectiveVariant !== 'mark-only' && (
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className={`font-extrabold tracking-tight font-sans ${effectiveIsLight ? 'text-white' : 'text-[#0B1F3A]'} ${textSizes[size]}`}>
                METRIQ
              </span>
              {showSIHBadge && (
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1 py-0.2 bg-[#C8A46B]/20 text-[#C8A46B] border border-[#C8A46B]/40 rounded">
                  SIH26035
                </span>
              )}
            </div>
            {showSubtitle && (
              <span className={`text-[10px] font-sans leading-tight ${effectiveIsLight ? 'text-slate-300' : 'text-slate-500'}`}>
                OIML R 76 Compliance System
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full Wordmark variant
  return (
    <div className={`flex flex-col items-start select-none ${className}`}>
      <div className="flex items-center gap-3">
        {!imgError ? (
          <img
            src="/branding/metriq-logo.png"
            alt="METRIQ Logo"
            onError={() => setImgError(true)}
            className={`${fullLogoSizeClasses[size]} w-auto object-contain object-left`}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className={`font-extrabold tracking-tight font-sans ${effectiveIsLight ? 'text-white' : 'text-[#0B1F3A]'} ${textSizes[size]}`}>
              METRIQ
            </span>
          </div>
        )}
        {showSIHBadge && !imgError && (
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[#C8A46B]/20 text-[#C8A46B] border border-[#C8A46B]/40 rounded shrink-0">
            SIH26035
          </span>
        )}
      </div>

      {showSubtitle && (
        <div className="mt-1 space-y-0.5">
          <span className="text-xs font-bold text-[#C8A46B] tracking-wide block">
            OIML R 76 Test &amp; Compliance System
          </span>
          <span className={`text-[10px] font-mono block ${effectiveIsLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Type Evaluation &amp; Verification Platform (SIH26035)
          </span>
        </div>
      )}
    </div>
  );
};
