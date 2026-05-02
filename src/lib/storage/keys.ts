/**
 * Storage key naming conventions.
 *
 * All keys follow: {namespace}/{userId}/{projectId}/{filename}
 *
 * Rules:
 * - Keys contain only alphanumeric, hyphens, underscores, dots, and /
 * - userId, projectId, renderId are slugified/sanitized before use
 * - No user-provided strings (filenames, titles) appear in the key
 * - Original file extension is preserved on source.* for mime-type transparency
 */

export const StorageKeys = {
  sourceVideo: (userId: string, projectId: string, ext: string) =>
    `uploads/${userId}/${projectId}/source.${ext}`,

  sourceThumbnail: (userId: string, projectId: string) =>
    `uploads/${userId}/${projectId}/thumb.jpg`,

  renderOutput: (userId: string, projectId: string, renderId: string) =>
    `renders/${userId}/${projectId}/${renderId}/output.mp4`,

  renderThumbnail: (userId: string, projectId: string, renderId: string) =>
    `renders/${userId}/${projectId}/${renderId}/thumb.jpg`,
};
