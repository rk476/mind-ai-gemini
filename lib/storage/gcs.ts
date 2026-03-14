import { Storage } from '@google-cloud/storage';

/**
 * Google Cloud Storage client for uploading screenshots, videos, and reports.
 * Falls back to local filesystem if GCS is not configured.
 *
 * LOCAL DEV SETUP:
 * Run once: `gcloud auth application-default login`
 * Then set these env vars in .env:
 *   GCS_BUCKET_NAME=hyrgpt-browser-agent-artifacts
 *   GCS_PROJECT_ID=hyrgpt-browser-agent
 */

let storageClient: Storage | null = null;
let gcsAvailable: boolean | null = null; // cached availability check

function getStorage(): Storage | null {
  if (storageClient) return storageClient;

  const bucketName = getBucketName();
  const projectId = process.env.GCS_PROJECT_ID;

  if (!bucketName) {
    if (gcsAvailable !== false) {
      console.warn('[GCS] GCS_BUCKET_NAME not set — using local storage fallback');
      gcsAvailable = false;
    }
    return null;
  }

  try {
    // Uses Application Default Credentials (ADC) automatically.
    // For local dev: run `gcloud auth application-default login`
    // For production: set GOOGLE_APPLICATION_CREDENTIALS to service account JSON path
    storageClient = new Storage(
      projectId ? { projectId } : undefined
    );
    gcsAvailable = true;
    console.log(`[GCS] Storage client initialised. Bucket: ${bucketName}, Project: ${projectId || 'default'}`);
    return storageClient;
  } catch (err) {
    console.error('[GCS] Failed to initialise Storage client:', err);
    gcsAvailable = false;
    return null;
  }
}

function getBucketName(): string {
  return process.env.GCS_BUCKET_NAME || 'hyrgpt-browser-agent-artifacts';
}

/**
 * Upload a file buffer to GCS.
 * Returns the public URL or null if GCS is not configured.
 */
export async function uploadToGCS(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string | null> {
  const storage = getStorage();
  if (!storage) return null;

  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(path);

  try {
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Attempt to make publicly readable (may fail with uniform bucket-level access)
    try {
      await file.makePublic();
    } catch {
      // Fine — uniform bucket-level access doesn't need this
    }

    const url = `https://storage.googleapis.com/${bucketName}/${path}`;
    console.log(`[GCS] ✅ Uploaded: ${url}`);
    return url;
  } catch (err) {
    console.error(`[GCS] ❌ Upload failed for path "${path}":`, err);
    // Return null so callers can fall back to local storage
    return null;
  }
}

/**
 * Upload a screenshot buffer to GCS.
 * Path: {runId}/images/{stepId}.png
 */
export async function uploadScreenshot(
  runId: string,
  stepId: string,
  buffer: Buffer
): Promise<string | null> {
  return uploadToGCS(
    buffer,
    `${runId}/images/${stepId}.png`,
    'image/png'
  );
}

/**
 * Upload a video file to GCS.
 * Path: {runId}/videos/session.webm
 */
export async function uploadVideo(
  runId: string,
  buffer: Buffer
): Promise<string | null> {
  return uploadToGCS(
    buffer,
    `${runId}/videos/session.webm`,
    'video/webm'
  );
}

/**
 * Upload a JSON report to GCS.
 * Path: {runId}/report.json
 */
export async function uploadReport(
  runId: string,
  report: Record<string, unknown>
): Promise<string | null> {
  const buffer = Buffer.from(JSON.stringify(report, null, 2));
  return uploadToGCS(
    buffer,
    `${runId}/report.json`,
    'application/json'
  );
}

/**
 * Check if GCS is configured and available.
 */
export function isGCSConfigured(): boolean {
  return !!(process.env.GCS_BUCKET_NAME && process.env.GCS_PROJECT_ID);
}
