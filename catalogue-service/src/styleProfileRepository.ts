import type {
  StyleProfile,
  StyleProfileSelection,
} from "./styleProfile.js";

export interface StyleProfileRepository {
  getProfile(): Promise<StyleProfile | null>;
  replaceProfile(selection: StyleProfileSelection): Promise<StyleProfile>;
}
