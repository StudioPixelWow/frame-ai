/**
 * FrameAI — Smart trimming public API.
 *
 * import { generateTrimPlans, getTrimPlanFor } from "@/lib/trimmer";
 */

export { generateTrimPlans, getTrimPlanFor }              from "./generate";
export { scoreSegments }                                  from "./score";
export { selectForTarget }                                from "./select";
export { storeTrimResult, getTrimResult,
         deleteTrimResult, listTrimProjects }             from "./storage";
export type {
  TargetDurationPreset,
  TrimTarget,
  ScoredSegment,
  SegmentRole,
  TrimmedSegment,
  TrimPlan,
  TrimResult,
  StoredTrimResult,
  TrimMetadata,
  GenerateTrimOptions,
} from "./types";
