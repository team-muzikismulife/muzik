import https from "node:https";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
export async function versionServer() {
  const root = path.resolve(import.meta.dirname, "../../scratch/pwa-versions");
  await fs.mkdir(root, { recursive: true });
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      path.join(root, "local.key"),
      "-out",
      path.join(root, "local.crt"),
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  let version = "a";
  const server = https.createServer(
    {
      key: await fs.readFile(path.join(root, "local.key")),
      cert: await fs.readFile(path.join(root, "local.crt")),
    },
    async (req, res) => {
      try {
        const pathname = new URL(req.url!, "https://127.0.0.1:4174").pathname;
        const base = path.join(root, version);
        const file = path.resolve(base, "." + decodeURIComponent(pathname));
        if (!file.startsWith(base + path.sep) && file !== base) {
          res.writeHead(403).end();
          return;
        }
        const staticFile = /\.[a-z0-9]+$/i.test(pathname);
        const target = staticFile ? file : path.join(base, "index.html");
        const body = await fs.readFile(target);
        const types: Record<string, string> = {
          ".js": "text/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".png": "image/png",
          ".woff2": "font/woff2",
          ".webmanifest": "application/manifest+json",
        };
        res
          .writeHead(200, {
            "Content-Type":
              types[path.extname(target)] || "application/octet-stream",
            "Cache-Control": "no-store",
          })
          .end(body);
      } catch {
        res.writeHead(404).end();
      }
    },
  );
  await new Promise<void>((resolve) =>
    server.listen(4174, "127.0.0.1", resolve),
  );
  return {
    version: (v: "a" | "b") => {
      version = v;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
