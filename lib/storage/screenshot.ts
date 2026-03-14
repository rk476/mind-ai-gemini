import * as fs from 'fs/promises';
import * as path from 'path';
import { uploadScreenshot as gcsUploadScreenshot } from './gcs';

const IMAGES_DIR = path.resolve(process.cwd(), 'images');

export async function uploadScreenshot(
  runId: string,
  stepId: string,
  buffer: Buffer
): Promise<string> {
  // Attempt GCS upload first
  const gcsUrl = await gcsUploadScreenshot(runId, stepId, buffer);
  if (gcsUrl) {
    return gcsUrl;
  }

  // Fallback to local storage if GCS is not configured
  const dir = path.join(IMAGES_DIR, runId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${stepId}.png`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);

  // Return a relative URL path that the API route can serve
  return `/api/test/${runId}/screenshot/${stepId}`;
}

export async function getScreenshotPath(
  runId: string,
  stepId: string
): Promise<string> {
  return path.join(IMAGES_DIR, runId, `${stepId}.png`);
}

export async function deleteScreenshotsDir(runId: string): Promise<void> {
  const dir = path.join(IMAGES_DIR, runId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // already deleted
  }
}
