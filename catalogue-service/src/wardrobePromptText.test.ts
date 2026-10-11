import { describe, expect, it } from "vitest";
import type { Garment } from "./wardrobe.js";
import { wardrobePromptText } from "./wardrobePromptText.js";

const garment: Garment = { id: "b", name: "Navy shirt", category: "top", colors: ["navy"],
  formality: "smart_casual", warmth: "light", occasions: ["work"], notes: "private notes",
  photoUrl: "/private-photo", source: "photo", catalogueItemId: "item-1", tagStatus: "tagged", createdAt: "stamp", updatedAt: "stamp" };

describe("wardrobe prompt text", () => {
  it("lists garments as ID-sorted JSON lines with only the fields Claude needs", () => {
    const text = wardrobePromptText([garment, { ...garment, id: "a", name: "Cream trousers", category: "bottom" }]);
    expect(text.split("\n")).toEqual([
      '{"id":"a","name":"Cream trousers","category":"bottom","colors":["navy"],"formality":"smart_casual","warmth":"light","occasions":["work"]}',
      '{"id":"b","name":"Navy shirt","category":"top","colors":["navy"],"formality":"smart_casual","warmth":"light","occasions":["work"]}',
    ]);
    expect(text).not.toContain("private notes");
    expect(text).not.toContain("/private-photo");
    expect(text).not.toContain("item-1");
  });

  it("does not reorder the caller's array", () => {
    const garments = [garment, { ...garment, id: "a" }];
    wardrobePromptText(garments);
    expect(garments.map((g) => g.id)).toEqual(["b", "a"]);
  });
});
