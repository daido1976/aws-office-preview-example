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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
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
      setFile(event.dataTransfer.files[0]);
      setFileId(null);
      setPreviewUrl(null);
      setShowPreview(false);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

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

      // Upload file to S3 using fetch with progress
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target && e.target.result) {
          const fileContent = e.target.result as ArrayBuffer;
          try {
            const response = await fetch(uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: fileContent,
            });

            if (response.ok) {
              setFileId(fileId);
              setIsUploading(false);
              setUploadProgress(100);
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
        }
      };

      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      setError("Failed to get upload URL. Please try again.");
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
              <p>ドラッグ＆ドロップ、またはクリックしてファイルを選択</p>
              <p className={styles.supportedFormats}>
                (対応形式: .xls, .xlsx, .doc, .docx, .ppt, .pptx)
              </p>
            </>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xls,.xlsx,.doc,.docx,.ppt,.pptx"
          style={{ display: "none" }}
        />

        {file && !fileId && (
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={styles.button}
          >
            {isUploading ? "アップロード中..." : "ファイルをアップロード"}
          </button>
        )}

        {isUploading && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        {fileId && !showPreview && (
          <button onClick={handlePreview} className={styles.button}>
            ファイルをプレビュー
          </button>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>

      {showPreview && previewUrl && (
        <div className={styles.previewArea}>
          <div className={styles.previewHeader}>
            <h2>ファイルプレビュー</h2>
            <button onClick={handleClosePreview} className={styles.closeButton}>
              閉じる
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
