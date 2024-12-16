// Shared Types
type ApiResponse<T> = { success: boolean; data: T | null; error?: string };
type UploadUrlRequestBody = { filename: string };
type UploadUrlResponse = { uploadUrl: string; fileId: string };
type PreviewUrlRequestBody = { fileId: string };
type PreviewUrlResponse = { previewUrl: string };

import express, { Request, Response } from "express";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 簡易的なDBとしてメモリに保存
const uploadFiles: {
  [fileId: string]: { filename: string };
} = {};

const app = express();
const port = 3000;

// TODO: あとで環境変数に移動
const s3 = new S3Client({
  endpoint: "http://localhost:9000", // MinIOのエンドポイント（ドメインは docker compose のサービス名）
  region: "ap-northeast-1", // MinIOでは任意の値でOK
  forcePathStyle: true, // パススタイルを有効化
  credentials: {
    accessKeyId: "admin", // MinIOのルートユーザー名
    secretAccessKey: "password", // MinIOのルートパスワード
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "test-bucket";

// SPA のビルドファイルディレクトリ
const clientBuildPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/dist"
);

// Static files のホスティング
app.use(express.static(clientBuildPath));

// JSON パーサーを有効化
app.use(express.json());

// Generate a unique file ID
const generateFileId = () => crypto.randomUUID();
const generateKey = (fileId: string, filename: string) =>
  `${fileId}-${filename}`;

// API to get upload URL
// NOTE: 本来は認証が必要
app.post(
  "/api/get_upload_url",
  async (
    req: Request<{}, {}, UploadUrlRequestBody>,
    res: Response<ApiResponse<UploadUrlResponse>>
  ) => {
    const { filename } = req.body;
    if (!filename) {
      res
        .status(400)
        .json({ success: false, data: null, error: "Filename is required" });
      return;
    }

    const fileId = generateFileId();
    // Save the filename to the in-memory DB
    uploadFiles[fileId] = { filename };

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

// API to get preview URL
// NOTE: 本来は認証が必要
app.post(
  "/api/get_preview_url",
  async (
    req: Request<{}, {}, PreviewUrlRequestBody>,
    res: Response<ApiResponse<PreviewUrlResponse>>
  ) => {
    const { fileId } = req.body;
    if (!fileId) {
      res
        .status(400)
        .json({ success: false, data: null, error: "File ID is required" });
      return;
    }

    try {
      const lambdaFunctionUrl = "http://localhost:8080";
      const previewUrl = `${lambdaFunctionUrl}?key=${generateKey(
        fileId,
        uploadFiles[fileId].filename
      )}`;
      res.json({ success: true, data: { previewUrl } });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: null,
        error: "Error generating preview URL",
      });
    }
  }
);

app.get("/", (_req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(port, () => {
  console.log(`express listening on http://localhost:${port}`);
});
