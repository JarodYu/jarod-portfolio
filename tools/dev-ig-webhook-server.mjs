import http from "node:http";
import { GET, POST } from "../api/ig-webhook.js";

const port = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  try {
    const url = `http://localhost:${port}${req.url}`;

    if (!req.url.startsWith("/api/ig-webhook")) {
      send(res, new Response("Not found", { status: 404 }));
      return;
    }

    if (req.method === "GET") {
      send(res, await GET(new Request(url, { method: "GET", headers: req.headers })));
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      send(
        res,
        await POST(
          new Request(url, {
            method: "POST",
            headers: req.headers,
            body
          })
        )
      );
      return;
    }

    send(res, new Response("Method not allowed", { status: 405 }));
  } catch (error) {
    console.error(error);
    send(res, Response.json({ error: "Local server error" }, { status: 500 }));
  }
});

server.listen(port, () => {
  console.log(`IG webhook dev server running at http://localhost:${port}/api/ig-webhook`);
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function send(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
}
