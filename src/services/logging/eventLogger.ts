/**
 * LexiFlow 2.0 - Minimal Event Logger Service
 *
 * Privacy-first telemetry recording exclusively the 5 approved product lifecycle events:
 * 1. popup_shown
 * 2. mode_changed
 * 3. word_saved
 * 4. review_completed
 * 5. report_submitted
 *
 * PRIVACY GUARANTEES:
 * - NO page URLs, domains, or browsing history
 * - NO user text, selected words, sentences, or paragraphs
 * - NO personal identification or notes content
 *
 * RETENTION STRATEGY:
 * - Permanent daily aggregate counters (immune to FIFO cap so pilot metrics never roll over)
 * - Large 5,000 raw event circular buffer for detailed session analytics
 */

export type ApprovedEventName =
  | 'popup_shown'
  | 'mode_changed'
  | 'word_saved'
  | 'review_completed'
  | 'report_submitted';

export interface PopupShownPayload {
  selectionType: 'word' | 'phrase' | 'sentence' | 'paragraph';
  triggerMode?: string;
  readingMode?: 'quick' | 'learn';
}

export interface ModeChangedPayload {
  from: 'quick' | 'learn';
  to: 'quick' | 'learn';
}

export interface WordSavedPayload {
  selectionType: 'word' | 'phrase' | 'sentence' | 'paragraph';
  hasContext: boolean;
  readingMode?: 'quick' | 'learn';
}

export interface ReviewCompletedPayload {
  rating: 1 | 2 | 3 | 4;
  elapsedDays?: number;
  scheduledDays?: number;
}

export interface ReportSubmittedPayload {
  reason: string;
  hasUserNote: boolean;
  hasContextSentence: boolean;
}

export type EventPayloadMap = {
  popup_shown: PopupShownPayload;
  mode_changed: ModeChangedPayload;
  word_saved: WordSavedPayload;
  review_completed: ReviewCompletedPayload;
  report_submitted: ReportSubmittedPayload;
};

export interface LoggedEvent<T extends ApprovedEventName = ApprovedEventName> {
  id: string;
  event: T;
  timestamp: string;
  data: EventPayloadMap[T];
}

export interface DailyAggregateCounter {
  date: string; // YYYY-MM-DD
  totals: Record<ApprovedEventName, number>;
  breakdowns: {
    popup_by_mode: Record<string, number>;
    popup_by_type: Record<string, number>;
    reviews_by_rating: Record<string, number>;
  };
}

export interface EventLogStore {
  version: 1;
  dailyAggregates: Record<string, DailyAggregateCounter>;
  events: LoggedEvent[];
  lastUpdated: string;
}

const STORAGE_KEY = 'lexiflow_telemetry_events';
const MAX_RAW_EVENTS = 5000;

// Memory fallback for tests and environments without chrome.storage
let memoryStore: EventLogStore = {
  version: 1,
  dailyAggregates: {},
  events: [],
  lastUpdated: new Date().toISOString()
};

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyDailyAggregate(date: string): DailyAggregateCounter {
  return {
    date,
    totals: {
      popup_shown: 0,
      mode_changed: 0,
      word_saved: 0,
      review_completed: 0,
      report_submitted: 0
    },
    breakdowns: {
      popup_by_mode: {},
      popup_by_type: {},
      reviews_by_rating: {}
    }
  };
}

/**
 * Sanitizes payload to ensure NO URLs, selected text, or user notes ever leak.
 */
function sanitizePayload<T extends ApprovedEventName>(event: T, raw: unknown): EventPayloadMap[T] {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  switch (event) {
    case 'popup_shown': {
      const validTypes = ['word', 'phrase', 'sentence', 'paragraph'];
      const st = validTypes.includes(String(data.selectionType))
        ? (data.selectionType as PopupShownPayload['selectionType'])
        : 'word';
      return {
        selectionType: st,
        triggerMode: typeof data.triggerMode === 'string' ? data.triggerMode : undefined,
        readingMode: data.readingMode === 'learn' ? 'learn' : 'quick'
      } as EventPayloadMap[T];
    }
    case 'mode_changed': {
      return {
        from: data.from === 'learn' ? 'learn' : 'quick',
        to: data.to === 'learn' ? 'learn' : 'quick'
      } as EventPayloadMap[T];
    }
    case 'word_saved': {
      const validTypes = ['word', 'phrase', 'sentence', 'paragraph'];
      const st = validTypes.includes(String(data.selectionType))
        ? (data.selectionType as WordSavedPayload['selectionType'])
        : 'word';
      return {
        selectionType: st,
        hasContext: Boolean(data.hasContext),
        readingMode: data.readingMode === 'learn' ? 'learn' : 'quick'
      } as EventPayloadMap[T];
    }
    case 'review_completed': {
      const r = Number(data.rating);
      const validRating = ([1, 2, 3, 4].includes(r) ? r : 3) as 1 | 2 | 3 | 4;
      return {
        rating: validRating,
        elapsedDays: typeof data.elapsedDays === 'number' ? data.elapsedDays : undefined,
        scheduledDays: typeof data.scheduledDays === 'number' ? data.scheduledDays : undefined
      } as EventPayloadMap[T];
    }
    case 'report_submitted': {
      return {
        reason: typeof data.reason === 'string' ? data.reason.slice(0, 50) : 'wrong_meaning',
        hasUserNote: Boolean(data.hasUserNote),
        hasContextSentence: Boolean(data.hasContextSentence)
      } as EventPayloadMap[T];
    }
    default:
      throw new Error(`Unauthorized event: ${String(event)}`);
  }
}

export class EventLogger {
  /**
   * Retrieves current event store from storage or memory fallback.
   */
  static async getStore(): Promise<EventLogStore> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise<EventLogStore>((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          const raw = res?.[STORAGE_KEY] as Record<string, unknown> | undefined;
          if (raw && typeof raw === 'object' && raw.version === 1) {
            resolve(raw as unknown as EventLogStore);
          } else {
            resolve({
              version: 1,
              dailyAggregates: {},
              events: [],
              lastUpdated: new Date().toISOString()
            });
          }
        });
      });
    }
    return JSON.parse(JSON.stringify(memoryStore));
  }

  /**
   * Persists event store to storage or memory fallback.
   */
  private static async saveStore(store: EventLogStore): Promise<void> {
    store.lastUpdated = new Date().toISOString();
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: store }, () => resolve());
      });
    } else {
      memoryStore = JSON.parse(JSON.stringify(store));
    }
  }

  /**
   * Records one of the 5 approved events with strict sanitization and aggregate counters.
   */
  static async log<T extends ApprovedEventName>(event: T, rawData: EventPayloadMap[T]): Promise<LoggedEvent<T>> {
    const sanitized = sanitizePayload(event, rawData);
    const store = await this.getStore();
    const today = getTodayKey();
    const nowIso = new Date().toISOString();

    // 1. Update daily aggregate counter
    if (!store.dailyAggregates[today]) {
      store.dailyAggregates[today] = createEmptyDailyAggregate(today);
    }
    const dayCounter = store.dailyAggregates[today];
    dayCounter.totals[event] = (dayCounter.totals[event] || 0) + 1;

    // Sub-breakdowns
    if (event === 'popup_shown') {
      const p = sanitized as PopupShownPayload;
      if (p.readingMode) {
        dayCounter.breakdowns.popup_by_mode[p.readingMode] = (dayCounter.breakdowns.popup_by_mode[p.readingMode] || 0) + 1;
      }
      if (p.selectionType) {
        dayCounter.breakdowns.popup_by_type[p.selectionType] = (dayCounter.breakdowns.popup_by_type[p.selectionType] || 0) + 1;
      }
    } else if (event === 'review_completed') {
      const r = sanitized as ReviewCompletedPayload;
      const key = String(r.rating);
      dayCounter.breakdowns.reviews_by_rating[key] = (dayCounter.breakdowns.reviews_by_rating[key] || 0) + 1;
    }

    // 2. Append event to circular raw events buffer (capped at MAX_RAW_EVENTS)
    const logged: LoggedEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      event,
      timestamp: nowIso,
      data: sanitized
    };

    store.events.push(logged as LoggedEvent);
    if (store.events.length > MAX_RAW_EVENTS) {
      store.events = store.events.slice(-MAX_RAW_EVENTS);
    }

    await this.saveStore(store);
    return logged;
  }

  /**
   * Returns list of daily aggregate summaries across all recorded pilot days.
   */
  static async getDailyAggregates(): Promise<DailyAggregateCounter[]> {
    const store = await this.getStore();
    return Object.values(store.dailyAggregates).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Returns all stored events up to the 5,000 cap.
   */
  static async getEvents(limit?: number): Promise<LoggedEvent[]> {
    const store = await this.getStore();
    if (typeof limit === 'number' && limit > 0) {
      return store.events.slice(-limit);
    }
    return store.events;
  }

  /**
   * Exports event telemetry store as formatted JSON string.
   * Completely separate from feedback reports export.
   */
  static async exportLogsAsJson(): Promise<string> {
    const store = await this.getStore();
    const exportPayload = {
      format: 'lexiflow_telemetry_export',
      version: 1,
      exportedAt: new Date().toISOString(),
      summary: {
        totalDaysRecorded: Object.keys(store.dailyAggregates).length,
        totalRawEvents: store.events.length
      },
      dailyAggregates: store.dailyAggregates,
      events: store.events
    };
    return JSON.stringify(exportPayload, null, 2);
  }

  /**
   * Resets all stored telemetry events and daily counters.
   */
  static async clearLogs(): Promise<void> {
    const freshStore: EventLogStore = {
      version: 1,
      dailyAggregates: {},
      events: [],
      lastUpdated: new Date().toISOString()
    };
    await this.saveStore(freshStore);
  }

  /**
   * Resets in-memory store (for testing purposes).
   */
  static resetMemoryStore(): void {
    memoryStore = {
      version: 1,
      dailyAggregates: {},
      events: [],
      lastUpdated: new Date().toISOString()
    };
  }
}
