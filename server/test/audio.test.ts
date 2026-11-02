import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV } from './kv';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';
const EXT_ORIGIN = 'chrome-extension://abcdefghijklmnop';

let d1: TestD1;
let env: Bindings;

beforeEach(async () => {
  d1 = await createTestD1();
  env = {
    DB: d1.db,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: `${EXT_ORIGIN}, http://localhost:8787`,
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    GEMINI_API_KEY: '',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: '',
    CACHE: createTestKV().kv
  };
});

afterEach(() => {
  d1.close();
});

function seedUser(id = 'usr_audio_tester') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'speaker@example.com', 'Audio Speaker', 'free', NULL, '2026-11-01T00:00:00Z')`,
    [id, `g_${id}`]
  );
  return id;
}

async function tokenFor(id: string) {
  return signAccessToken({ id, plan: 'free', planExpiresAt: null }, SECRET, new Date());
}

describe('TICKET LF-003: Backend Audio Upload & 90-Day Retention API', () => {
  it('1. happy_path_upload: Uploads audio binary -> returns asset with 90-day retention metadata', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    const fakeAudioData = new Uint8Array(1024 * 45); // 45 KB fake audio chunk
    const res = await app.request(
      '/v1/audio/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/webm;codecs=opus',
          'X-Task-Id': 'pte_read_aloud',
          'X-Duration-Seconds': '35.4'
        },
        body: fakeAudioData
      },
      env
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.asset).toBeDefined();
    expect(data.asset.id).toMatch(/^aud_/);
    expect(data.asset.userId).toBe(userId);
    expect(data.asset.taskId).toBe('pte_read_aloud');
    expect(data.asset.sizeBytes).toBe(1024 * 45);
    expect(data.asset.durationSeconds).toBe(35.4);
    expect(data.asset.retentionDays).toBe(90);

    // Verify 90-day retention expiration timestamp
    const expiresDate = new Date(data.asset.expiresAt);
    const now = new Date();
    const diffDays = Math.round((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(90);

    // Verify GET /v1/audio/:id stream retrieval
    const streamRes = await app.request(
      `/v1/audio/${data.asset.id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'audio/*'
        }
      },
      env
    );
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get('Content-Type')).toBe('audio/webm;codecs=opus');
    expect(streamRes.headers.get('X-Audio-Expires-At')).toBe(data.asset.expiresAt);
  });

  it('2. size_limit_rejection: Rejects audio payloads exceeding 10MB limit with 400 INPUT_TOO_LONG', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    // Create payload larger than 10MB (11MB)
    const largeAudio = new Uint8Array(11 * 1024 * 1024);
    const res = await app.request(
      '/v1/audio/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/webm',
          'X-Task-Id': 'ielts_speaking_part_2'
        },
        body: largeAudio
      },
      env
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('INPUT_TOO_LONG');
    expect(data.error.message).toContain('10MB');
  });

  it('3. empty_audio_rejection: Rejects empty audio body with 400 INVALID_REQUEST', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    const res = await app.request(
      '/v1/audio/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/webm'
        },
        body: new Uint8Array(0)
      },
      env
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('INVALID_REQUEST');
  });

  it('4. non_audio_mime_rejection: Rejects unsupported non-audio content type with 400 INVALID_REQUEST', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    const res = await app.request(
      '/v1/audio/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain'
        },
        body: new TextEncoder().encode('Not an audio recording')
      },
      env
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('INVALID_REQUEST');
    expect(data.error.message).toContain('audio');
  });

  it('5. unauthorized_access: User B cannot retrieve User A audio recording', async () => {
    const userA = seedUser('usr_A');
    const userB = seedUser('usr_B');
    const tokenA = await tokenFor(userA);
    const tokenB = await tokenFor(userB);

    // User A uploads
    const uploadRes = await app.request(
      '/v1/audio/upload',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'audio/webm'
        },
        body: new Uint8Array(1024)
      },
      env
    );
    const uploadData = (await uploadRes.json()) as any;

    // User B attempts to access
    const getRes = await app.request(
      `/v1/audio/${uploadData.asset.id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenB}`
        }
      },
      env
    );
    expect(getRes.status).toBe(401);
  });
});
