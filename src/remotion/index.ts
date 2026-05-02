/**
 * Remotion entry point — this file MUST call registerRoot().
 * Without it, the Remotion CLI and @remotion/renderer cannot find compositions.
 */
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

// Register the root component so Remotion CLI, bundler, and renderer can find compositions.
registerRoot(RemotionRoot);

// Re-export for use in other parts of the app (e.g. Remotion Player in the browser)
export { RemotionRoot } from "./Root";
export type { CompositionProps } from "./types";
export { UGCBrandedVideo } from "./UGCBrandedVideo";
export type { UGCCompositionProps } from "./ugc-types";
export { VISUAL_STYLES, defaultUGCProps, MANDATORY_SCENE_ORDER, SCENE_PROPORTIONS, DURATION_PRESETS, SCENE_VISUAL_RULES, buildEnforcedScenes, validateSceneStructure } from "./ugc-types";
export type { VisualStyleId, SceneBeat, ScriptAnalysis, SceneType, DurationPreset, VideoValidationResult } from "./ugc-types";
