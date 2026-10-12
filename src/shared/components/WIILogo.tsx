import React from 'react';
import { useApp } from '../../context/AppContext';
import { Building2 } from 'lucide-react';

interface WIILogoProps {
  variant?: 'full' | 'mark' | 'horizontal' | 'compact';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  textColor?: string;
  customLogoUrl?: string;
  align?: 'left' | 'center' | 'right';
}

export const WIILogo: React.FC<WIILogoProps> = ({
  variant = 'horizontal',
  className = '',
  size = 'md',
  textColor = 'text-[#2563eb]',
  customLogoUrl,
  align = 'left'
}) => {
  let branding;
  try {
    const context = useApp();
    branding = context?.orgBranding;
  } catch (e) {
    branding = null;
  }

  const effectiveLogoUrl = customLogoUrl || branding?.logoUrl || '';
  const orgHindiName = branding?.orgHindiName || '';
  const orgName = branding?.orgName || 'Enterprise Portal';

  // Alignment classes mapping
  const justifyClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  // If a logo is uploaded, render the uploaded logo across all layouts
  if (effectiveLogoUrl) {
    const heightClass =
      size === 'sm' ? 'h-8' : size === 'md' ? 'h-10 sm:h-11' : size === 'lg' ? 'h-13 sm:h-14' : 'h-16 sm:h-18';
    const objectPos = align === 'center' ? 'object-center' : align === 'right' ? 'object-right' : 'object-left';

    if (variant === 'mark') {
      return (
        <div className={`inline-flex items-center justify-center ${className}`}>
          <img
            src={effectiveLogoUrl}
            alt={orgName}
            className={`${heightClass} w-auto object-contain shrink-0`}
          />
        </div>
      );
    }

    return (
      <div className={`flex items-center ${justifyClass} w-full select-none ${className}`}>
        <img
          src={effectiveLogoUrl}
          alt={orgName}
          className={`${heightClass} w-auto ${objectPos} object-contain max-w-full shrink-0`}
        />
      </div>
    );
  }

  // Fallback when NO logo is uploaded yet: Clean, professional institutional brand mark (No hardcoded SVG logos)
  const iconSize = size === 'sm' ? 18 : size === 'md' ? 22 : size === 'lg' ? 28 : 34;
  const boxSize = size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-10 h-10' : size === 'lg' ? 'w-12 h-12' : 'w-16 h-16';

  if (variant === 'mark') {
    return (
      <div className={`inline-flex items-center justify-center ${boxSize} rounded-xl bg-[#2563eb] text-white shadow-2xs shrink-0 ${className}`}>
        <Building2 size={iconSize} />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2.5 ${className}`}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-[#2563eb] text-white shadow-2xs shrink-0`}>
          <Building2 size={16} />
        </div>
        <div className="leading-tight">
          {orgHindiName && (
            <span className={`block text-[11px] font-bold tracking-tight ${textColor} font-serif truncate max-w-[180px]`}>
              {orgHindiName}
            </span>
          )}
          <span className={`block text-[11px] font-extrabold tracking-tight ${textColor} truncate max-w-[180px]`}>
            {orgName}
          </span>
        </div>
      </div>
    );
  }

  const englishTextSize = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-[13px] sm:text-sm' : 'text-base sm:text-lg';

  return (
    <div className={`flex items-center ${justifyClass} space-x-2.5 sm:space-x-3 select-none w-full ${className}`}>
      <div className={`flex items-center justify-center ${boxSize} rounded-xl bg-[#2563eb] text-white shadow-2xs shrink-0`}>
        <Building2 size={iconSize} />
      </div>
      <div className="flex flex-col justify-center leading-tight min-w-0 flex-1 text-left">
        {orgHindiName && (
          <h2 className={`font-serif font-bold text-[11px] sm:text-xs ${textColor} leading-tight truncate`}>
            {orgHindiName}
          </h2>
        )}
        <h1 className={`font-serif font-black ${englishTextSize} ${textColor} leading-tight truncate tracking-tight`}>
          {orgName}
        </h1>
      </div>
    </div>
  );
};

