import React, { useState, useRef } from "react";
import {
  ApiResponse,
  PreviewUrlResponse,
  UploadUrlResponse,
} from "../../server/types";
import "./App.css";

export default function App() {
  const [fileState, setFileState] = useState<{
    file: File | null;
    fileId: string | null;
    previewUrl: string | null;
  }>({
    file: null,
    fileId: null,
    previewUrl: null,
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = [".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"];

  // ファイル拡張子の検証
  const isValidFile = (file: File): boolean => {
    const fileExtension = file.name
      .slice(file.name.lastIndexOf("."))
      .toLowerCase();
    return allowedExtensions.includes(fileExtension);
  };

  // ファイル選択時/ドロップ時の共通処理
  const handleFileSelection = (selectedFile: File | null) => {
    if (!selectedFile || !isValidFile(selectedFile)) {
      setError(
        `Invalid file type. Only ${allowedExtensions.join(", ")} are allowed.`
      );
      setFileState({
        file: null,
        fileId: null,
        previewUrl: null,
      });
      return;
    }

    setError(null);
    setFileState({
      file: selectedFile,
      fileId: null,
      previewUrl: null,
    });
  };

  // アップロードURL取得
  const fetchUploadUrl = async (
    filename: string
  ): Promise<UploadUrlResponse> => {
    const response = await fetch("/api/get_upload_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    const result: ApiResponse<UploadUrlResponse> = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to get upload URL");
    }

    return result.data;
  };

  // ファイルをS3へアップロード
  const uploadFileToS3 = async (uploadUrl: string, file: File) => {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!response.ok) {
      throw new Error("Failed to upload file");
    }
  };

  // プレビューURL取得
  const fetchPreviewUrl = async (
    fileId: string
  ): Promise<PreviewUrlResponse> => {
    const response = await fetch("/api/get_preview_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId }),
    });
    const result: ApiResponse<PreviewUrlResponse> = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to get preview URL");
    }

    return result.data;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(event.target.files?.[0] || null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFileSelection(event.dataTransfer.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!fileState.file) return;

    setError(null);

    try {
      const { uploadUrl, fileId } = await fetchUploadUrl(fileState.file.name);
      await uploadFileToS3(uploadUrl, fileState.file);
      // アップロードが成功したら、fileIdをセットする
      setFileState((prev) => ({ ...prev, fileId }));

      const { previewUrl } = await fetchPreviewUrl(fileId);
      setFileState((prev) => ({
        ...prev,
        previewUrl,
      }));
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Failed to upload file. Please try again.");
    }
  };

  const handlePreview = async () => {
    if (!fileState.fileId) return;

    try {
      const { previewUrl } = await fetchPreviewUrl(fileState.fileId);
      setFileState((prev) => ({ ...prev, previewUrl }));
    } catch (error) {
      console.error("Error getting preview URL:", error);
      setError("Failed to get preview URL. Please try again.");
    }
  };

  return (
    <div className="container">
      <h1 className="title">Office File Upload and Preview</h1>

      <div className="uploadArea">
        <div
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {fileState.file ? (
            <div className="fileInfo">
              <FileIcon />
              <span>{fileState.file.name}</span>
            </div>
          ) : (
            <>
              <div className="uploadIcon">
                <UploadIcon />
              </div>
              <p>Drag & drop a file here, or click to select</p>
              <p className="supportedFormats">
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

        {fileState.file && !fileState.fileId && (
          <button onClick={handleUpload} className="button">
            Upload File
          </button>
        )}

        {fileState.fileId && !fileState.previewUrl && (
          <button onClick={handlePreview} className="button">
            Preview File
          </button>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      {fileState.previewUrl && (
        <div className="previewArea">
          <div className="previewHeader">
            <h2>File Preview</h2>
            <button
              onClick={() =>
                setFileState((prev) => ({ ...prev, previewUrl: null }))
              }
              className="closeButton"
            >
              Close
            </button>
          </div>
          <iframe
            src={fileState.previewUrl}
            className="preview"
            title="File Preview"
            onLoad={() =>
              window.scrollTo({
                top: document.body.scrollHeight,
                behavior: "smooth",
              })
            }
          />
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      className="icon"
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
      className="icon"
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
