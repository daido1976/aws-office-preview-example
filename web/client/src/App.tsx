// Shared Types
type ApiResponse<T> = { success: boolean; data: T | null; error?: string };
type UploadUrlResponse = { uploadUrl: string; fileId: string };
type PreviewUrlResponse = { previewUrl: string };
import React, { useState } from "react";

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      // Get upload URL and file ID
      const response = await fetch("/api/get_upload_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const result: ApiResponse<UploadUrlResponse> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to get upload URL");
      }

      const { uploadUrl, fileId } = result.data;

      // Upload file to S3
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });

      setFileId(fileId);
      alert("File uploaded successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const handlePreview = async () => {
    if (!fileId) return;

    try {
      // Get preview URL
      const response = await fetch(
        `/api/preview_url?fileId=${encodeURIComponent(fileId)}`
      );
      const result: ApiResponse<PreviewUrlResponse> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to get preview URL");
      }

      setPreviewUrl(result.data.previewUrl);
    } catch (error) {
      console.error("Error getting preview URL:", error);
    }
  };

  return (
    <div>
      <h1>File Upload and Preview</h1>

      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file}>
        Upload File
      </button>

      {fileId && <button onClick={handlePreview}>Preview File</button>}

      {previewUrl && (
        <iframe
          src={previewUrl}
          width="100%"
          height="500px"
          title="File Preview"
        />
      )}
    </div>
  );
};

export default App;
