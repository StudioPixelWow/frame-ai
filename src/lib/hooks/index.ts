/**
 * FrameAI — Hook generation public API.
 *
 * import { generateHooks, extractSignals } from "@/lib/hooks";
 */

export { generateHooks, extractSignals, resolveStyles } from "./generate";
export { storeHooks, getHooks, deleteHooks, listHookProjects } from "./storage";
export type {
  Hook,
  HookStyle,
  HookResult,
  StoredHookResult,
  PresetName,
  ExtractedSignals,
  GenerateHooksOptions,
  HookGenerationMetadata,
} from "./types";
