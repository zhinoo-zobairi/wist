import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

import { handleRequest } from "./app.js";
import { ClaudeGarmentTagger } from "./claudeGarmentTagger.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";
import { startOutfitScheduler } from "./outfitScheduler.js";
import { ClaudeOutfitPicker } from "./claudeOutfitPicker.js";
import { ClaudeOutfitSuggester } from "./claudeOutfitSuggester.js";
import { DiskGarmentPhotoStore, MAX_PHOTO_BYTES } from "./garmentPhotoStore.js";
import { MAX_JSON_BODY_BYTES, readRequestBody } from "./requestBody.js";
import { createDefaultPoliteFetch } from "./politeFetch.js";
import { importProduct } from "./productImport.js";
import { fetchProductObservation } from "./productObservation.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";
import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import { startWatchScheduler } from "./watchScheduler.js";
import { OpenMeteoWeatherSource } from "./weather.js";

const databasePath =
  process.env.CATALOGUE_DB_PATH ?? resolve("catalogue-service/data/wist.sqlite");
const repository = new SqliteCatalogueRepository(databasePath);
const profiles = new SqliteStyleProfileRepository(databasePath);
const wardrobe = new SqliteWardrobeRepository(databasePath);
const photoStore = new DiskGarmentPhotoStore(join(dirname(databasePath), "wardrobe-photos"));
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      authToken: null,
      baseURL: "https://api.anthropic.com",
      logLevel: "off",
    })
  : undefined;
const tagger = anthropic ? new ClaudeGarmentTagger(anthropic) : undefined;
const suggester = anthropic ? new ClaudeOutfitSuggester(anthropic) : undefined;
const picker = anthropic ? new ClaudeOutfitPicker(anthropic) : undefined;
const outfits = new SqliteOutfitRepository(databasePath);
const weatherSource = new OpenMeteoWeatherSource();
// A run cut short by a crash is marked failed at every start, with or without an API key.
// (The sqlite write happens synchronously, so it is done before the scheduler's first tick.)
outfits.failInterruptedRuns().catch((error) => {
  console.error("Failing interrupted outfit runs failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
});
// Without an API key there is no generator or picker, so no background runs and no daily pick.
// The daily pick's 06:00 is this machine's local time.
const stopOutfitScheduler = suggester && picker
  ? startOutfitScheduler({ wardrobe, outfits, profiles, suggester, weatherSource, picker })
  : () => {};
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
// One instance for the whole process, so imports and the scheduler share the per-host spacing.
const politeFetch = createDefaultPoliteFetch();
const observeProduct = (productUrl: string) => fetchProductObservation(productUrl, politeFetch);
const stopWatchScheduler = startWatchScheduler(
  repository,
  watchIntervalMs,
  undefined,
  observeProduct,
);

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
      (request.method === "PUT" && pathname === "/v1/location") ||
      (request.method === "POST" && pathname === "/v1/watches") ||
      (request.method === "POST" && (pathname === "/v1/wardrobe" || pathname === "/v1/wardrobe/from-item")) ||
      (request.method === "POST" && pathname === "/v1/outfits/saved") ||
      (request.method === "POST" && /^\/v1\/wardrobe\/[^/]+\/tag$/.test(pathname)) ||
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
        importProduct: (productUrl) => importProduct(repository, productUrl, observeProduct),
        profiles,
        wardrobe,
        photoStore,
        tagger,
        suggester,
        outfits,
      },
    );
    response.writeHead(result.status, {
      ...responseHeaders,
      "content-type": result.contentType ?? "application/json",
    });
    if (result.status === 204) response.end();
    else response.end(Buffer.isBuffer(result.body) ? result.body : JSON.stringify(result.body));
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
  stopOutfitScheduler();
  server.close(() => {
    profiles.close();
    wardrobe.close();
    outfits.close();
    repository.close();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
