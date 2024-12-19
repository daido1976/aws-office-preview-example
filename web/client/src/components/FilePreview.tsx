import React from "react";

interface FilePreviewProps {
  previewUrl: string;
  onClose: () => void;
  onLoad: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  previewUrl,
  onClose,
  onLoad,
}) => {
  return (
    <div className="previewArea">
      <div className="previewHeader">
        <h2>File Preview</h2>
        <button onClick={onClose} className="closeButton">
          Close
        </button>
      </div>
      <iframe
        src={previewUrl}
        className="preview"
        title="File Preview"
        onLoad={onLoad}
      />
    </div>
  );
};
