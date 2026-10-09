import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";

import { handleRequest } from "./app.js";
import { DiskGarmentPhotoStore, MAX_PHOTO_BYTES } from "./garmentPhotoStore.js";
import { MAX_JSON_BODY_BYTES, readRequestBody } from "./requestBody.js";
import { importProduct } from "./productImport.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";
import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import { startWatchScheduler } from "./watchScheduler.js";

const databasePath =
  process.env.CATALOGUE_DB_PATH ?? resolve("catalogue-service/data/wist.sqlite");
const repository = new SqliteCatalogueRepository(databasePath);
const profiles = new SqliteStyleProfileRepository(databasePath);
const wardrobe = new SqliteWardrobeRepository(databasePath);
const photoStore = new DiskGarmentPhotoStore(join(dirname(databasePath), "wardrobe-photos"));
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const ownerToken = process.env.CATALOGUE_OWNER_TOKEN;
const host = process.env.CATALOGUE_HOST ?? "127.0.0.1";
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
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, responseHeaders);
    response.end();
    return;
  }

  try {
    const pathname = new URL(
      request.url ?? "/",
      "http://catalogue.local",
    ).pathname;
    const hasJsonBody =
      (request.method === "PUT" && pathname === "/v1/profile") ||
      (request.method === "POST" && pathname === "/v1/watches") ||
      (request.method === "POST" && pathname === "/v1/wardrobe") ||
      (request.method === "PUT" && /^\/v1\/wardrobe\/[^/]+$/.test(pathname));
    const hasPhotoBody = request.method === "POST" && pathname === "/v1/wardrobe/photos";
    const requestOptions = hasJsonBody || hasPhotoBody
      ? await readRequestBody(request, hasPhotoBody ? MAX_PHOTO_BYTES : MAX_JSON_BODY_BYTES, request.headers["content-length"])
      : {};
    if (requestOptions.bodyTooLarge) request.resume();
    const result = await handleRequest(
      request.method ?? "GET",
      request.url ?? "/",
      repository,
      {
        authorization: request.headers.authorization,
        ownerToken,
      },
      {
        ...requestOptions,
        body: hasJsonBody ? requestOptions.bodyBytes?.toString("utf8") : undefined,
        contentType: request.headers["content-type"],
        importProduct: (productUrl) => importProduct(repository, productUrl),
        profiles,
        wardrobe,
        photoStore,
      },
    );
    response.writeHead(result.status, {
      ...responseHeaders,
      "content-type": result.contentType ?? "application/json",
    });
    response.end(Buffer.isBuffer(result.body) ? result.body : JSON.stringify(result.body));
  } catch {
    response.writeHead(500, responseHeaders);
    response.end(JSON.stringify({ error: "internal_error" }));
  }
});

server.listen(port, host, () => {
  console.log(`Wist catalogue listening on http://${host}:${port}`);
});

function shutdown() {
  stopWatchScheduler();
  server.close(() => {
    profiles.close();
    wardrobe.close();
    repository.close();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
