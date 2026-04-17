/**
 * UGCBrandedVideo — Premium Cinematic Branded Ad Composition
 *
 * Scene-based Remotion composition that transforms a HeyGen avatar video
 * into a fully branded marketing video with:
 * - Dynamic gradient backgrounds per scene
 * - Logo integration with reveal animation
 * - Product image focus scenes
 * - Branded text overlays with motion
 * - Scene transitions (fade, slide, zoom, blur)
 * - Visual effects (grain, vignette, color grading)
 * - CTA end card
 * - Platform-aware safe zones
 */
import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import type { UGCCompositionProps, SceneBeat, VisualStyleDef } from './ugc-types';
import { VISUAL_STYLES } from './ugc-types';

// ─── Helpers ────────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Scene Background ───────────────────────────────────────────────
const SceneBackground: React.FC<{
  style: VisualStyleDef;
  scene: SceneBeat;
  frame: number;
  fps: number;
}> = ({ style, scene, frame, fps }) => {
  const sceneFrame = frame;
  const drift = Math.sin(sceneFrame / (fps * 4)) * 2 * style.motionIntensity;
  const scalePulse = scene.motionPreset === 'pulse'
    ? 1 + Math.sin(sceneFrame / (fps * 1.5)) * 0.02
    : scene.motionPreset === 'slow-zoom'
      ? interpolate(sceneFrame, [0, fps * 8], [1, 1.08], { extrapolateRight: 'clamp' })
      : 1;

  const gradient = `linear-gradient(135deg, ${style.bgGradient.join(', ')})`;

  return (
    <AbsoluteFill
      style={{
        background: gradient,
        transform: `scale(${scalePulse}) translate(${drift}px, ${drift * 0.5}px)`,
      }}
    />
  );
};

// ─── Avatar Layer ───────────────────────────────────────────────────
const AvatarLayer: React.FC<{
  videoUrl: string;
  scene: SceneBeat;
  frame: number;
  fps: number;
  width: number;
  height: number;
  sceneDurationFrames: number;
}> = ({ videoUrl, scene, frame, fps, width, height, sceneDurationFrames }) => {
  if (scene.avatarScale <= 0 || !videoUrl) return null;

  const scale = scene.avatarScale;
  const positionStyles: React.CSSProperties = {};
  const containerW = width * scale;
  const containerH = height * scale;

  switch (scene.avatarPosition) {
    case 'center':
      positionStyles.left = (width - containerW) / 2;
      positionStyles.top = (height - containerH) / 2;
      break;
    case 'left':
      positionStyles.left = width * 0.02;
      positionStyles.top = (height - containerH) / 2;
      break;
    case 'right':
      positionStyles.right = width * 0.02;
      positionStyles.top = (height - containerH) / 2;
      break;
    case 'bottom-left':
      positionStyles.left = width * 0.04;
      positionStyles.bottom = height * 0.08;
      break;
    case 'bottom-right':
      positionStyles.right = width * 0.04;
      positionStyles.bottom = height * 0.08;
      break;
  }

  // Entrance fade
  const opacity = interpolate(frame, [0, Math.min(fps * 0.5, sceneDurationFrames)], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtle float for motion presets
  const floatY = scene.motionPreset === 'drift'
    ? Math.sin(frame / (fps * 2)) * 4
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        width: containerW,
        height: containerH,
        ...positionStyles,
        opacity,
        transform: `translateY(${floatY}px)`,
        borderRadius: scale < 0.8 ? 20 : 0,
        overflow: 'hidden',
        boxShadow: scale < 0.9 ? '0 20px 60px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      <OffthreadVideo
        src={videoUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
};

// ─── Logo Layer ─────────────────────────────────────────────────────
const LogoLayer: React.FC<{
  logoUrl: string;
  scene: SceneBeat;
  frame: number;
  fps: number;
  width: number;
  accentColor: string;
}> = ({ logoUrl, scene, frame, fps, width, accentColor }) => {
  if (!scene.showLogo || !logoUrl) return null;

  const logoSize = width * 0.15;
  const spr = spring({ frame, fps, config: { damping: 15, mass: 0.8 } });
  const scale = interpolate(spr, [0, 1], [0.5, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 40,
        right: 40,
        width: logoSize,
        height: logoSize,
        opacity,
        transform: `scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <Img
        src={logoUrl}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          filter: `drop-shadow(0 4px 12px ${hexToRgba(accentColor, 0.3)})`,
        }}
      />
    </div>
  );
};

// ─── Product Image Layer ────────────────────────────────────────────
const ProductLayer: React.FC<{
  productImageUrl: string;
  scene: SceneBeat;
  frame: number;
  fps: number;
  width: number;
  height: number;
  accentColor: string;
}> = ({ productImageUrl, scene, frame, fps, width, height, accentColor }) => {
  if (!scene.showProduct || !productImageUrl) return null;

  const isProductFocus = scene.type === 'product_focus';
  const size = isProductFocus ? width * 0.55 : width * 0.35;

  const spr = spring({ frame, fps, config: { damping: 12, mass: 1.0 } });
  const scale = interpolate(spr, [0, 1], [0.7, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  // Floating animation
  const floatY = Math.sin(frame / (fps * 2.5)) * 6;
  const rotate = Math.sin(frame / (fps * 4)) * 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: (width - size) / 2,
        top: isProductFocus ? (height - size) * 0.35 : height * 0.15,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale}) translateY(${floatY}px) rotate(${rotate}deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 8,
      }}
    >
      <Img
        src={productImageUrl}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          filter: `drop-shadow(0 20px 40px rgba(0,0,0,0.4))`,
          borderRadius: 16,
        }}
      />
      {/* Glow ring behind product */}
      <div
        style={{
          position: 'absolute',
          inset: -20,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${hexToRgba(accentColor, 0.15)} 0%, transparent 70%)`,
          zIndex: -1,
        }}
      />
    </div>
  );
};

// ─── Text Overlay Layer ─────────────────────────────────────────────
const TextOverlay: React.FC<{
  scene: SceneBeat;
  frame: number;
  fps: number;
  width: number;
  height: number;
  style: VisualStyleDef;
  sceneDurationFrames: number;
}> = ({ scene, frame, fps, width, height, style: vs, sceneDurationFrames }) => {
  if (!scene.overlay) return null;

  const spr = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const slideX = interpolate(spr, [0, 1], [60, 0]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  // Fade out at scene end
  const fadeOut = interpolate(
    frame,
    [sceneDurationFrames - fps * 0.5, sceneDurationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const fontSize = width * 0.055;
  const isBottom = scene.avatarScale > 0.6;
  const yPos = isBottom ? height * 0.78 : height * 0.45;

  return (
    <div
      style={{
        position: 'absolute',
        top: yPos,
        right: 40,
        left: 40,
        opacity: opacity * fadeOut,
        transform: `translateX(${slideX}px)`,
        textAlign: 'right',
        direction: 'rtl',
        zIndex: 12,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          borderRadius: 12,
          background: hexToRgba(vs.bgGradient[0], vs.overlayOpacity * 1.2),
          backdropFilter: 'blur(12px)',
          borderRight: `3px solid ${vs.accentColor}`,
        }}
      >
        <span
          style={{
            fontFamily: vs.fontFamily,
            fontWeight: 700,
            fontSize,
            color: vs.textColor,
            lineHeight: 1.3,
            textShadow: `0 2px 8px rgba(0,0,0,0.3)`,
          }}
        >
          {scene.overlay}
        </span>
      </div>
    </div>
  );
};

// ─── CTA End Card ───────────────────────────────────────────────────
const CTACard: React.FC<{
  text: string;
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  frame: number;
  fps: number;
  width: number;
  height: number;
  style: VisualStyleDef;
  sceneDurationFrames: number;
}> = ({ text, brandName, tagline, logoUrl, frame, fps, width, height, style: vs, sceneDurationFrames }) => {
  if (!text && !brandName) return null;

  const spr = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const scale = interpolate(spr, [0, 1], [0.8, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `scale(${scale})`,
        direction: 'rtl',
        zIndex: 20,
      }}
    >
      {logoUrl && (
        <Img
          src={logoUrl}
          style={{
            width: width * 0.25,
            height: width * 0.25,
            objectFit: 'contain',
            marginBottom: 30,
          }}
        />
      )}
      {brandName && (
        <div
          style={{
            fontFamily: vs.fontFamily,
            fontWeight: 800,
            fontSize: width * 0.08,
            color: vs.textColor,
            textAlign: 'center',
            marginBottom: 16,
            textShadow: `0 4px 16px rgba(0,0,0,0.3)`,
          }}
        >
          {brandName}
        </div>
      )}
      {tagline && (
        <div
          style={{
            fontFamily: vs.fontFamily,
            fontWeight: 400,
            fontSize: width * 0.04,
            color: hexToRgba(vs.textColor, 0.7),
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          {tagline}
        </div>
      )}
      {text && (
        <div
          style={{
            padding: '18px 48px',
            borderRadius: 60,
            background: vs.accentColor,
            boxShadow: `0 8px 32px ${hexToRgba(vs.accentColor, 0.4)}`,
          }}
        >
          <span
            style={{
              fontFamily: vs.fontFamily,
              fontWeight: 700,
              fontSize: width * 0.045,
              color: vs.bgGradient[0],
            }}
          >
            {text}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ─── Visual Effects Overlay ─────────────────────────────────────────
const VisualEffects: React.FC<{
  style: VisualStyleDef;
  frame: number;
  fps: number;
}> = ({ style, frame, fps }) => {
  return (
    <>
      {/* Vignette */}
      {style.vignette && (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}
      {/* Film grain */}
      {style.filmGrain && (
        <AbsoluteFill
          style={{
            opacity: 0.04,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${Math.floor(frame * 0.5)}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
            pointerEvents: 'none',
            zIndex: 51,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {/* Color grading tint */}
      {style.colorGrading !== 'neutral' && (
        <AbsoluteFill
          style={{
            background:
              style.colorGrading === 'warm'
                ? 'rgba(255, 180, 100, 0.06)'
                : style.colorGrading === 'cool'
                  ? 'rgba(100, 150, 255, 0.06)'
                  : style.colorGrading === 'vivid'
                    ? 'rgba(255, 100, 200, 0.04)'
                    : 'rgba(50, 50, 100, 0.08)', // moody
            pointerEvents: 'none',
            zIndex: 52,
            mixBlendMode: 'overlay',
          }}
        />
      )}
    </>
  );
};

// ─── Scene Transition Wrapper ───────────────────────────────────────
const SceneTransition: React.FC<{
  transition: SceneBeat['transition'];
  frame: number;
  fps: number;
  durationFrames: number;
  children: React.ReactNode;
}> = ({ transition, frame, fps, durationFrames, children }) => {
  const transFrames = Math.min(fps * 0.5, durationFrames * 0.3);

  // Entry
  let entryOpacity = 1;
  let entryTransform = '';

  if (transition === 'fade') {
    entryOpacity = interpolate(frame, [0, transFrames], [0, 1], { extrapolateRight: 'clamp' });
  } else if (transition === 'slide') {
    const slideX = interpolate(frame, [0, transFrames], [-100, 0], { extrapolateRight: 'clamp' });
    entryOpacity = interpolate(frame, [0, transFrames * 0.5], [0, 1], { extrapolateRight: 'clamp' });
    entryTransform = `translateX(${slideX}%)`;
  } else if (transition === 'zoom') {
    const scale = interpolate(frame, [0, transFrames], [1.15, 1], { extrapolateRight: 'clamp' });
    entryOpacity = interpolate(frame, [0, transFrames * 0.5], [0, 1], { extrapolateRight: 'clamp' });
    entryTransform = `scale(${scale})`;
  } else if (transition === 'blur') {
    entryOpacity = interpolate(frame, [0, transFrames], [0, 1], { extrapolateRight: 'clamp' });
  }

  return (
    <AbsoluteFill
      style={{
        opacity: entryOpacity,
        transform: entryTransform || undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ─── Main Composition ───────────────────────────────────────────────
export const UGCBrandedVideo: React.FC<UGCCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const vs = VISUAL_STYLES[props.visualStyle] || VISUAL_STYLES['cinematic-dark'];

  // If no scenes defined, render the full avatar video with branding
  const scenes: SceneBeat[] =
    props.scenes.length > 0
      ? props.scenes
      : [
          {
            id: 'full',
            type: 'hook',
            startSec: 0,
            endSec: props.durationSec,
            text: '',
            showLogo: true,
            showProduct: false,
            bgIntensity: 0.3,
            avatarScale: 0.85,
            avatarPosition: 'center',
            transition: 'fade',
            motionPreset: 'slow-zoom',
          },
        ];

  return (
    <AbsoluteFill style={{ background: vs.bgGradient[0] }}>
      {scenes.map((scene, i) => {
        const startFrame = Math.round(scene.startSec * fps);
        const endFrame = Math.round(scene.endSec * fps);
        const durationFrames = endFrame - startFrame;
        if (durationFrames <= 0) return null;

        const isCTA = scene.type === 'cta';

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames}>
            <SceneTransition
              transition={scene.transition}
              frame={frame - startFrame}
              fps={fps}
              durationFrames={durationFrames}
            >
              {/* Background */}
              <SceneBackground
                style={vs}
                scene={scene}
                frame={frame - startFrame}
                fps={fps}
              />

              {/* Avatar video */}
              {!isCTA && (
                <AvatarLayer
                  videoUrl={props.avatarVideoUrl}
                  scene={scene}
                  frame={frame - startFrame}
                  fps={fps}
                  width={width}
                  height={height}
                  sceneDurationFrames={durationFrames}
                />
              )}

              {/* Product image */}
              {props.productImageUrl && (
                <ProductLayer
                  productImageUrl={props.productImageUrl}
                  scene={scene}
                  frame={frame - startFrame}
                  fps={fps}
                  width={width}
                  height={height}
                  accentColor={vs.accentColor}
                />
              )}

              {/* Logo */}
              {props.logoUrl && (
                <LogoLayer
                  logoUrl={props.logoUrl}
                  scene={scene}
                  frame={frame - startFrame}
                  fps={fps}
                  width={width}
                  accentColor={vs.accentColor}
                />
              )}

              {/* Text overlay */}
              <TextOverlay
                scene={scene}
                frame={frame - startFrame}
                fps={fps}
                width={width}
                height={height}
                style={vs}
                sceneDurationFrames={durationFrames}
              />

              {/* CTA end card */}
              {isCTA && (
                <CTACard
                  text={props.ctaText}
                  brandName={props.brandName}
                  tagline={props.tagline}
                  logoUrl={props.logoUrl}
                  frame={frame - startFrame}
                  fps={fps}
                  width={width}
                  height={height}
                  style={vs}
                  sceneDurationFrames={durationFrames}
                />
              )}
            </SceneTransition>
          </Sequence>
        );
      })}

      {/* Global visual effects on top */}
      <VisualEffects style={vs} frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};
