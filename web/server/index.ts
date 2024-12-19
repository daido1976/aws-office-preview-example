import express, { Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ApiResponse,
  PreviewUrlRequestBody,
  PreviewUrlResponse,
  UploadUrlRequestBody,
  UploadUrlResponse,
} from "./types";

const app = express();
const port = 3000;

const s3 = new S3Client({
  endpoint: "http://localhost:9000", // MinIOのエンドポイント（ドメインは docker compose のサービス名）
  region: "ap-northeast-1", // MinIOでは任意の値でOK
  forcePathStyle: true, // パススタイルを有効化
  // TODO: 環境変数に移動する
  credentials: {
    accessKeyId: "admin", // MinIOのルートユーザー名
    secretAccessKey: "password", // MinIOのルートパスワード
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "test-bucket";

// client側でビルドしたファイルをexpressで配信して同一オリジンとする（CORS対応せずに済ませたいため）
const clientBuildPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/dist"
);
app.use(express.static(clientBuildPath));

app.use(express.json());

const generateFileId = () => crypto.randomUUID();
const generateKey = (fileId: string, filename: string): string => {
  const extensionMatch = filename.match(/\.[^.]+$/);
  const extension = extensionMatch ? extensionMatch[0] : "";
  return `${fileId}${extension}`;
};

// 簡易的なDBとしてアップロードするファイルの情報をメモリに保存（単一ファイルのみ対応）
const uploadFileStore = (() => {
  let uploadFile: { fileId: string; filename: string } | null = null;

  return {
    set: (fileId: string, filename: string) => {
      uploadFile = { fileId, filename };
    },

    getBy: (fileId: string) => {
      return uploadFile?.fileId === fileId ? uploadFile : null;
    },
  };
})();

// NOTE: 本来は認証が必要
app.post(
  "/api/get_upload_url",
  async (
    req: Request<{}, {}, UploadUrlRequestBody>,
    res: Response<ApiResponse<UploadUrlResponse>>
  ) => {
    const { filename } = req.body;
    if (!filename) {
      res.status(400).json({ success: false, error: "Filename is required" });
      return;
    }

    // Save the file info to the in-memory DB
    const fileId = generateFileId();
    uploadFileStore.set(fileId, filename);

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: generateKey(fileId, filename),
        ContentType: "application/octet-stream",
      })
    );

    res.json({ success: true, data: { uploadUrl, fileId } });
  }
);

// NOTE: 本来は認証が必要
app.post(
  "/api/get_preview_url",
  async (
    req: Request<{}, {}, PreviewUrlRequestBody>,
    res: Response<ApiResponse<PreviewUrlResponse>>
  ) => {
    const { fileId } = req.body;
    if (!fileId) {
      res.status(400).json({ success: false, error: "File ID is required" });
      return;
    }
    const uploadFile = uploadFileStore.getBy(fileId);
    if (!uploadFile) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }
    const lambdaFunctionUrl = "http://localhost:8080";
    // NOTE: #navpanes=0をつけることでChromeとEdgeでのPDFの表示をカスタマイズできる
    const previewUrl = `${lambdaFunctionUrl}?key=${generateKey(
      uploadFile.fileId,
      uploadFile.filename
    )}#navpanes=0`;
    res.json({ success: true, data: { previewUrl } });
  }
);

app.get("/", (_req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(port, () => {
  console.log(`express listening on http://localhost:${port}`);
});
