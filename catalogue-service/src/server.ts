import { createServer } from "node:http";
import { resolve } from "node:path";

import { handleRequest } from "./app.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";

const databasePath =
  process.env.CATALOGUE_DB_PATH ?? resolve("catalogue-service/data/wist.sqlite");
const repository = new SqliteCatalogueRepository(databasePath);
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const ownerToken = process.env.CATALOGUE_OWNER_TOKEN;

const responseHeaders = {
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
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
    const result = await handleRequest(
      request.method ?? "GET",
      request.url ?? "/",
      repository,
      {
        authorization: request.headers.authorization,
        ownerToken,
      },
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
  server.close(() => {
    repository.close();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
