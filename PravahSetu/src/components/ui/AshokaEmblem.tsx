import React from 'react';

interface AshokaEmblemProps {
  className?: string;
  variant?: 'dark' | 'light';
  /** Enable the float + golden-shimmer idle animation (default true) */
  animated?: boolean;
}

export const AshokaEmblem: React.FC<AshokaEmblemProps> = ({
  className = 'w-8 h-11',
  variant = 'dark',
  animated = true,
}) => {
  return (
    <img
      src="/emblem-of-india.svg"
      alt="State Emblem of India"
      className={[
        className,
        'object-contain select-none shrink-0',
        variant === 'light' ? 'brightness-0 invert opacity-80' : 'opacity-90',
        animated && variant === 'dark'  ? 'animate-emblem-float animate-emblem-shimmer' : '',
        animated && variant === 'light' ? 'animate-emblem-float' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      loading="eager"
    />
  );
};
