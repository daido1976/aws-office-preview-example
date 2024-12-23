import React, { useState, useRef } from "react";
import {
  ApiResponse,
  PreviewUrlResponse,
  UploadUrlResponse,
} from "../../server/types";
import fileIcon from "./assets/file-icon.png";
import uploadIcon from "./assets/upload-icon.png";
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
    const { file } = fileState;
    if (!file) return;

    setError(null);

    try {
      const { uploadUrl, fileId } = await fetchUploadUrl(file.name);
      await uploadFileToS3(uploadUrl, file);
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
              <img src={fileIcon} alt="File Icon" className="icon" />
              <span>{fileState.file.name}</span>
            </div>
          ) : (
            <>
              <div className="uploadIcon">
                <img src={uploadIcon} alt="Upload Icon" className="icon" />
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
