import fs from "node:fs/promises";
for (const file of process.argv.slice(2)) {
  const raw = await fs.readFile(file, "utf8").catch(() => "로그 없음");
  const lines = raw.split(/\r?\n/).map((line) =>
    /(?:key|secret|token|password|bearer|postgres(?:ql)?:\/\/)/i.test(line)
      ? "[credential-bearing line omitted]"
      : line.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]"),
  );
  console.log(lines.slice(-60).join("\n"));
}
