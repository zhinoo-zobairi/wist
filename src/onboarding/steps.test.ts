import { describe, expect, it } from "vitest";

import { ONBOARDING_STEPS, QUESTION_COUNT, questionNumber } from "./steps";

describe("N° 02 steps", () => {
  it("asks fourteen questions", () => {
    expect(ONBOARDING_STEPS.filter((step) => step.kind === "question")).toHaveLength(QUESTION_COUNT);
  });

  it("numbers questions and leaves interludes and the finale unnumbered", () => {
    const at = (id: string) => ONBOARDING_STEPS.findIndex((step) => step.id === id);
    expect(questionNumber(at("shopsFor"))).toBe(1);
    expect(questionNumber(at("interludeWork"))).toBeNull();
    expect(questionNumber(at("taste"))).toBe(5);
    expect(questionNumber(at("notify"))).toBe(14);
    expect(questionNumber(at("brief"))).toBeNull();
  });
});
