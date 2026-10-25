import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStaticWebHandler } from "./staticWeb.js";

describe("static web bundle", () => {
  const directories: string[] = [];
  afterEach(async () => {
    for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
  });
  async function setup() {
    const root = await mkdtemp(join(tmpdir(), "wist-web-"));
    directories.push(root);
    const webDir = join(root, "web-build");
    await mkdir(join(webDir, "_expo", "static", "js", "web"), { recursive: true });
    await writeFile(join(webDir, "index.html"), "<html>WIST</html>");
    await writeFile(join(webDir, "_expo", "static", "js", "web", "index-abc.js"), "console.log(1)");
    await writeFile(join(root, "secret.txt"), "owner token");
    return { root, webDir };
  }

  it("is absent when the bundle folder does not exist", async () => {
    const { root } = await setup();
    expect(createStaticWebHandler(join(root, "missing"))).toBeNull();
  });

  it("serves index.html for the root path", async () => {
    const { webDir } = await setup();
    const handler = createStaticWebHandler(webDir);
    const result = await handler!("GET", "/");
    expect(result).toEqual({ status: 200, contentType: "text/html; charset=utf-8", body: Buffer.from("<html>WIST</html>") });
  });

  it("serves a nested file with its content type", async () => {
    const { webDir } = await setup();
    const handler = createStaticWebHandler(webDir);
    const result = await handler!("GET", "/_expo/static/js/web/index-abc.js");
    expect(result?.contentType).toBe("text/javascript; charset=utf-8");
    expect(result?.body.toString()).toBe("console.log(1)");
  });

  it.each(["/health", "/v1/wardrobe", "/missing.js"])("leaves %s to the API", async (pathname) => {
    const { webDir } = await setup();
    const handler = createStaticWebHandler(webDir);
    await expect(handler!("GET", pathname)).resolves.toBeNull();
  });

  it("never reads outside the bundle folder", async () => {
    const { webDir } = await setup();
    const handler = createStaticWebHandler(webDir);
    await expect(handler!("GET", "/../secret.txt")).resolves.toBeNull();
    await expect(handler!("GET", "/%2e%2e/secret.txt")).resolves.toBeNull();
  });

  it("only answers GET", async () => {
    const { webDir } = await setup();
    const handler = createStaticWebHandler(webDir);
    await expect(handler!("POST", "/")).resolves.toBeNull();
  });
});
