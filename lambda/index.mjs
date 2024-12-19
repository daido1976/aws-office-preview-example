// @ts-check
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
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
  const bucketName = process.env.S3_BUCKET_NAME;
  const objectKey = event.queryStringParameters?.key ?? ""; // e.g. sample.xlsx
  const fileExtension = path.extname(objectKey); // e.g. .xlsx
  const outputKey = `${path.parse(objectKey).name}.pdf`; // e.g. sample.pdf
  const tmpPath = process.env.HOME ?? "/tmp";
  console.debug(
    JSON.stringify({ event, bucketName, objectKey, outputKey, tmpPath })
  );

  try {
    // 変換後のPDFファイルがすでに存在するか調べる
    const headObjectParams = { Bucket: bucketName, Key: outputKey };
    const headObjectCommand = new HeadObjectCommand(headObjectParams);
    const headObjectData = await s3.send(headObjectCommand).catch((err) => {
      if (err.name !== "NotFound") {
        console.error(err);
      }
    });

    if (headObjectData) {
      // ファイルが存在すればそれをそのままレスポンスとして返す
      const getObjectParams = { Bucket: bucketName, Key: outputKey };
      const getObjectCommand = new GetObjectCommand(getObjectParams);
      const data = await s3.send(getObjectCommand);

      if (data.Body) {
        const pdfBuffer = await data.Body.transformToByteArray();
        return {
          statusCode: 200,
          body: Buffer.from(pdfBuffer).toString("base64"),
          isBase64Encoded: true,
          headers: {
            "Content-Type": "application/pdf",
          },
        };
      }
    }

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

    // OfficeファイルをPDFに変換
    const outFilters = {
      ".xls": "calc_pdf_Export",
      ".xlsx": "calc_pdf_Export",
      ".doc": "writer_pdf_Export",
      ".docx": "writer_pdf_Export",
      ".ppt": "impress_pdf_Export",
      ".pptx": "impress_pdf_Export",
    };
    const outputFilePath = await convertTo(
      objectKey,
      // ページ範囲を無制限にすると大きいファイルでは変換処理が終わらないので、25ページまでに制限（Slackの仕様を参考にしている）
      `'pdf:${outFilters[fileExtension]}:{"PageRange":{"type":"string","value":"1-25"}}'`
    );

    // 変換後のファイルをS3にアップロード
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
