import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { loadUser } from '../lib/users';
import { requireAuth } from '../middleware/auth';

export const OnboardingInputSchema = z.object({
  target_exam: z.enum(['pte_academic', 'ielts_academic'] as const),
  target_score: z.string().trim().min(1, 'target_score is required'),
  target_exam_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'target_exam_date must be in YYYY-MM-DD format')
    .nullable()
    .optional(),
  mother_tongue: z.string().trim().min(2).max(10).default('bn'),
  study_hours_weekly: z.number().int().min(1).max(60).default(10)
});

export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

export const onboarding = new Hono<AppEnv>();

onboarding.use('*', requireAuth);

/** GET /v1/onboarding — retrieves learner onboarding profile status */
onboarding.get('/', async (c) => {
  const userId = c.get('userId');
  const now = new Date();

  const user = await loadUser(c.env.DB, userId, now);
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  const profile = await c.env.DB
    .prepare(
      `SELECT user_id, target_exam, target_score, target_exam_date, mother_tongue, study_hours_weekly, created_at, updated_at
       FROM learner_profiles WHERE user_id = ?1`
    )
    .bind(userId)
    .first<{
      user_id: string;
      target_exam: string;
      target_score: string;
      target_exam_date: string | null;
      mother_tongue: string;
      study_hours_weekly: number;
      created_at: string;
      updated_at: string;
    }>();

  if (!profile) {
    return c.json({
      completed: false,
      profile: null
    });
  }

  const examProfile = await c.env.DB
    .prepare(
      `SELECT id, exam_type, diagnostic_score, weak_categories, settings_json
       FROM exam_profiles WHERE user_id = ?1 AND exam_type = ?2`
    )
    .bind(userId, profile.target_exam)
    .first<{
      id: string;
      exam_type: string;
      diagnostic_score: string | null;
      weak_categories: string | null;
      settings_json: string | null;
    }>();

  return c.json({
    completed: true,
    profile: {
      userId: profile.user_id,
      targetExam: profile.target_exam,
      targetScore: profile.target_score,
      targetExamDate: profile.target_exam_date,
      motherTongue: profile.mother_tongue,
      studyHoursWeekly: profile.study_hours_weekly,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      activeExamProfile: examProfile
        ? {
            id: examProfile.id,
            examType: examProfile.exam_type,
            diagnosticScore: examProfile.diagnostic_score,
            weakCategories: examProfile.weak_categories ? JSON.parse(examProfile.weak_categories) : [],
            settings: examProfile.settings_json ? JSON.parse(examProfile.settings_json) : {}
          }
        : null
    }
  });
});

/** POST /v1/onboarding — creates or updates learner onboarding profile */
onboarding.post('/', async (c) => {
  const userId = c.get('userId');
  const now = new Date();

  const user = await loadUser(c.env.DB, userId, now);
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid JSON payload.');
  }

  const parseResult = OnboardingInputSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ApiError(400, 'INVALID_REQUEST', errorMsg);
  }

  const { target_exam, target_score, target_exam_date, mother_tongue, study_hours_weekly } = parseResult.data;
  const isoNow = now.toISOString();

  // 1. Upsert learner_profiles
  await c.env.DB
    .prepare(
      `INSERT INTO learner_profiles (
         user_id, target_exam, target_score, target_exam_date, mother_tongue, study_hours_weekly, created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
       ON CONFLICT(user_id) DO UPDATE SET
         target_exam = excluded.target_exam,
         target_score = excluded.target_score,
         target_exam_date = excluded.target_exam_date,
         mother_tongue = excluded.mother_tongue,
         study_hours_weekly = excluded.study_hours_weekly,
         updated_at = excluded.updated_at`
    )
    .bind(
      userId,
      target_exam,
      target_score,
      target_exam_date ?? null,
      mother_tongue,
      study_hours_weekly,
      isoNow
    )
    .run();

  // 2. Initialize exam_profiles if not present
  const examProfileId = `ep_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await c.env.DB
    .prepare(
      `INSERT INTO exam_profiles (
         id, user_id, exam_type, diagnostic_score, weak_categories, settings_json, created_at, updated_at
       ) VALUES (?1, ?2, ?3, NULL, '[]', '{}', ?4, ?4)
       ON CONFLICT(user_id, exam_type) DO UPDATE SET
         updated_at = excluded.updated_at`
    )
    .bind(examProfileId, userId, target_exam, isoNow)
    .run();

  return c.json({
    success: true,
    profile: {
      userId,
      targetExam: target_exam,
      targetScore: target_score,
      targetExamDate: target_exam_date ?? null,
      motherTongue: mother_tongue,
      studyHoursWeekly: study_hours_weekly,
      updatedAt: isoNow
    }
  });
});
