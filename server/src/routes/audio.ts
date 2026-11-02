import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { loadUser } from '../lib/users';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB (PTE/IELTS speaking responses are <= 90s)
const RETENTION_DAYS = 90; // ADR-004: 90-day automated lifecycle retention

// In-memory audio asset registry for edge runtime / testing
export const audioStore = new Map<
  string,
  {
    id: string;
    userId: string;
    taskId: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number;
    expiresAt: string;
    data: ArrayBuffer;
  }
>();

export const audio = new Hono<AppEnv>();

audio.use('*', requireAuth);

/**
 * POST /v1/audio/upload — uploads a spoken response recording with 90-day retention
 */
audio.post('/upload', async (c) => {
  const userId = c.get('userId');
  const user = await loadUser(c.env.DB, userId, new Date());
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  const contentType = c.req.header('content-type') || '';
  let audioBytes: ArrayBuffer;
  let mimeType = 'audio/webm;codecs=opus';
  let taskId = 'pte_speaking_task';
  let durationSeconds = 0;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.parseBody();
    const file = formData['file'];

    if (!file || typeof file === 'string') {
      throw new ApiError(400, 'INVALID_REQUEST', 'Missing audio file in upload.');
    }

    if (!(file instanceof File)) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Invalid file upload.');
    }

    if (file.size > MAX_AUDIO_BYTES) {
      throw new ApiError(400, 'INPUT_TOO_LONG', 'Audio recording exceeds maximum permitted size of 10MB.');
    }

    audioBytes = await file.arrayBuffer();
    mimeType = file.type || mimeType;
    if (typeof formData['taskId'] === 'string') taskId = formData['taskId'];
    if (typeof formData['durationSeconds'] === 'string') durationSeconds = parseFloat(formData['durationSeconds']) || 0;
  } else {
    // Direct binary body upload
    mimeType = c.req.header('x-audio-mimetype') || contentType || mimeType;
    taskId = c.req.header('x-task-id') || taskId;
    const durHeader = c.req.header('x-duration-seconds');
    if (durHeader) durationSeconds = parseFloat(durHeader) || 0;

    audioBytes = await c.req.arrayBuffer();
    if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
      throw new ApiError(400, 'INPUT_TOO_LONG', 'Audio recording exceeds maximum permitted size of 10MB.');
    }
  }

  if (audioBytes.byteLength === 0) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Cannot upload an empty audio recording.');
  }

  if (!mimeType.startsWith('audio/')) {
    throw new ApiError(400, 'INVALID_REQUEST', `Unsupported MIME type: ${mimeType}. Must be an audio file.`);
  }

  const assetId = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Store in memory registry (or R2 bucket if configured)
  audioStore.set(assetId, {
    id: assetId,
    userId,
    taskId,
    mimeType,
    sizeBytes: audioBytes.byteLength,
    durationSeconds,
    expiresAt,
    data: audioBytes
  });

  return c.json({
    success: true,
    asset: {
      id: assetId,
      userId,
      taskId,
      mimeType,
      sizeBytes: audioBytes.byteLength,
      durationSeconds,
      expiresAt,
      retentionDays: RETENTION_DAYS,
      url: `/v1/audio/${assetId}`
    }
  });
});

/**
 * GET /v1/audio/:id — retrieves audio asset metadata or stream
 */
audio.get('/:id', async (c) => {
  const assetId = c.req.param('id');
  const asset = audioStore.get(assetId);

  if (!asset) {
    throw new ApiError(404, 'NOT_FOUND', 'Audio asset not found or has expired.');
  }

  // Verify ownership
  if (asset.userId !== c.get('userId')) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Access denied to this audio recording.');
  }

  const accept = c.req.header('accept') || '';
  if (accept.includes('audio/') || accept.includes('*/*')) {
    return new Response(asset.data, {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': asset.sizeBytes.toString(),
        'X-Audio-Expires-At': asset.expiresAt
      }
    });
  }

  return c.json({
    id: asset.id,
    userId: asset.userId,
    taskId: asset.taskId,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    durationSeconds: asset.durationSeconds,
    expiresAt: asset.expiresAt,
    retentionDays: RETENTION_DAYS
  });
});
