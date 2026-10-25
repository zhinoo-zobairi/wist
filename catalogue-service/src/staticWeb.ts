import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export interface StaticWebResponse {
  status: 200;
  contentType: string;
  body: Buffer;
}

export type StaticWebHandler = (method: string, pathname: string) => Promise<StaticWebResponse | null>;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Serves the exported WIST web bundle; null when the folder is absent, so the API runs alone. */
export function createStaticWebHandler(directory: string): StaticWebHandler | null {
  if (!existsSync(directory)) return null;
  const root = resolve(directory);
  return async (method, pathname) => {
    if (method !== "GET") return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    const filePath = resolve(root, `.${decoded === "/" ? "/index.html" : decoded}`);
    if (!filePath.startsWith(root + sep)) return null;
    const contentType = CONTENT_TYPES[extname(filePath)];
    if (!contentType) return null;
    try {
      return { status: 200, contentType, body: await readFile(filePath) };
    } catch {
      return null;
    }
  };
}
