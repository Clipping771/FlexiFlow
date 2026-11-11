/**
 * Daily study reminder. One repeating alarm at the learner's chosen local time; when it fires,
 * a notification is shown only if the learner has not studied yet today.
 */

export const REMINDER_ALARM = 'lexiflow_daily_reminder';
export const REMINDER_NOTIFICATION = 'lexiflow_daily_reminder_note';

/** Next time (ms) the "HH:MM" local time occurs after `now` */
export function nextReminderAt(time: string, now = new Date()): number {
  const [h, m] = time.split(':').map(Number);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function scheduleReminder(time: string | null): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  await chrome.alarms.clear(REMINDER_ALARM);
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
  chrome.alarms.create(REMINDER_ALARM, { when: nextReminderAt(time), periodInMinutes: 24 * 60 });
}

/** Should today's reminder show? Not when the learner already studied today. */
export function shouldRemind(lastActiveDay: string | undefined, now = new Date()): boolean {
  return lastActiveDay !== localDay(now);
}

export async function onReminderAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (alarm.name !== REMINDER_ALARM || typeof chrome === 'undefined' || !chrome.notifications) return;
  const stored = await chrome.storage.local.get('lexiflow_last_active_day');
  if (!shouldRemind(stored?.lexiflow_last_active_day as string | undefined)) return;
  chrome.notifications.create(REMINDER_NOTIFICATION, {
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: 'Time for English',
    message: 'Your short LexiFlow session is ready: reviews, mistake drills and practice.',
    priority: 1
  });
}

export function registerReminderHandlers(): void {
  if (typeof chrome === 'undefined') return;
  chrome.alarms?.onAlarm.addListener((alarm) => {
    void onReminderAlarm(alarm);
  });
  chrome.notifications?.onClicked.addListener((id) => {
    if (id !== REMINDER_NOTIFICATION) return;
    chrome.tabs.create({ url: 'dashboard.html' });
    chrome.notifications.clear(id);
  });
  // Re-create the alarm after an update or browser restart, from the saved goals
  const restore = async () => {
    try {
      const stored = await chrome.storage.local.get('lexiflow_learner_goals');
      const time = (stored?.lexiflow_learner_goals as { reminderTime?: string | null } | undefined)?.reminderTime ?? null;
      const existing = await chrome.alarms?.get(REMINDER_ALARM);
      if (time && !existing) await scheduleReminder(time);
    } catch {}
  };
  chrome.runtime?.onInstalled?.addListener(() => void restore());
  chrome.runtime?.onStartup?.addListener(() => void restore());
}
