/**
 * PixelFrameAI — API Client
 *
 * Browser-side HTTP client for project and upload endpoints.
 * Render endpoints live in `src/lib/render/engine.ts` and are
 * re-exported from this module's barrel for convenience.
 *
 * All calls use the centralised API_BASE_URL from runtime config.
 */

import { API_BASE_URL } from "@/lib/config/runtime";
import type {
  UploadResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectListQuery,
  ProjectListResponse,
  ProjectDetailResponse,
  ProjectUpdateRequest,
  ProjectUpdateResponse,
  AnalysisStatusResponse,
  ApproveProjectResponse,
  ApiErrorBody,
} from "@/types/api";

// ── Helpers ───────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    // Auth token injection point — wired when auth layer is integrated
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body: ApiErrorBody = await res.json().catch(() => ({
      error: res.statusText,
    }));
    throw new Error(body.error ?? `API error ${res.status}`);
  }
  return res.json();
}

// ── Upload ────────────────────────────────────────────────────────────────

/**
 * Upload a video file via multipart/form-data.
 * Returns the storage key and a pre-signed playback URL.
 *
 * @param file      The video File object
 * @param projectId Optional project to associate with
 * @param onProgress Optional progress callback (0–100)
 */
export async function uploadVideo(
  file: File,
  projectId?: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("video", file);
  if (projectId) formData.append("projectId", projectId);

  // Use XMLHttpRequest for upload progress tracking
  if (onProgress) {
    return new Promise<UploadResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}/api/upload`);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error ?? `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Upload network error")));
      xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

      xhr.send(formData);
    });
  }

  // Simple fetch path (no progress tracking needed)
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
    // Note: do NOT set Content-Type — browser sets multipart boundary
  });

  return handleResponse<UploadResponse>(res);
}

// ── Projects ──────────────────────────────────────────────────────────────

/**
 * Create a new project.
 */
export async function createProject(
  data: CreateProjectRequest,
): Promise<CreateProjectResponse> {
  const res = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<CreateProjectResponse>(res);
}

/**
 * List projects for the authenticated user.
 */
export async function listProjects(
  query: ProjectListQuery = {},
): Promise<ProjectListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);

  const qs = params.toString();
  const url = `${API_BASE_URL}/api/projects${qs ? `?${qs}` : ""}`;

  const res = await fetch(url, { headers: getAuthHeaders() });
  return handleResponse<ProjectListResponse>(res);
}

/**
 * Get a single project with full wizard state and render status.
 */
export async function getProject(
  projectId: string,
): Promise<ProjectDetailResponse> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<ProjectDetailResponse>(res);
}

/**
 * Partially update a project (wizard state auto-save, status change, etc).
 */
export async function updateProject(
  projectId: string,
  data: ProjectUpdateRequest,
): Promise<ProjectUpdateResponse> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<ProjectUpdateResponse>(res);
}

// ── Approval ──────────────────────────────────────────────────────────────

/**
 * Approve a project — freezes wizard state and creates the immutable
 * render_payload_snapshot.
 */
export async function approveProject(
  projectId: string,
): Promise<ApproveProjectResponse> {
  const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/approve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse<ApproveProjectResponse>(res);
}

// ── Analysis status ───────────────────────────────────────────────────────

/**
 * Check the current analysis job statuses for a project.
 * Used by step 8 (subtitle setup) to poll for transcript readiness.
 */
export async function getAnalysisStatus(
  projectId: string,
): Promise<AnalysisStatusResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/projects/${projectId}/analysis-status`,
    { headers: getAuthHeaders() },
  );
  return handleResponse<AnalysisStatusResponse>(res);
}
