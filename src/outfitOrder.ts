/** Ranked outfits first, in the pick's order; the rest keep the server's order (newest first). */
export function orderForToday<T extends { id: string }>(outfits: readonly T[], order: readonly string[] | null): T[] {
  if (order === null) return [...outfits];
  const rank = new Map<string, number>();
  order.forEach((id, index) => { if (!rank.has(id)) rank.set(id, index); });
  const ranked = outfits.filter((outfit) => rank.has(outfit.id))
    .sort((left, right) => rank.get(left.id)! - rank.get(right.id)!);
  return [...ranked, ...outfits.filter((outfit) => !rank.has(outfit.id))];
}
