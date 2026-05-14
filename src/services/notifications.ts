// Daily review reminder via tauri-plugin-notification.
//
// Behavior: on app startup we look at the last toast date stored in
// localStorage. If today is a new day AND there are due cards, fire one toast.
// Permission is requested lazily on first use.

import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

const LAST_TOAST_KEY = "lingosnap:last-review-toast";

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export async function maybeFireDailyReviewToast(dueCount: number): Promise<void> {
  if (dueCount <= 0) return;

  const last = localStorage.getItem(LAST_TOAST_KEY);
  if (last === todayKey()) return;

  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === "granted";
    }
    if (!granted) return;

    await sendNotification({
      title: "LingoSnap — Tekrar Zamanı",
      body: `${dueCount} kart bugün seni bekliyor.`,
    });
    localStorage.setItem(LAST_TOAST_KEY, todayKey());
  } catch {
    // Notifications optional; never throw to caller.
  }
}
