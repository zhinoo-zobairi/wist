import { useWindowDimensions, type ViewStyle } from "react-native";

import { spacing } from "./theme";

export const WIDE_BREAKPOINT = 720;
export const CONTENT_MAX_WIDTH = 1200;
export const READING_MAX_WIDTH = 760;

export type Layout = { wide: boolean; width: number };

/** `wide` is the web/desktop layout; `compact` is the phone layout, unchanged on iOS. */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return { wide: width >= WIDE_BREAKPOINT, width };
}

/**
 * Centres a screen's content on wide windows. Inner components keep their
 * compact 22 px gutter, so the page only adds the rest to reach 40 px.
 */
export function pageStyle({ wide }: Layout, reading = false): ViewStyle {
  if (!wide) return {};
  return {
    alignSelf: "center",
    maxWidth: reading ? READING_MAX_WIDTH : CONTENT_MAX_WIDTH,
    paddingHorizontal: spacing.gutterWide - spacing.gutter,
    width: "100%",
  };
}
