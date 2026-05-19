import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Img,
  Video,
  interpolate,
  spring,
} from 'remotion';

// ── Props ────────────────────────────────────────────────────────────
export interface PodcastClipProps {
  sourceVideoUrl: string;
  startTime: number; // seconds
  endTime: number; // seconds
  subtitles: Array<{ text: string; start: number; end: number }>;
  viralStyle: string; // style preset id
  brandColors: { primary: string; secondary: string; accent: string } | null;
  hookText: string | null;
  logoUrl: string | null;
  outputFormat: '16:9' | '9:16' | '1:1' | '4:5';
}

// ── Helpers ──────────────────────────────────────────────────────────

const ASPECT_RATIOS: Record<PodcastClipProps['outputFormat'], { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

function getSubtitleFontSize(format: PodcastClipProps['outputFormat']): number {
  if (format === '9:16' || format === '4:5') return 48;
  return 42;
}

// ── Subtitle overlay ─────────────────────────────────────────────────
function SubtitleOverlay({
  text,
  brandColors,
  format,
}: {
  text: string;
  brandColors: PodcastClipProps['brandColors'];
  format: PodcastClipProps['outputFormat'];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const bg = brandColors?.primary ?? 'rgba(0, 0, 0, 0.75)';
  const fg = brandColors?.accent ?? '#FFFFFF';

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: format === '9:16' ? 220 : 80,
      }}
    >
      <div
        style={{
          opacity,
          backgroundColor: bg,
          color: fg,
          padding: '12px 28px',
          borderRadius: 12,
          fontSize: getSubtitleFontSize(format),
          fontFamily: 'Inter, Arial, sans-serif',
          fontWeight: 700,
          maxWidth: '85%',
          textAlign: 'center',
          lineHeight: 1.35,
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

// ── Hook text overlay (first 3 seconds) ──────────────────────────────
function HookOverlay({
  text,
  brandColors,
}: {
  text: string;
  brandColors: PodcastClipProps['brandColors'];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, from: 0.6, to: 1, durationInFrames: 15 });
  const opacity = interpolate(frame, [0, 8, fps * 2.5, fps * 3], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  const accent = brandColors?.accent ?? '#FFD700';

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          color: accent,
          fontSize: 64,
          fontFamily: 'Inter, Arial, sans-serif',
          fontWeight: 900,
          textAlign: 'center',
          maxWidth: '80%',
          textShadow: '0 4px 20px rgba(0,0,0,0.7)',
          lineHeight: 1.2,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

// ── Logo watermark ───────────────────────────────────────────────────
function LogoWatermark({ logoUrl }: { logoUrl: string }) {
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end' }}>
      <Img
        src={logoUrl}
        style={{
          width: 80,
          height: 80,
          objectFit: 'contain',
          margin: 24,
          opacity: 0.85,
        }}
      />
    </AbsoluteFill>
  );
}

// ── Main composition ─────────────────────────────────────────────────
const PodcastClipComposition: React.FC<PodcastClipProps> = ({
  sourceVideoUrl,
  startTime,
  endTime,
  subtitles,
  viralStyle,
  brandColors,
  hookText,
  logoUrl,
  outputFormat,
}) => {
  const { fps } = useVideoConfig();
  const clipDuration = endTime - startTime;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background video */}
      <Video
        src={sourceVideoUrl}
        startFrom={Math.round(startTime * fps)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Hook text in first 3 seconds */}
      {hookText && (
        <Sequence from={0} durationInFrames={Math.round(3 * fps)}>
          <HookOverlay text={hookText} brandColors={brandColors} />
        </Sequence>
      )}

      {/* Subtitles */}
      {subtitles.map((sub, i) => {
        const fromFrame = Math.round((sub.start - startTime) * fps);
        const dur = Math.round((sub.end - sub.start) * fps);
        if (fromFrame < 0 || dur <= 0) return null;
        return (
          <Sequence key={i} from={fromFrame} durationInFrames={dur}>
            <SubtitleOverlay
              text={sub.text}
              brandColors={brandColors}
              format={outputFormat}
            />
          </Sequence>
        );
      })}

      {/* Logo watermark */}
      {logoUrl && <LogoWatermark logoUrl={logoUrl} />}
    </AbsoluteFill>
  );
};

export default PodcastClipComposition;
