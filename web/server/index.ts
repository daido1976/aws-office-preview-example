// Shared Types
type ApiResponse<T> = { success: boolean; data: T | null; error?: string };
type UploadUrlResponse = { uploadUrl: string; fileId: string };
type PreviewUrlResponse = { previewUrl: string };
type UploadUrlRequest = { filename: string };
type PreviewUrlRequest = { fileId: string };

// Express + TypeScript (web api)
import express, { Request, Response } from "express";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "crypto";

const app = express();
const port = 3000;

// TODO: ちゃんと設定する
const s3 = new S3Client({});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

// Generate a unique file ID
const generateFileId = () => crypto.randomUUID();

// API to get upload URL
app.post(
  "/api/upload_url",
  async (
    req: Request<{}, {}, UploadUrlRequest>,
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
    // TODO: keyちゃんとする
    const key = `uploads/${fileId}/${filename}`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: "application/octet-stream",
      })
    );

    res.json({ success: true, data: { uploadUrl, fileId } });
  }
);

// API to get preview URL
// app.get("/api/preview_url", (req, res) => {
//   const { fileId } = req.query;
//   if (!fileId) {
//     return res
//       .status(400)
//       .json({ success: false, data: null, error: "File ID is required" });
//   }

//   const key = `uploads/${fileId}/`;

//   const params = {
//     Bucket: BUCKET_NAME,
//     Key: key,
//     Expires: 60, // URL valid for 60 seconds
//   };

//   try {
//     const previewUrl = s3.getSignedUrl("getObject", params);
//     res.json({ success: true, data: { previewUrl } });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       data: null,
//       error: "Error generating preview URL",
//     });
//   }
// });

app.listen(port, () => {
  console.log(`Web API listening on port ${port}`);
});
