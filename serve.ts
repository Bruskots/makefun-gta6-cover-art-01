// A tiny static file server for trying the app locally:
//   node serve.ts [--port 8080]
// Serves app/ at http://localhost:8080. Development convenience only —
// the app itself needs no server at all once opened from any static host.

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("./app", import.meta.url)));

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
};

function safePath(urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const joined = normalize(join(appRoot, decoded === "/" ? "index.html" : decoded));
  return joined === appRoot || joined.startsWith(appRoot + sep) ? joined : null;
}

const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const wanted = portFlag === -1 ? 8080 : Number(args[portFlag + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

createServer((req, res) => {
  const path = safePath(req.url ?? "/");
  if (!path) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("forbidden");
    return;
  }
  try {
    const info = statSync(path);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, { "content-type": mimeTypes[extname(path)] ?? "application/octet-stream" });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  }
}).listen(port, () => console.log(`Vice Cover Studio at http://localhost:${port}`));
