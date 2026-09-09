import type { Alert } from "./types";

type SelectPriceDropAnnouncementsArgs = {
  /** The catalogue's current alert window, newest first. */
  alerts: Alert[];
  /** Of those, the drops whose product can currently be named to the user. */
  announceableAlertIds: string[];
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
// The remembered set is scoped to the catalogue's current alert window rather
// than accumulating forever, which keeps it bounded without an arbitrary cap.
// Forgetting is only safe because that window slides one way: the catalogue
// returns its newest 100 alerts over immutable rows, so an alert that falls out
// can never become recent again and reappear. Pass that response straight in —
// never the store's merged alert list, which mixes in locally retained alerts
// and would let a forgotten identifier resurface and announce twice.
export function selectPriceDropAnnouncements({
  alerts,
  announceableAlertIds,
  baselineEstablished,
  notifiedAlertIds,
}: SelectPriceDropAnnouncementsArgs): PriceDropAnnouncementPlan {
  const alreadyNotified = new Set(notifiedAlertIds);

  // The baseline records the entire window, describable or not: everything that
  // already exists at that moment is history and must never announce.
  if (!baselineEstablished) {
    return { announce: [], notifiedAlertIds: alerts.map((alert) => alert.id) };
  }

  const announceable = new Set(announceableAlertIds);
  const announce = alerts.filter(
    (alert) => announceable.has(alert.id) && !alreadyNotified.has(alert.id),
  );
  const announced = new Set(announce.map((alert) => alert.id));

  return {
    announce,
    // Remember a window entry only once it has actually been announced. Keeping
    // previously announced entries — even ones no longer describable — stops a
    // product that vanishes and returns from announcing its drop twice, while
    // omitting never-announced ones keeps them eligible for a later round.
    notifiedAlertIds: alerts
      .filter((alert) => alreadyNotified.has(alert.id) || announced.has(alert.id))
      .map((alert) => alert.id),
  };
}
