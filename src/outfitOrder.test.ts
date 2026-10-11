import { describe, expect, it } from "vitest";
import { orderForToday } from "./outfitOrder";

const outfits = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((outfit) => outfit.id);

describe("orderForToday", () => {
  it("puts ranked outfits first in the pick's order and keeps the rest in server order", () => {
    expect(ids(orderForToday(outfits("newest", "b", "a", "older"), ["a", "deleted", "b"])))
      .toEqual(["a", "b", "newest", "older"]);
  });

  it("keeps the server order without a pick", () => {
    expect(ids(orderForToday(outfits("c", "b", "a"), null))).toEqual(["c", "b", "a"]);
  });

  it("uses the first position of a repeated id", () => {
    expect(ids(orderForToday(outfits("a", "b"), ["b", "a", "b"]))).toEqual(["b", "a"]);
  });

  it("does not mutate the input", () => {
    const list = outfits("b", "a");
    orderForToday(list, ["a", "b"]);
    expect(ids(list)).toEqual(["b", "a"]);
  });
});
