import { runDueSchedules } from './store';

/**
 * Checks once a minute whether a report schedule is due and sends it. It lives inside the portal's own server (no external cron);
 * a schedule that was due while the server was down is sent when the server is back, if it is still the same day.
 */
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;

export function startReportScheduler(): void {
  if (timer) return;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runDueSchedules();
    } catch (error) {
      console.error('[reports] scheduler error:', error instanceof Error ? error.message : error);
    } finally {
      busy = false;
    }
  };
  timer = setInterval(() => void tick(), 60_000);
  timer.unref?.();
  void tick();
}

export function stopReportScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
