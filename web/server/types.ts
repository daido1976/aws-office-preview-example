export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
export type UploadUrlRequestBody = { filename: string };
export type UploadUrlResponse = { uploadUrl: string; fileId: string };
export type PreviewUrlRequestBody = { fileId: string };
export type PreviewUrlResponse = { previewUrl: string };
