import { createServer } from "node:http";

import { handleRequest } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";

const repository = new SeedCatalogueRepository();
const port = Number.parseInt(process.env.PORT ?? "4000", 10);

const server = createServer(async (request, response) => {
  try {
    const result = await handleRequest(
      request.method ?? "GET",
      request.url ?? "/",
      repository,
    );
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
  } catch {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "internal_error" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Wist catalogue listening on http://127.0.0.1:${port}`);
});
