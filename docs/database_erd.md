# LexiFlow AI — Database Architecture & ERD (Phase 0 Foundation)

**Target:** Cloudflare D1 (Serverless SQLite at the edge)  
**Schema Version:** 0004_phase0_foundation.sql  
**Status:** Approved  

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    users ||--o| learner_profiles : "has profile"
    users ||--o{ exam_profiles : "configures"
    users ||--o{ mistake_memories : "tracks"
    users ||--o{ error_occurrences : "commits"
    users ||--o{ usage_records : "incurs"
    
    error_taxonomies ||--o{ error_occurrences : "categorizes"
    error_taxonomies ||--o{ mistake_memories : "defines"
    
    mistake_memories ||--o{ review_schedules : "schedules FSRS"
    
    users {
        string id PK "usr_xxx"
        string email
        string plan "free | pro"
        string created_at
    }
    
    learner_profiles {
        string user_id PK,FK
        string target_exam "pte_academic | ielts_academic"
        string target_score
        string target_exam_date
        string mother_tongue "bn"
        int study_hours_weekly
    }
    
    exam_profiles {
        string id PK
        string user_id FK
        string exam_type
        string diagnostic_score
        string weak_categories "JSON"
    }
    
    error_taxonomies {
        string code PK "GRA.SUBJ_VERB_AGR"
        string version PK "1.0.0"
        string category "GRA | VOC | MEC | PTE | IELTS"
        string severity "low | medium | high | critical"
        string definition
    }
    
    error_occurrences {
        string id PK "occ_xxx"
        string user_id FK
        string error_code FK
        string task_id "ielts_writing_task_2"
        string evidence_text
        string corrected_text
    }
    
    mistake_memories {
        string id PK "mm_xxx"
        string user_id FK
        string error_code FK
        string mastery_state "New | Practising | Improving | Mastered | Reopened"
        int total_occurrences
        int successful_corrections
        string last_seen_at
    }
    
    review_schedules {
        string id PK "rev_xxx"
        string mistake_memory_id FK
        string due_date
        int interval_days "1 | 3 | 7 | 21"
        float stability
        float difficulty
        float retrievability
    }
    
    usage_records {
        string id PK "rec_xxx"
        string user_id FK
        string task_id
        string provider "gemini | anthropic | openai"
        string model
        int prompt_tokens
        int completion_tokens
        float estimated_cost_usd
        string prompt_version
        string rubric_version
        string taxonomy_version
    }
```

---

## 2. Staging Strategy for Future Phases

- **Phase 1 (Writing):**
  - Add `questions` (prompt, rubrics, task_type).
  - Add `responses` (learner essay text, word_count, time_spent_seconds).
  - Add `evaluations` (score_range, confidence, evidence_json, model_version).
  - Add `content_assets` (sample band 8 essays, annotated model responses).

- **Phase 2 (Speaking):**
  - Add `recordings` (audio_url in R2, mime_type, duration_seconds, sample_rate, size_bytes).
  - Add `transcripts` (raw text, confidence).
  - Add `timestamps` (word-level start/end ms offsets).
  - Add `pronunciations` (phoneme scores, acoustic fluency, pause duration metrics).

- **Phase 3 (Reading & Listening):**
  - Add `answer_keys` (deterministic values, accepted variations, partial credit rules).
  - Add `scoring_records` (item-level right/wrong, time_taken).

- **Phase 4 (Validation & Monetization):**
  - Add `subscriptions` (provider, tier, status, period_end).
  - Add `billing` (invoices, transaction logs).
