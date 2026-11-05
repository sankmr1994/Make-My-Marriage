import { createHash, createHmac } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

const algorithm = "AWS4-HMAC-SHA256";
const region = "auto";
const service = "s3";
const emptyHash = createHash("sha256").update("").digest("hex");
type StorageFetchResponse = { status: number; ok: boolean; headers: { get: (name: string) => string | null } };

function settings() {
  const { R2_ACCOUNT_ID, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env;
  if (!R2_ACCOUNT_ID || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Photo storage is not configured. Contact the wedding organiser.");
  }
  return { endpoint: new URL(R2_ENDPOINT), accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET_NAME };
}

function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: Buffer | string, value: string) { return createHmac("sha256", key).update(value).digest(); }
function signingKey(secret: string, date: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), "aws4_request");
}
function amzDate(date: Date) { return date.toISOString().replace(/[:-]|\.\d{3}/g, ""); }
function encodedPath(bucket: string, key: string) {
  return `/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
function canonicalQuery(entries: Array<[string, string]>) {
  return entries.sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}
function objectUrl(bucket: string, key: string) {
  const config = settings();
  const url = new URL(config.endpoint);
  url.pathname = `${url.pathname.replace(/\/$/, "")}${encodedPath(bucket, key)}`;
  return { config, url };
}

export function createUploadUrl(bucketKey: string, contentType: string, expiresInSeconds = 300) {
  const { config, url } = objectUrl(settings().bucket, bucketKey);
  const now = new Date();
  const date = amzDate(now);
  const shortDate = date.slice(0, 8);
  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  const signedHeaders = "content-type;host";
  const query = canonicalQuery([
    ["X-Amz-Algorithm", algorithm],
    ["X-Amz-Credential", `${config.accessKeyId}/${scope}`],
    ["X-Amz-Date", date],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders]
  ]);
  const canonicalRequest = ["PUT", url.pathname, query, `content-type:${contentType}\nhost:${url.host}\n`, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [algorithm, date, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, shortDate)).update(stringToSign).digest("hex");
  url.search = `${query}&X-Amz-Signature=${signature}`;
  return url.toString();
}

export function createDownloadUrl(bucketKey: string, expiresInSeconds = 300) {
  const { config, url } = objectUrl(settings().bucket, bucketKey);
  const now = new Date();
  const date = amzDate(now);
  const shortDate = date.slice(0, 8);
  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  const query = canonicalQuery([
    ["X-Amz-Algorithm", algorithm],
    ["X-Amz-Credential", `${config.accessKeyId}/${scope}`],
    ["X-Amz-Date", date],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", "host"]
  ]);
  const canonicalRequest = ["GET", url.pathname, query, `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [algorithm, date, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, shortDate)).update(stringToSign).digest("hex");
  url.search = `${query}&X-Amz-Signature=${signature}`;
  return url.toString();
}

async function signedRequest(method: "HEAD" | "DELETE", key: string) {
  const { config, url } = objectUrl(settings().bucket, key);
  const date = amzDate(new Date());
  const shortDate = date.slice(0, 8);
  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  const headers = `host:${url.host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${date}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, url.pathname, "", headers, signedHeaders, emptyHash].join("\n");
  const stringToSign = [algorithm, date, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, shortDate)).update(stringToSign).digest("hex");
  const response = await fetch(url, { method, headers: {
    "x-amz-content-sha256": emptyHash,
    "x-amz-date": date,
    authorization: `${algorithm} Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  } }) as unknown as StorageFetchResponse;
  if (method === "HEAD" && response.status === 404) return null;
  if (!response.ok && !(method === "DELETE" && response.status === 404)) {
    throw new AppError(502, "PROVIDER_ERROR", "Photo storage could not verify or remove the uploaded image.");
  }
  if (method === "DELETE" || response.status === 404) return null;
  const sizeBytes = Number(response.headers.get("content-length"));
  return { sizeBytes, contentType: response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "", etag: response.headers.get("etag")?.replaceAll('"', "") };
}

export function inspectObject(key: string) { return signedRequest("HEAD", key); }
export function deleteObject(key: string) { return signedRequest("DELETE", key); }
