import * as fs from 'fs/promises';
import * as path from 'path';

const VIDEOS_DIR = path.resolve(process.cwd(), 'videos');

export async function ensureVideoDir(runId: string): Promise<string> {
  const dir = path.join(VIDEOS_DIR, runId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function getVideoPath(runId: string): Promise<string> {
  const dir = await ensureVideoDir(runId);
  return path.join(dir, 'session.webm');
}

export async function videoExists(runId: string): Promise<boolean> {
  try {
    const videoPath = path.join(VIDEOS_DIR, runId, 'session.webm');
    await fs.access(videoPath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteVideoDir(runId: string): Promise<void> {
  const dir = path.join(VIDEOS_DIR, runId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // already deleted
  }
}

export function getVideoRelativePath(runId: string): string {
  return `videos/${runId}/session.webm`;
}
