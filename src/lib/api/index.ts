/**
 * PixelManageAI — API Client Barrel Export
 *
 * Re-exports the project/upload client alongside the render engine
 * so consumers can import everything from `@/lib/api`.
 */

// Project + upload client
export {
  uploadVideo,
  createProject,
  listProjects,
  getProject,
  updateProject,
  approveProject,
  getAnalysisStatus,
} from "./client";

// Render engine client (lives in render module, re-exported for convenience)
export {
  submitRender,
  getRenderStatus,
  cancelRender,
  RENDER_ENGINE,
} from "@/lib/render/engine";

// Data access hooks
export { useData } from './use-data';
export {
  useClients,
  useProjects,
  useTasks,
  usePayments,
  useLeads,
  useEmployees,
  useCampaigns,
  useUsers,
  useApprovals,
  useActivities,
} from './use-entity';
export { useSingle } from './use-single';
