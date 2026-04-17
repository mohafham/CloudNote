import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY
  }
});

export async function createPresignedUploadUrl(args: {
  storageKey: string;
  mimeType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: args.storageKey,
    ContentType: args.mimeType
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: args.expiresInSeconds ?? 900
  });
}

export async function deleteStoredObject(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey
  });

  await s3Client.send(command);
}

export function getObjectPublicUrl(storageKey: string): string {
  const endpoint = env.S3_ENDPOINT.endsWith("/") ? env.S3_ENDPOINT.slice(0, -1) : env.S3_ENDPOINT;
  return `${endpoint}/${env.S3_BUCKET}/${storageKey}`;
}
