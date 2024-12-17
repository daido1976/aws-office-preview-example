import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Loader2, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
      "application/vnd.ms-powerpoint": [".ppt"],
    },
    maxFiles: 1,
  });

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

      // Upload file to S3
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setFileId(fileId);
      setIsUploading(false);
      setUploadProgress(100);
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
    } catch (error) {
      console.error("Error getting preview URL:", error);
      setError("Failed to get preview URL. Please try again.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">
        File Upload and Preview
      </h1>

      <div className="max-w-md mx-auto">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center justify-center space-x-2">
              <FileText className="w-6 h-6 text-blue-500" />
              <span className="font-medium">{file.name}</span>
            </div>
          ) : (
            <div>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                Drag & drop a file here, or click to select a file
              </p>
              <p className="text-sm text-gray-500 mt-2">
                (Supported formats: .xls, .xlsx, .doc, .docx, .ppt, .pptx)
              </p>
            </div>
          )}
        </div>

        {file && !fileId && (
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full mt-4"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload File"
            )}
          </Button>
        )}

        {isUploading && <Progress value={uploadProgress} className="mt-4" />}

        {fileId && !previewUrl && (
          <Button onClick={handlePreview} className="w-full mt-4">
            Preview File
          </Button>
        )}

        {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
      </div>

      {previewUrl && (
        <div className="mt-8">
          <iframe
            src={previewUrl}
            className="w-full h-[600px] border border-gray-300 rounded-lg"
            title="File Preview"
          />
        </div>
      )}
    </div>
  );
}
