import type { Alert } from "./types";

type SelectPriceDropAnnouncementsArgs = {
  alerts: Alert[];
  baselineEstablished: boolean;
  notifiedAlertIds: string[];
};

export type PriceDropAnnouncementPlan = {
  announce: Alert[];
  notifiedAlertIds: string[];
};

// Delivery state belongs to the device that delivers, so the app — not the
// catalogue — remembers which drops it has already announced.
//
// The first synchronization is deliberately silent: it only records a baseline.
// Without it, a fresh install (or a reinstall) would announce the catalogue's
// whole alert history at once, because every persisted drop looks new.
//
// The remembered set mirrors the catalogue's current alert window rather than
// accumulating forever. Every alert in a post-baseline batch has either been
// announced before or is being announced now, so the window *is* the answer,
// and identifiers the catalogue has dropped can be forgotten. That keeps the
// persisted set naturally bounded without an arbitrary cap.
export function selectPriceDropAnnouncements({
  alerts,
  baselineEstablished,
  notifiedAlertIds,
}: SelectPriceDropAnnouncementsArgs): PriceDropAnnouncementPlan {
  const alreadyNotified = new Set(notifiedAlertIds);
  return {
    announce: baselineEstablished
      ? alerts.filter((alert) => !alreadyNotified.has(alert.id))
      : [],
    notifiedAlertIds: alerts.map((alert) => alert.id),
  };
}
