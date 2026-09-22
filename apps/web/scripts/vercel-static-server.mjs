import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = path.resolve("../..");
const dist = path.resolve("dist");
const config = JSON.parse(await fs.readFile(path.join(root, "vercel.json"), "utf8"));
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};
function match(pattern, pathname) {
  if (pattern === "/(.*)") return true;
  if (pattern.endsWith("/:path*")) {
    const prefix = pattern.slice(0, -7);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  if (pattern.includes(":")) {
    const expected = pattern.split("/").filter(Boolean);
    const actual = pathname.split("/").filter(Boolean);
    return (
      expected.length === actual.length &&
      expected.every((part, index) => part.startsWith(":") || part === actual[index])
    );
  }
  return pattern === pathname;
}
function applyHeaders(response, pathname) {
  response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  for (const rule of config.headers || [])
    if (match(rule.source, pathname))
      for (const header of rule.headers) response.setHeader(header.key, header.value);
}
const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const candidate = path.resolve(dist, `.${pathname}`);
  let file = candidate;
  try {
    if (!candidate.startsWith(`${dist}${path.sep}`) && candidate !== dist) throw new Error();
    if ((await fs.stat(candidate)).isDirectory()) file = path.join(candidate, "index.html");
  } catch {
    const rewrite = (config.rewrites || []).find((rule) => match(rule.source, pathname));
    if (rewrite) file = path.join(dist, rewrite.destination);
    else {
      applyHeaders(response, pathname);
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }
  }
  try {
    const body = await fs.readFile(file);
    applyHeaders(response, pathname);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    applyHeaders(response, pathname);
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
});
server.listen(4175, "127.0.0.1", () =>
  console.log("Vercel 정적 설정 로컬 계약 서버: http://127.0.0.1:4175"),
);
