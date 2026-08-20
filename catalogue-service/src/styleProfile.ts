export const OCCASIONS = [
  "work",
  "evening",
  "weekend",
  "celebration",
  "travel",
] as const;

export const STYLES = [
  "minimal",
  "tailored",
  "romantic",
  "utilitarian",
  "bold",
  "eclectic",
] as const;

export type Occasion = (typeof OCCASIONS)[number];
export type Style = (typeof STYLES)[number];

export type StyleProfileSelection = {
  occasions: Occasion[];
  styles: Style[];
};

export type StyleProfile = StyleProfileSelection & {
  updatedAt: string;
};

function isUnique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

export function parseStyleProfile(
  value: unknown,
): StyleProfileSelection | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.occasions) || !Array.isArray(candidate.styles)) {
    return null;
  }
  if (
    candidate.occasions.length > OCCASIONS.length ||
    candidate.styles.length > 3 ||
    !isUnique(candidate.occasions) ||
    !isUnique(candidate.styles)
  ) {
    return null;
  }

  const occasions = new Set(candidate.occasions);
  const styles = new Set(candidate.styles);
  if (
    candidate.occasions.some((occasion) =>
      !OCCASIONS.includes(occasion as Occasion),
    ) ||
    candidate.styles.some((style) => !STYLES.includes(style as Style))
  ) {
    return null;
  }

  return {
    occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
    styles: STYLES.filter((style) => styles.has(style)),
  };
}
