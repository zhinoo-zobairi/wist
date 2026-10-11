import { describe, expect, it } from "vitest";

import { isAllowedByRobots } from "./politeFetch.js";

describe("isAllowedByRobots", () => {
  it("allows everything when the file is empty", () => {
    expect(isAllowedByRobots("", "WistCatalogue", "/p/1")).toBe(true);
  });

  it("lets a group for our own agent beat the * group", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: WistCatalogue",
      "Disallow: /private",
    ].join("\n");
    expect(isAllowedByRobots(robots, "WistCatalogue", "/p/1")).toBe(true);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/private/x")).toBe(false);
    expect(isAllowedByRobots(robots, "OtherBot", "/p/1")).toBe(false);
  });

  it("lets the longest matching rule win", () => {
    const robots = "User-agent: *\nDisallow: /products\nAllow: /products/public";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/products/public/1")).toBe(true);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/products/secret")).toBe(false);
  });

  it("prefers Allow when a tie in length", () => {
    const robots = "User-agent: *\nDisallow: /a\nAllow: /a";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/a")).toBe(true);
  });

  it("supports * and $ wildcards", () => {
    const robots = "User-agent: *\nDisallow: /*.json$\nDisallow: /cart*/x";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/a/b.json")).toBe(false);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/a/b.json?x=1")).toBe(true);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/cart123/x")).toBe(false);
  });

  it("ignores comments and an empty Disallow", () => {
    const robots = "User-agent: * # everyone\nDisallow:\n# nothing";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/anything")).toBe(true);
  });

  it("shares rules across stacked User-agent lines", () => {
    const robots = "User-agent: a\nUser-agent: WistCatalogue\nDisallow: /x";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/x")).toBe(false);
  });
});
