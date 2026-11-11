# TICKET LF-003: Audio Foundation — Mobile Recording, Playback & R2 Prototype
**Phase:** 0 (Foundation)  
**Depends on:** LF-001, LF-002  
**Assigned Agent:** Builder Agent  
**Status:** In Progress  

---

## 1. Context & Reference Reading
- **Read First:**
  - `PRODUCT.md` §3 (Audio & Speaking Engine foundations)
  - `ARCHITECTURE.md` §1 (Layer 1 Presentation: Audio Engine & HTML5 MediaRecorder)
  - `DECISIONS.md` (ADR-004: Audio Pipeline, Mobile Recording & 90-Day Retention)
  - `AGENTS.md` §2.4 (Zero secrets in client code)

---

## 2. Goal
Fulfill the Phase 0 Exit Gate audio requirement:
1. **Client Audio Recording Engine (`src/services/audio/recorder.ts`)**:
   - Reliable HTML5 `MediaRecorder` capture optimized for mobile browsers (iOS Safari, Android Chrome).
   - Audio format negotiation: `audio/webm;codecs=opus` $\rightarrow$ `audio/mp4` $\rightarrow$ `audio/ogg`.
   - Audio waveform amplitude detection, live timer, and state management (`inactive`, `recording`, `paused`).
2. **Audio Playback Engine (`src/services/audio/player.ts`)**:
   - Smooth audio playback from local Blobs or remote URLs.
   - Event listeners for time updates, duration, buffering, and playback end.
3. **Backend Audio Upload Endpoint (`server/src/routes/audio.ts`)**:
   - `POST /v1/audio/upload`: Accepts audio uploads with metadata (`taskId`, `durationSeconds`, `mimeType`).
   - Enforces 10MB maximum file size limit (PTE/IELTS speaking responses are $\le 90$ seconds).
   - Simulates or stores into Cloudflare R2 storage with 90-day retention tags.
   - `GET /v1/audio/:id`: Secure audio retrieval.

---

## 3. Must Have (Acceptance Criteria)
- [ ] Client `AudioRecorder` captures audio streams without clipping or memory leaks.
- [ ] Mime-type fallback negotiation works across mobile and desktop browsers.
- [ ] Error handling for denied microphone permissions (`NotAllowedError`, `NotFoundError`).
- [ ] Live duration and volume level calculation.
- [ ] Backend route `POST /v1/audio/upload` validates file size $\le 10$MB and valid audio mime types.
- [ ] Tests covering recording lifecycle, mime negotiation, upload payload, and 90-day retention metadata.

---

## 4. Tests
- **Unit & Integration Tests (`server/test/audio.test.ts` & `src/services/audio/__tests__/audioFoundation.test.ts`):**
  1. `happy_path_recording_and_playback`: Start recording $\rightarrow$ collect chunks $\rightarrow$ stop $\rightarrow$ produce valid Blob $\rightarrow$ playback.
  2. `mime_type_negotiation`: Detects supported audio format on the current platform.
  3. `permission_denied_handling`: Gracefully catches and surfaces mic permission errors.
  4. `backend_upload_validation`: Successfully uploads audio blob and receives asset ID + 90-day expiry timestamp.
  5. `backend_size_limit_rejection`: Rejects audio payloads exceeding 10MB with 400 Bad Request.

---

## 5. Out of Scope
- Speech-to-Text (STT) Whisper/Azure integration (Deferred to Phase 2: LF-020+).
- Phoneme pronunciation scoring logic (Deferred to Phase 2).

---

## 6. Done When
- [ ] Passes all 8 criteria in `DEFINITION_OF_DONE.md`.
- [ ] Phase 0 exit gate requirement for audio prototype fulfilled.
- [ ] 0 type errors on `npm run typecheck`.
- [ ] All tests passing on CI.
