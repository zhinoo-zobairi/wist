import { createServer } from "node:http";
import { resolve } from "node:path";

import { handleRequest } from "./app.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";

const databasePath =
  process.env.CATALOGUE_DB_PATH ?? resolve("catalogue-service/data/wist.sqlite");
const repository = new SqliteCatalogueRepository(databasePath);
const port = Number.parseInt(process.env.PORT ?? "4000", 10);

const server = createServer(async (request, response) => {
  try {
    const result = await handleRequest(
      request.method ?? "GET",
      request.url ?? "/",
      repository,
    );
    response.writeHead(result.status, {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    });
    response.end(JSON.stringify(result.body));
  } catch {
    response.writeHead(500, {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    });
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
