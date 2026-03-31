// DigitalOcean Spaces (S3-compatible) file storage
// Replaces the old Manus Forge proxy with direct S3 SDK calls

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    if (!ENV.doSpacesKey || !ENV.doSpacesSecret || !ENV.doSpacesBucket) {
      throw new Error(
        "DO Spaces credentials missing: set DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET, DO_SPACES_REGION, DO_SPACES_ENDPOINT"
      );
    }
    _client = new S3Client({
      endpoint: ENV.doSpacesEndpoint,
      region: ENV.doSpacesRegion || "us-east-1",
      credentials: {
        accessKeyId: ENV.doSpacesKey,
        secretAccessKey: ENV.doSpacesSecret,
      },
      forcePathStyle: false,
    });
  }
  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function cdnUrl(key: string): string {
  return `https://${ENV.doSpacesBucket}.${ENV.doSpacesRegion}.cdn.digitaloceanspaces.com/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  await getClient().send(
    new PutObjectCommand({
      Bucket: ENV.doSpacesBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  return { key, url: cdnUrl(key) };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const url = await getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: ENV.doSpacesBucket,
      Key: key,
    }),
    { expiresIn: 3600 }
  );
  return { key, url };
}
