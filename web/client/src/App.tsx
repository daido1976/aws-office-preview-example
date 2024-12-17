import React, { useState, useRef } from "react";
import styles from "./App.module.css";

type ApiResponse<T> = { success: boolean; data: T | null; error?: string };
type UploadUrlResponse = { uploadUrl: string; fileId: string };
type PreviewUrlResponse = { previewUrl: string };

export default function FileUploadPreview() {
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = [".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"];

  const isValidFile = (file: File): boolean => {
    const fileExtension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();
    return allowedExtensions.includes(fileExtension);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!isValidFile(file)) {
        setError(
          "Invalid file type. Only .xls, .xlsx, .doc, .docx, .ppt, .pptx are allowed."
        );
        setFile(null);
        setFileId(null);
        setPreviewUrl(null);
        setShowPreview(false);
        return;
      }
      setFile(file);
      setFileId(null);
      setPreviewUrl(null);
      setShowPreview(false);
      setError(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      const file = event.dataTransfer.files[0];
      if (!isValidFile(file)) {
        setError(
          "Invalid file type. Only .xls, .xlsx, .doc, .docx, .ppt, .pptx are allowed."
        );
        setFile(null);
        setFileId(null);
        setPreviewUrl(null);
        setShowPreview(false);
        return;
      }
      setFile(file);
      setFileId(null);
      setPreviewUrl(null);
      setShowPreview(false);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // アップロードURLとfileIdの取得
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

      // ファイルをそのままfetchで送信
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file, // Fileオブジェクトをそのまま送信
      });

      if (uploadResponse.ok) {
        setFileId(fileId);
        setIsUploading(false);
        setPreviewUrl(null);
        setShowPreview(false);
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Failed to upload file. Please try again.");
      setIsUploading(false);
    }
  };

  const handlePreview = async () => {
    if (!fileId) return;

    try {
      setError(null);
      // Get preview URL
      const response = await fetch("/api/get_preview_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const result: ApiResponse<PreviewUrlResponse> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to get preview URL");
      }

      setPreviewUrl(result.data.previewUrl);
      setShowPreview(true);
    } catch (error) {
      console.error("Error getting preview URL:", error);
      setError("Failed to get preview URL. Please try again.");
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>File Upload and Preview</h1>

      <div className={styles.uploadArea}>
        <div
          className={styles.dropzone}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? (
            <div className={styles.fileInfo}>
              <FileIcon />
              <span>{file.name}</span>
            </div>
          ) : (
            <>
              <UploadIcon />
              <p>Drag & drop a file here, or click to select</p>
              <p className={styles.supportedFormats}>
                (Supported formats: {allowedExtensions.join(", ")})
              </p>
            </>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={allowedExtensions.join(",")}
          style={{ display: "none" }}
        />

        {file && !fileId && (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={styles.button}
          >
            {isUploading ? "Uploading..." : "Upload File"}
          </button>
        )}

        {fileId && !showPreview && (
          <button onClick={handlePreview} className={styles.button}>
            Preview File
          </button>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>

      {showPreview && previewUrl && (
        <div className={styles.previewArea}>
          <div className={styles.previewHeader}>
            <h2>File Preview</h2>
            <button onClick={handleClosePreview} className={styles.closeButton}>
              Close
            </button>
          </div>
          <iframe
            src={previewUrl}
            className={styles.preview}
            title="File Preview"
          />
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}
