'use client';

import React from 'react';

/**
 * BrandHeader — Shared branding component used across:
 * - Login screen
 * - PDF exports
 * - Email templates
 *
 * Logo: S-Pixel official logo
 * System: PixelManageAI (main) / PixelFrameAI (video)
 */

const LOGO_URL = 'https://s-pixel.co.il/wp-content/uploads/2025/12/rdgik.png';

export interface BrandHeaderProps {
  /** Show system name below logo */
  showName?: boolean;
  /** Which system name to show */
  system?: 'PixelManageAI' | 'PixelFrameAI';
  /** Logo height in px */
  logoHeight?: number;
  /** Variant for different contexts */
  variant?: 'default' | 'compact' | 'pdf' | 'email';
  /** Override logo URL */
  logoUrl?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

export default function BrandHeader({
  showName = true,
  system = 'PixelManageAI',
  logoHeight = 48,
  variant = 'default',
  logoUrl,
  style,
}: BrandHeaderProps) {
  const isCompact = variant === 'compact';
  const isPdf = variant === 'pdf';
  const isEmail = variant === 'email';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isCompact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isCompact ? '0.5rem' : '0.35rem',
        padding: isPdf || isEmail ? '1rem 0' : '0',
        ...style,
      }}
    >
      <img
        src={logoUrl || LOGO_URL}
        alt="Studio Pixel"
        style={{
          height: isPdf ? 36 : isEmail ? 40 : logoHeight,
          width: 'auto',
          objectFit: 'contain',
        }}
      />
      {showName && (
        <span
          style={{
            fontSize: isPdf ? '0.8rem' : isCompact ? '0.85rem' : '1rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: isPdf || isEmail ? '#333' : 'var(--foreground, #1a1a2e)',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
          }}
        >
          {system}
        </span>
      )}
    </div>
  );
}

/** Export logo URL for non-React contexts (PDF builder, email HTML) */
export const BRAND_LOGO_URL = LOGO_URL;
export const BRAND_SYSTEM_NAME = 'PixelManageAI';
export const BRAND_VIDEO_SYSTEM_NAME = 'PixelFrameAI';
export const BRAND_COMPANY = 'Studio Pixel';
export const BRAND_COMPANY_HE = 'סטודיו פיקסל';
