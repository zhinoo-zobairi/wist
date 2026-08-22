import type { Occasion, Style, StyleProfile } from "./types";

type CommitStyleProfileArgs = {
  occasions: Occasion[];
  styles: Style[];
  save: (occasions: Occasion[], styles: Style[]) => Promise<StyleProfile>;
  apply: (occasions: Occasion[], styles: Style[]) => void;
};

// Optimistic write: store the answers locally first so the user always leaves
// onboarding — even offline — then sync to the catalogue and reconcile with the
// canonical response. A sync failure rejects for the caller to surface, but the
// local answers are already applied, so the user is never trapped in the wizard.
export async function commitStyleProfile({
  occasions,
  styles,
  save,
  apply,
}: CommitStyleProfileArgs): Promise<void> {
  apply(occasions, styles);
  const profile = await save(occasions, styles);
  apply(profile.occasions, profile.styles);
}
