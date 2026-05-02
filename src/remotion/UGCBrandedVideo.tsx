/**
 * UGCBrandedVideo — Premium Cinematic Branded Ad Composition
 *
 * STRICT 5-SCENE STRUCTURE:
 *   Scene 1 — HOOK:              Bold zoom entry, pulsing motion, large avatar, hook text
 *   Scene 2 — PROBLEM/RELATE:    Slide transition, slow zoom, right-positioned avatar, pain text
 *   Scene 3 — SOLUTION INTRO:    Blur reveal, drifting motion, left avatar, logo appears, product enters
 *   Scene 4 — PRODUCT HIGHLIGHT: Zoom in, parallax motion, small avatar corner, product hero, benefits
 *   Scene 5 — CTA:               Fade to end card, no avatar, logo lockup, CTA button
 *
 * Each scene has:
 *   - Unique gradient angle (135° → 225° → 45° → 315° → 180°) to break monotony
 *   - Unique motion preset (pulse → slow-zoom → drift → parallax → static)
 *   - Unique avatar position (center → right → left → bottom-right → hidden)
 *   - Unique transition (zoom → slide → blur → zoom → fade)
 *   - Dynamic text overlays with scene-specific styling
 *   - Product/logo integration enforced on correct scenes
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
import { VISUAL_STYLES, buildEnforcedScenes } from './ugc-types';

// ─── Helpers ────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Scene Background (Per-Scene Gradient + Motion) ─────────────────
const SceneBackground: React.FC<{
  style: VisualStyleDef;
  scene: SceneBeat;
  sceneIndex: number;
  frame: number;
  fps: number;
  width: number;
  height: number;
}> = ({ style, scene, sceneIndex, frame, fps, width, height }) => {
  const angle = scene.bgGradientAngle ?? (135 + sceneIndex * 72) % 360;

  // Per-scene gradient variation — shift hue slightly per scene for visual difference
  const hueShift = sceneIndex * 8;
  const gradient = `linear-gradient(${angle}deg, ${style.bgGradient.join(', ')})`;

  // Motion per scene type
  let transform = '';
  const t = frame / fps; // seconds into scene

  if (scene.motionPreset === 'pulse') {
    // Hook: aggressive pulsing zoom
    const pulse = 1 + Math.sin(t * 4) * 0.025 * style.motionIntensity;
    transform = `scale(${pulse})`;
  } else if (scene.motionPreset === 'slow-zoom') {
    // Problem: steady zoom in
    const zoom = interpolate(frame, [0, fps * 20], [1, 1.12], { extrapolateRight: 'clamp' });
    transform = `scale(${zoom})`;
  } else if (scene.motionPreset === 'drift') {
    // Solution: gentle drifting pan
    const driftX = Math.sin(t * 0.8) * 8 * style.motionIntensity;
    const driftY = Math.cos(t * 0.6) * 5 * style.motionIntensity;
    transform = `translate(${driftX}px, ${driftY}px) scale(1.03)`;
  } else if (scene.motionPreset === 'parallax') {
    // Product highlight: parallax depth effect
    const px = Math.sin(t * 0.5) * 12 * style.motionIntensity;
    const py = Math.cos(t * 0.4) * 8 * style.motionIntensity;
    const pz = interpolate(frame, [0, fps * 10], [1, 1.06], { extrapolateRight: 'clamp' });
    transform = `translate(${px}px, ${py}px) scale(${pz})`;
  } else if (scene.motionPreset === 'zoom-out') {
    const zoom = interpolate(frame, [0, fps * 10], [1.15, 1], { extrapolateRight: 'clamp' });
    transform = `scale(${zoom})`;
  } else if (scene.motionPreset === 'shake') {
    const shakeX = Math.sin(t * 12) * 3 * style.motionIntensity;
    const shakeY = Math.cos(t * 14) * 2 * style.motionIntensity;
    transform = `translate(${shakeX}px, ${shakeY}px)`;
  }
  // 'static' = no transform

  // Animated accent stripe per scene for visual layering
  const stripeOpacity = interpolate(frame, [0, fps * 0.8], [0, 0.08], { extrapolateRight: 'clamp' });
  const stripeAngle = (angle + 90) % 360;

  return (
    <>
      <AbsoluteFill
        style={{
          background: gradient,
          transform,
        }}
      />
      {/* Accent stripe overlay for visual layering */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(${stripeAngle}deg, transparent 40%, ${hexToRgba(style.accentColor, stripeOpacity)} 50%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      {/* Scene-specific ambient glow */}
      {scene.type === 'hook' && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%, ${hexToRgba(style.accentColor, 0.08)} 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
      )}
      {scene.type === 'product_highlight' && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 35%, ${hexToRgba(style.accentColor, 0.12)} 0%, transparent 50%)`,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
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
  const containerW = width * scale;
  const containerH = height * scale;
  const positionStyles: React.CSSProperties = {};

  switch (scene.avatarPosition) {
    case 'center':
      positionStyles.left = (width - containerW) / 2;
      positionStyles.top = (height - containerH) / 2;
      break;
    case 'left':
      positionStyles.left = width * 0.03;
      positionStyles.top = (height - containerH) / 2;
      break;
    case 'right':
      positionStyles.right = width * 0.03;
      positionStyles.top = (height - containerH) / 2;
      break;
    case 'bottom-left':
      positionStyles.left = width * 0.04;
      positionStyles.bottom = height * 0.06;
      break;
    case 'bottom-right':
      positionStyles.right = width * 0.04;
      positionStyles.bottom = height * 0.06;
      break;
  }

  // Entrance animation
  const spr = spring({ frame, fps, config: { damping: 14, mass: 0.7 } });
  const opacity = interpolate(spr, [0, 1], [0, 1]);
  const entranceScale = interpolate(spr, [0, 1], [0.92, 1]);

  // Per-scene avatar motion
  let avatarMotion = '';
  const t = frame / fps;
  if (scene.motionPreset === 'drift') {
    avatarMotion = `translateY(${Math.sin(t * 1.2) * 5}px)`;
  } else if (scene.motionPreset === 'pulse') {
    avatarMotion = `scale(${1 + Math.sin(t * 3) * 0.01})`;
  } else if (scene.motionPreset === 'parallax') {
    avatarMotion = `translate(${Math.sin(t * 0.6) * 4}px, ${Math.cos(t * 0.4) * 3}px)`;
  }

  // Exit fade near scene end
  const exitOpacity = interpolate(
    frame,
    [sceneDurationFrames - fps * 0.4, sceneDurationFrames],
    [1, 0.3],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'absolute',
        width: containerW,
        height: containerH,
        ...positionStyles,
        opacity: opacity * exitOpacity,
        transform: `scale(${entranceScale}) ${avatarMotion}`,
        borderRadius: scale < 0.8 ? 24 : 0,
        overflow: 'hidden',
        boxShadow: scale < 0.9
          ? '0 16px 48px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.3)'
          : 'none',
        zIndex: 5,
      }}
    >
      <OffthreadVideo
        src={videoUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {/* Soft border glow for smaller avatars */}
      {scale < 0.8 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 24,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
            pointerEvents: 'none',
          }}
        />
      )}
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
  height: number;
  accentColor: string;
}> = ({ logoUrl, scene, frame, fps, width, height, accentColor }) => {
  if (!scene.showLogo || !logoUrl) return null;

  const isCTA = scene.type === 'cta';
  const logoSize = isCTA ? width * 0.28 : width * 0.13;

  const spr = spring({ frame, fps, config: { damping: 15, mass: 0.8 } });
  const scale = interpolate(spr, [0, 1], [0.4, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  // CTA: centered. Others: top-right corner
  const posStyle: React.CSSProperties = isCTA
    ? { left: (width - logoSize) / 2, top: height * 0.22 }
    : { right: 36, top: 36 };

  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
        width: logoSize,
        height: logoSize,
        opacity,
        transform: `scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 15,
      }}
    >
      <Img
        src={logoUrl}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          filter: `drop-shadow(0 6px 20px ${hexToRgba(accentColor, 0.35)})`,
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

  const isHero = scene.type === 'product_highlight';
  const size = isHero ? width * 0.55 : width * 0.35;

  const spr = spring({ frame, fps, config: { damping: 11, mass: 1.0 } });
  const scale = interpolate(spr, [0, 1], [0.6, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  // Floating + slight rotation
  const t = frame / fps;
  const floatY = Math.sin(t * 1.5) * 8;
  const rotate = Math.sin(t * 0.8) * (isHero ? 3 : 1.5);

  // Hero: centered. Solution: side position
  const posStyle: React.CSSProperties = isHero
    ? { left: (width - size) / 2, top: (height - size) * 0.32 }
    : { left: width * 0.55, top: height * 0.12 };

  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
        width: size,
        height: size,
        opacity,
        transform: `scale(${scale}) translateY(${floatY}px) rotate(${rotate}deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: isHero ? 10 : 7,
      }}
    >
      {/* Glow ring behind product */}
      <div
        style={{
          position: 'absolute',
          inset: isHero ? -30 : -15,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${hexToRgba(accentColor, isHero ? 0.2 : 0.1)} 0%, transparent 70%)`,
          zIndex: -1,
        }}
      />
      <Img
        src={productImageUrl}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          filter: `drop-shadow(0 20px 40px rgba(0,0,0,0.45))`,
          borderRadius: 16,
        }}
      />
      {/* Highlight shimmer for hero */}
      {isHero && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 16,
            background: `linear-gradient(135deg, transparent 40%, ${hexToRgba('#ffffff', 0.08)} 50%, transparent 60%)`,
            backgroundSize: '200% 200%',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

// ─── Text Overlay Layer (Per-Scene Styling) ─────────────────────────
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

  const spr = spring({ frame, fps, config: { damping: 12, mass: 0.5 } });

  // Per-scene entrance animation
  let slideX = 0;
  let slideY = 0;
  let scaleIn = 1;

  if (scene.type === 'hook') {
    // Hook: scale up from center, bold
    scaleIn = interpolate(spr, [0, 1], [0.6, 1]);
    slideY = interpolate(spr, [0, 1], [30, 0]);
  } else if (scene.type === 'problem') {
    // Problem: slide from right (RTL)
    slideX = interpolate(spr, [0, 1], [80, 0]);
  } else if (scene.type === 'solution') {
    // Solution: slide from left
    slideX = interpolate(spr, [0, 1], [-80, 0]);
  } else if (scene.type === 'product_highlight') {
    // Product: fade up
    slideY = interpolate(spr, [0, 1], [40, 0]);
  }
  // CTA overlay is handled by CTACard

  const opacity = interpolate(spr, [0, 1], [0, 1]);
  const fadeOut = interpolate(
    frame,
    [sceneDurationFrames - fps * 0.4, sceneDurationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Per-scene text size
  const fontSizeMap: Record<string, number> = {
    hook: width * 0.07,            // Largest — attention grab
    problem: width * 0.05,
    solution: width * 0.05,
    product_highlight: width * 0.048,
    cta: width * 0.055,
  };
  const fontSize = fontSizeMap[scene.type] || width * 0.05;

  // Per-scene Y position
  const yPosMap: Record<string, number> = {
    hook: height * 0.72,           // Bottom area for hook
    problem: height * 0.75,
    solution: height * 0.78,
    product_highlight: height * 0.68,  // Higher — room for product below avatar
    cta: height * 0.55,
  };
  const yPos = yPosMap[scene.type] || height * 0.75;

  // Hook gets special bold styling
  const isHook = scene.type === 'hook';

  return (
    <div
      style={{
        position: 'absolute',
        top: yPos,
        right: 32,
        left: 32,
        opacity: opacity * fadeOut,
        transform: `translateX(${slideX}px) translateY(${slideY}px) scale(${scaleIn})`,
        textAlign: 'center',
        direction: 'rtl',
        zIndex: 12,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          padding: isHook ? '16px 32px' : '10px 22px',
          borderRadius: isHook ? 16 : 10,
          background: hexToRgba(vs.bgGradient[0], isHook ? vs.overlayOpacity * 1.4 : vs.overlayOpacity),
          backdropFilter: 'blur(14px)',
          borderRight: isHook ? `4px solid ${vs.accentColor}` : `3px solid ${hexToRgba(vs.accentColor, 0.6)}`,
          borderLeft: isHook ? `4px solid ${vs.accentColor}` : 'none',
          boxShadow: isHook ? `0 8px 32px ${hexToRgba(vs.accentColor, 0.2)}` : 'none',
        }}
      >
        <span
          style={{
            fontFamily: vs.fontFamily,
            fontWeight: isHook ? 900 : 700,
            fontSize,
            color: vs.textColor,
            lineHeight: 1.3,
            textShadow: isHook
              ? `0 4px 16px rgba(0,0,0,0.5), 0 0 40px ${hexToRgba(vs.accentColor, 0.3)}`
              : '0 2px 8px rgba(0,0,0,0.3)',
            letterSpacing: isHook ? '0.02em' : 'normal',
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
  ctaText: string;
  brandName: string;
  tagline: string;
  overlay: string;
  logoUrl: string | null;
  frame: number;
  fps: number;
  width: number;
  height: number;
  style: VisualStyleDef;
}> = ({ ctaText, brandName, tagline, overlay, logoUrl, frame, fps, width, height, style: vs }) => {
  const spr = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const scale = interpolate(spr, [0, 1], [0.75, 1]);
  const opacity = interpolate(spr, [0, 1], [0, 1]);

  // Pulse glow on CTA button
  const t = frame / fps;
  const glowPulse = 0.3 + Math.sin(t * 3) * 0.15;

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
      {/* Logo lockup */}
      {logoUrl && (
        <Img
          src={logoUrl}
          style={{
            width: width * 0.28,
            height: width * 0.28,
            objectFit: 'contain',
            marginBottom: 28,
            filter: `drop-shadow(0 8px 24px ${hexToRgba(vs.accentColor, 0.3)})`,
          }}
        />
      )}
      {/* Brand name */}
      {brandName && (
        <div
          style={{
            fontFamily: vs.fontFamily,
            fontWeight: 900,
            fontSize: width * 0.085,
            color: vs.textColor,
            textAlign: 'center',
            marginBottom: 12,
            textShadow: `0 4px 20px rgba(0,0,0,0.4)`,
            letterSpacing: '0.01em',
          }}
        >
          {brandName}
        </div>
      )}
      {/* Tagline */}
      {tagline && (
        <div
          style={{
            fontFamily: vs.fontFamily,
            fontWeight: 400,
            fontSize: width * 0.038,
            color: hexToRgba(vs.textColor, 0.65),
            textAlign: 'center',
            marginBottom: 36,
          }}
        >
          {tagline}
        </div>
      )}
      {/* CTA button */}
      {(ctaText || overlay) && (
        <div
          style={{
            padding: '20px 56px',
            borderRadius: 60,
            background: vs.accentColor,
            boxShadow: `0 8px 32px ${hexToRgba(vs.accentColor, glowPulse)}, 0 0 60px ${hexToRgba(vs.accentColor, glowPulse * 0.5)}`,
          }}
        >
          <span
            style={{
              fontFamily: vs.fontFamily,
              fontWeight: 800,
              fontSize: width * 0.048,
              color: vs.bgGradient[0],
              letterSpacing: '0.01em',
            }}
          >
            {ctaText || overlay}
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
}> = ({ style, frame }) => {
  return (
    <>
      {style.vignette && (
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}
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
      {style.colorGrading !== 'neutral' && (
        <AbsoluteFill
          style={{
            background:
              style.colorGrading === 'warm' ? 'rgba(255,180,100,0.06)'
              : style.colorGrading === 'cool' ? 'rgba(100,150,255,0.06)'
              : style.colorGrading === 'vivid' ? 'rgba(255,100,200,0.04)'
              : 'rgba(50,50,100,0.08)',
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
  const transFrames = Math.min(fps * 0.5, durationFrames * 0.25);

  let entryOpacity = 1;
  let entryTransform = '';

  if (transition === 'fade') {
    entryOpacity = interpolate(frame, [0, transFrames], [0, 1], { extrapolateRight: 'clamp' });
  } else if (transition === 'slide') {
    const slideX = interpolate(frame, [0, transFrames], [-100, 0], { extrapolateRight: 'clamp' });
    entryOpacity = interpolate(frame, [0, transFrames * 0.5], [0, 1], { extrapolateRight: 'clamp' });
    entryTransform = `translateX(${slideX}%)`;
  } else if (transition === 'zoom') {
    const scale = interpolate(frame, [0, transFrames], [1.2, 1], { extrapolateRight: 'clamp' });
    entryOpacity = interpolate(frame, [0, transFrames * 0.6], [0, 1], { extrapolateRight: 'clamp' });
    entryTransform = `scale(${scale})`;
  } else if (transition === 'blur') {
    entryOpacity = interpolate(frame, [0, transFrames], [0, 1], { extrapolateRight: 'clamp' });
  }
  // 'cut' = instant, no animation

  return (
    <AbsoluteFill style={{ opacity: entryOpacity, transform: entryTransform || undefined }}>
      {children}
    </AbsoluteFill>
  );
};

// ─── Main Composition ───────────────────────────────────────────────
export const UGCBrandedVideo: React.FC<UGCCompositionProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const vs = VISUAL_STYLES[props.visualStyle] || VISUAL_STYLES['cinematic-dark'];

  // ENFORCE: If no scenes or wrong count, build the mandatory 5-scene structure
  const scenes: SceneBeat[] =
    props.scenes.length === 5
      ? props.scenes
      : buildEnforcedScenes(
          props.durationSec,
          !!props.logoUrl,
          !!props.productImageUrl,
        );

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
              {/* Background — unique gradient angle + motion per scene */}
              <SceneBackground
                style={vs}
                scene={scene}
                sceneIndex={i}
                frame={frame - startFrame}
                fps={fps}
                width={width}
                height={height}
              />

              {/* Avatar video — hidden in CTA */}
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

              {/* Product image — enforced in solution + product_highlight */}
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

              {/* Logo — enforced in solution (subtle) + CTA (strong lockup) */}
              {props.logoUrl && (
                <LogoLayer
                  logoUrl={props.logoUrl}
                  scene={scene}
                  frame={frame - startFrame}
                  fps={fps}
                  width={width}
                  height={height}
                  accentColor={vs.accentColor}
                />
              )}

              {/* Text overlay — per-scene styled */}
              {!isCTA && (
                <TextOverlay
                  scene={scene}
                  frame={frame - startFrame}
                  fps={fps}
                  width={width}
                  height={height}
                  style={vs}
                  sceneDurationFrames={durationFrames}
                />
              )}

              {/* CTA end card — replaces overlay + avatar */}
              {isCTA && (
                <CTACard
                  ctaText={props.ctaText}
                  brandName={props.brandName}
                  tagline={props.tagline}
                  overlay={scene.overlay || ''}
                  logoUrl={props.logoUrl}
                  frame={frame - startFrame}
                  fps={fps}
                  width={width}
                  height={height}
                  style={vs}
                />
              )}
            </SceneTransition>
          </Sequence>
        );
      })}

      {/* Global visual effects */}
      <VisualEffects style={vs} frame={frame} />
    </AbsoluteFill>
  );
};
