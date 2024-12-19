// @ts-check
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { convertTo, canBeConvertedToPDF } from "@shelf/aws-lambda-libreoffice";
import fs from "node:fs";
import path from "node:path";

const s3 = new S3Client({
  endpoint: "http://s3-minio:9000", // MinIOのエンドポイント（ホスト名はdocker composeのサービス名）
  region: "ap-northeast-1", // MinIOでは任意の値でOK
  forcePathStyle: true, // パススタイルを有効化
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
    const pdfHeadObjectData = await s3
      .send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: outputKey,
        })
      )
      .catch((err) => {
        // See. https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-s3/Class/NotFound/
        if (err.name !== "NotFound") {
          throw err;
        }
      });

    if (pdfHeadObjectData) {
      // 変換後のPDFファイルが存在すればそれをそのままレスポンスとして返す
      const pdfData = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: outputKey,
        })
      );

      if (pdfData.Body) {
        const pdfBuffer = await pdfData.Body.transformToByteArray();
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

    // S3からOfficeファイルをダウンロード
    const officeData = await s3.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );

    if (!officeData.Body) {
      throw new Error(`Unable to retrieve the contents of file ${objectKey}`);
    }

    // ファイルをローカルに保存
    const inputFilePath = path.join(tmpPath, objectKey);
    const officeFileBytes = await officeData.Body.transformToByteArray();
    fs.writeFileSync(inputFilePath, Buffer.from(officeFileBytes));

    // ファイルがPDFに変換可能か確認
    if (!canBeConvertedToPDF(objectKey)) {
      throw new Error(`The file ${objectKey} cannot be converted to PDF`);
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
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: outputKey,
        Body: fs.createReadStream(outputFilePath),
        ContentType: "application/pdf",
      })
    );

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
