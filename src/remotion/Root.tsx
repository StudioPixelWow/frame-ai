/**
 * PixelFrameAI — Remotion Root
 * Registers the main composition with dynamic metadata.
 */
import React from "react";
import { Composition } from "remotion";
import { PixelFrameEdit } from "./PixelFrameEdit";
import { UGCBrandedVideo } from "./UGCBrandedVideo";
import type { CompositionProps } from "./types";
import { FPS, FORMAT_DIMENSIONS } from "./types";
import { defaultUGCProps } from "./ugc-types";
import type { UGCCompositionProps } from "./ugc-types";

const defaultProps: CompositionProps = {
  videoUrl: "",
  trimStart: 0,
  trimEnd: 0,
  format: "9:16",
  segments: [
    { id: "s1", startSec: 0, endSec: 3, text: "שלום לכולם, ברוכים הבאים", highlightWord: "", highlightStyle: "color" },
    { id: "s2", startSec: 3, endSec: 6, text: "היום נדבר על עריכת וידאו", highlightWord: "עריכת", highlightStyle: "color" },
    { id: "s3", startSec: 6, endSec: 9, text: "עם מערכת AI חכמה", highlightWord: "AI", highlightStyle: "scale" },
    { id: "s4", startSec: 9, endSec: 12, text: "תודה שצפיתם, עקבו!", highlightWord: "עקבו", highlightStyle: "color" },
  ],
  subtitleStyle: {
    font: "Assistant",
    fontWeight: 600,
    fontSize: 42,
    color: "#FFFFFF",
    highlightColor: "#FFD700",
    outlineEnabled: false,
    outlineColor: "#000000",
    outlineThickness: 2,
    shadow: true,
    bgEnabled: true,
    bgColor: "#000000",
    bgOpacity: 60,
    align: "center",
    position: "bottom",
    animation: "fade",
    lineBreak: "auto",
  },
  brollPlacements: [],
  transition: { style: "fade", durationMs: 500 },
  music: {
    enabled: false,
    trackUrl: "",
    volume: 30,
    ducking: true,
    duckingLevel: 40,
    fadeInSec: 1.5,
    fadeOutSec: 2.0,
  },
  cleanupCuts: [],
  visual: {
    colorGrading: "neutral",
    zoomEnabled: false,
    zoomOnSpeech: 1.05,
    zoomOnTransition: 1.1,
    cropForVertical: true,
  },
  premium: {
    enabled: true,
    level: "premium",
    motionEffects: true,
    colorCorrection: true,
  },
  durationSec: 12,
  presetId: "viral",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PixelFrameEdit"
        component={PixelFrameEdit as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={FPS * 15}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={defaultProps as unknown as Record<string, unknown>}
        calculateMetadata={async ({ props }) => {
          const p = props as unknown as CompositionProps;
          const dims = FORMAT_DIMENSIONS[p.format] || FORMAT_DIMENSIONS["9:16"];
          const totalDur = p.durationSec || 15;
          return {
            durationInFrames: Math.max(1, Math.ceil(totalDur * FPS)),
            width: dims.width,
            height: dims.height,
            fps: FPS,
            props,
          };
        }}
      />
      <Composition
        id="UGCBrandedVideo"
        component={UGCBrandedVideo as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={defaultUGCProps as unknown as Record<string, unknown>}
        calculateMetadata={async ({ props }) => {
          const p = props as unknown as UGCCompositionProps;
          const dims = FORMAT_DIMENSIONS[p.format] || FORMAT_DIMENSIONS["9:16"];
          const totalDur = p.durationSec || 30;
          return {
            durationInFrames: Math.max(1, Math.ceil(totalDur * FPS)),
            width: dims.width,
            height: dims.height,
            fps: FPS,
            props,
          };
        }}
      />
    </>
  );
};
