// @ts-check
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { convertTo, canBeConvertedToPDF } from "@shelf/aws-lambda-libreoffice";
import fs from "fs";
import path from "path";

// TODO: あとで環境変数に移動
const s3 = new S3Client({
  endpoint: "http://s3-minio:9000", // MinIOのエンドポイント（ドメインは docker compose のサービス名）
  region: "ap-northeast-1", // MinIOでは任意の値でOK
  forcePathStyle: true, // パススタイルを有効化
  credentials: {
    accessKeyId: "admin", // MinIOのルートユーザー名
    secretAccessKey: "password", // MinIOのルートパスワード
  },
});

/**
 * @param {import('aws-lambda').APIGatewayProxyEventV2} event
 * @returns {Promise<import('aws-lambda').APIGatewayProxyResultV2>}
 */
export const handler = async (event) => {
  console.log("hello from lambda");
  const bucketName = process.env.S3_BUCKET_NAME;
  const objectKey = event.queryStringParameters?.key ?? "";
  const tmpPath = process.env.HOME ?? "/tmp";
  console.log("event", JSON.stringify(event));
  console.log({ objectKey, bucketName, tmpPath });

  try {
    // S3からファイルをダウンロード
    const getObjectParams = { Bucket: bucketName, Key: objectKey };
    const getObjectCommand = new GetObjectCommand(getObjectParams);
    const data = await s3.send(getObjectCommand);

    if (!data.Body) {
      throw new Error(`ファイル ${objectKey} の内容を取得できません`);
    }

    const inputFilePath = path.join(tmpPath, objectKey);

    // ファイルをローカルに保存
    const fileBytes = await data.Body.transformToByteArray();
    fs.writeFileSync(inputFilePath, Buffer.from(fileBytes));

    // ファイルがPDFに変換可能か確認
    if (!canBeConvertedToPDF(objectKey)) {
      throw new Error(`ファイル ${objectKey} はPDFに変換できません`);
    }

    // ファイルをPDFに変換
    const outputFilePath = await convertTo(objectKey, "pdf");

    // 変換後のファイルをS3にアップロード
    const outputKey = `${path.parse(objectKey).name}.pdf`;
    const putObjectParams = {
      Bucket: bucketName,
      Key: outputKey,
      Body: fs.createReadStream(outputFilePath),
      ContentType: "application/pdf",
    };
    const putObjectCommand = new PutObjectCommand(putObjectParams);
    await s3.send(putObjectCommand);

    // PDFファイルをBase64エンコード
    const pdfBuffer = fs.readFileSync(outputFilePath);

    return {
      statusCode: 200,
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
      headers: {
        "Content-Type": "application/pdf",
      },
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
