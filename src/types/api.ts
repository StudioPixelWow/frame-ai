/**
 * PixelManageAI — API Type Contracts
 *
 * Request and response types for every REST endpoint described in the
 * runtime architecture spec (Phase 6, §3). These types are shared
 * between the frontend API client and the Next.js route handlers.
 *
 * Endpoint map:
 *   POST   /api/upload              → UploadResponse
 *   POST   /api/projects            → CreateProjectResponse
 *   GET    /api/projects             → ProjectListResponse
 *   GET    /api/projects/:id         → ProjectDetailResponse
 *   PATCH  /api/projects/:id         → ProjectUpdateResponse
 *   POST   /api/render              → SubmitRenderResponse        (in types/render.ts)
 *   GET    /api/render/:renderId     → RenderStatusResponse        (in types/render.ts)
 */

import type { ProjectListItem, ApiProject } from "./persistence";

// ── Upload ────────────────────────────────────────────────────────────────

/** POST /api/upload — multipart/form-data with `video` field */
export interface UploadRequest {
  /** The video File (sent as FormData, not JSON) */
  file: File;
  /** Optional: project ID to associate with (if project already exists) */
  projectId?: string;
}

export interface UploadResponse {
  /** Storage key for the uploaded video */
  storageKey: string;
  /** Pre-signed CDN URL for immediate playback (TTL: 1 hour) */
  url: string;
  /** Original filename echoed back */
  filename: string;
  /** File size in bytes */
  sizeBytes: number;
}

// ── Project creation ──────────────────────────────────────────────────────

/** POST /api/projects — create a new project with initial wizard state */
export interface CreateProjectRequest {
  name: string;
  client?: string;
  tags?: string[];
  /** Full RenderPayload v2.2 JSONB (optional at creation; required at approval) */
  renderPayload?: Record<string, unknown>;
}

export interface CreateProjectResponse {
  projectId: string;
}

// ── Project list ──────────────────────────────────────────────────────────

/** GET /api/projects — query params */
export interface ProjectListQuery {
  status?: string;
  limit?: number;
  offset?: number;
  sort?: "created_at" | "updated_at" | "name";
  order?: "asc" | "desc";
}

export interface ProjectListResponse {
  projects: ProjectListItem[];
  total: number;
  limit: number;
  offset: number;
}

// ── Project detail ────────────────────────────────────────────────────────

/** GET /api/projects/:id */
export type ProjectDetailResponse = ApiProject;

// ── Project update ────────────────────────────────────────────────────────

/** PATCH /api/projects/:id — partial updates to mutable fields */
export interface ProjectUpdateRequest {
  /** Partial wizard state — deep-merged server-side */
  wizardState?: Record<string, unknown>;
  /** Project-level status transition */
  status?: string;
  /** Replace tags */
  tags?: string[];
  /** Approval snapshot — set once, immutable afterwards */
  renderPayloadSnapshot?: Record<string, unknown>;
}

export interface ProjectUpdateResponse {
  success: true;
  updatedAt: string;
}

// ── Error response ────────────────────────────────────────────────────────

/** Standard error shape returned by all endpoints on failure */
export interface ApiErrorBody {
  error: string;
  code?: string;
  detail?: string;
}

// ── Analysis status ───────────────────────────────────────────────────────

/** GET /api/projects/:id/analysis-status */
export interface AnalysisStatusResponse {
  videoInspection: {
    status: string;
    durationSec?: number;
    width?: number;
    height?: number;
    hasAudio?: boolean;
  };
  transcription: {
    status: string;
    segmentCount?: number;
  };
}

// ── Approve project ───────────────────────────────────────────────────────

/** POST /api/projects/:id/approve */
export interface ApproveProjectResponse {
  success: true;
  approvedAt: string;
  status: "approved";
}
