type Rule = { allow: boolean; pattern: string };

function parseRules(robotsTxt: string, userAgentToken: string): Rule[] {
  const token = userAgentToken.toLowerCase();
  const specific: Rule[] = [];
  const wildcard: Rule[] = [];
  let agents: string[] = [];
  let collectingAgents = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!collectingAgents) agents = [];
      agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if ((field !== "allow" && field !== "disallow") || value === "") continue;

    const rule = { allow: field === "allow", pattern: value };
    if (agents.includes(token)) specific.push(rule);
    if (agents.includes("*")) wildcard.push(rule);
  }

  return specific.length > 0 ? specific : wildcard;
}

function matchLength(pattern: string, path: string): number {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const expression = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const matches = new RegExp(`^${expression}${anchored ? "$" : ""}`).test(path);
  return matches ? body.length : -1;
}

/** Pure robots.txt check: longest matching rule wins, Allow wins a tie. */
export function isAllowedByRobots(
  robotsTxt: string,
  userAgentToken: string,
  path: string,
): boolean {
  let best = { length: -1, allow: true };
  for (const rule of parseRules(robotsTxt, userAgentToken)) {
    const length = matchLength(rule.pattern, path);
    if (length > best.length || (length === best.length && length >= 0 && rule.allow)) {
      best = { length, allow: rule.allow };
    }
  }
  return best.allow;
}
