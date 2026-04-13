/**
 * FrameAI — CTA generation public API.
 *
 * import { generateCtas, resolveSignals } from "@/lib/cta";
 */

export { generateCtas, resolveSignals }              from "./generate";
export { storeCtas, getCtas, deleteCtas,
         listCtaProjects }                           from "./storage";
export type {
  Cta,
  CtaGoal,
  CtaResult,
  StoredCtaResult,
  BusinessType,
  CtaSignals,
  CtaGenerationMetadata,
  GenerateCtaOptions,
} from "./types";
