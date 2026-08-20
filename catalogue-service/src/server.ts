import { createServer } from "node:http";
import { resolve } from "node:path";

import { handleRequest } from "./app.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";
import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";
import { startWatchScheduler } from "./watchScheduler.js";

const databasePath =
  process.env.CATALOGUE_DB_PATH ?? resolve("catalogue-service/data/wist.sqlite");
const repository = new SqliteCatalogueRepository(databasePath);
const profiles = new SqliteStyleProfileRepository(databasePath);
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const ownerToken = process.env.CATALOGUE_OWNER_TOKEN;
const watchIntervalMs = Number.parseInt(
  process.env.CATALOGUE_WATCH_INTERVAL_MS ?? String(6 * 60 * 60 * 1000),
  10,
);
if (!Number.isFinite(watchIntervalMs) || watchIntervalMs <= 0) {
  throw new Error("CATALOGUE_WATCH_INTERVAL_MS must be a positive integer");
}
const stopWatchScheduler = startWatchScheduler(repository, watchIntervalMs);

const responseHeaders = {
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

const MAX_PROFILE_BODY_BYTES = 8 * 1024;

async function readProfileBody(request: AsyncIterable<unknown>) {
  const chunks: Buffer[] = [];
  let bytesRead = 0;
  let bodyTooLarge = false;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    bytesRead += buffer.byteLength;
    if (bytesRead > MAX_PROFILE_BODY_BYTES) {
      bodyTooLarge = true;
      chunks.length = 0;
    } else if (!bodyTooLarge) {
      chunks.push(buffer);
    }
  }

  return bodyTooLarge
    ? { bodyTooLarge: true }
    : { body: Buffer.concat(chunks).toString("utf8") };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, responseHeaders);
    response.end();
    return;
  }

  try {
    const requestOptions =
      request.method === "PUT" &&
      new URL(request.url ?? "/", "http://catalogue.local").pathname ===
        "/v1/profile"
        ? await readProfileBody(request)
        : {};
    const result = await handleRequest(
      request.method ?? "GET",
      request.url ?? "/",
      repository,
      {
        authorization: request.headers.authorization,
        ownerToken,
      },
      { ...requestOptions, profiles },
    );
    response.writeHead(result.status, responseHeaders);
    response.end(JSON.stringify(result.body));
  } catch {
    response.writeHead(500, responseHeaders);
    response.end(JSON.stringify({ error: "internal_error" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Wist catalogue listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  stopWatchScheduler();
  server.close(() => {
    profiles.close();
    repository.close();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
