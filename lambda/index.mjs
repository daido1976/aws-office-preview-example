// @ts-check
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { convertTo, canBeConvertedToPDF } from "@shelf/aws-lambda-libreoffice";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
      // ファイルが存在すればそのオブジェクトの署名付きURLを発行して返す
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucketName,
          Key: outputKey,
        }),
        { expiresIn: 60 * 5 } // URLの有効期限を5分に設定
      );

      console.log(`署名付きURL: ${signedUrl}`);

      // 302リダイレクトレスポンスを返す
      return {
        statusCode: 302,
        headers: {
          Location: signedUrl, // リダイレクト先のURL
        },
      };
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

    // ファイルをPDFに変換
    const outputFilePath = await convertTo(objectKey, "pdf");

    // 変換後のファイルをS3にアップロード
    const putObjectParams = {
      Bucket: bucketName,
      Key: outputKey,
      Body: fs.createReadStream(outputFilePath),
      ContentType: "application/pdf",
    };
    const putObjectCommand = new PutObjectCommand(putObjectParams);
    await s3.send(putObjectCommand);

    // 署名付きURLを生成
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: outputKey,
      }),
      { expiresIn: 60 * 5 } // URLの有効期限を5分に設定
    );

    console.log(`署名付きURL: ${signedUrl}`);

    // 302リダイレクトレスポンスを返す
    return {
      statusCode: 302,
      headers: {
        Location: signedUrl, // リダイレクト先のURL
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
