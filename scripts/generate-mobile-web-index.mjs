#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const clientDir = path.join(distDir, "client");
function findMainIndex() {
  if (!fs.existsSync(clientDir)) return null;

  const assetsDir = path.join(clientDir, "assets");
  if (!fs.existsSync(assetsDir)) return null;

  const files = fs
    .readdirSync(assetsDir)
    .filter((name) => name.startsWith("index-") && name.endsWith(".js"))
    .map((name) => {
      const fullPath = path.join(assetsDir, name);
      const stats = fs.statSync(fullPath);
      return {
        name,
        path: fullPath,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
    })
    .filter((item) => item.size > 40);

  if (files.length === 0) return null;

  const indexFromVite = (() => {
    if (!fs.existsSync(distDir)) return null;
    const rootIndexPath = path.join(distDir, "index.html");
    if (!fs.existsSync(rootIndexPath)) return null;
    const html = fs.readFileSync(rootIndexPath, "utf8");
    const match = html.match(/<script[^>]+src=["']\.\/assets\/([^"']*index-[^"']+\.js)["']/);
    if (!match) return null;
    const candidate = match[1];
    const candidatePath = path.join(assetsDir, candidate);
    if (fs.existsSync(candidatePath)) return candidate;
    return null;
  })();

  if (indexFromVite) {
    return indexFromVite;
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs || b.size - a.size);
  return files[0].name;
}

function collectCssEntries() {
  const assetsDir = path.join(clientDir, "assets");
  if (!fs.existsSync(assetsDir)) return [];

  return fs
    .readdirSync(assetsDir)
    .filter((name) => name.startsWith("styles-") && name.endsWith(".css"));
}

function createIndexHtml(mainScriptName) {
  const cssLinks = collectCssEntries()
    .map((css) => `    <link rel="stylesheet" href="./assets/${css}" />`)
    .join("\n");
  const bootstrapScript = `<script>
    (() => {
      const pathname = window.location.pathname || "";
      const shouldNormalize =
        pathname === "/index.html" ||
        pathname === "/assets/" ||
        pathname === "/assets" ||
        pathname.endsWith("/index.html");
      if (!shouldNormalize) return;

      const nextUrl = new URL(window.location.href);
      nextUrl.pathname = "/";
      window.history.replaceState({}, "", nextUrl.pathname + nextUrl.search + nextUrl.hash);

      const existingState = window.$_TSR;
      if (!existingState) {
        window.$_TSR = {
          h() {
            this.hydrated = true;
            this.c();
          },
          e() {
            this.streamEnded = true;
            this.c();
          },
          c() {
            if (this.hydrated && this.streamEnded) {
              delete window.$_TSR;
              window.$R && delete window.$R.tsr;
            }
          },
          p(script) {
            if (!this.initialized) {
              this.buffer.push(script);
            } else {
              script();
            }
          },
          buffer: [],
          router: {
            matches: [{ i: "/" }],
            lastMatchId: "/",
            manifest: { routes: {} },
            dehydratedData: {},
          },
        };
      }
    })();
  </script>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>sumgyeol</title>
    <meta name="theme-color" content="#F9F8F6" />
${cssLinks ? `${cssLinks}\n` : ""}
${bootstrapScript}
  </head>
  <body>
    <script type="module" src="./assets/${mainScriptName}"></script>
  </body>
</html>
`;
}

const mainScript = findMainIndex();
if (!mainScript) {
  console.error("[모바일 웹 에셋] index-*.js 파일을 찾지 못했습니다. 먼저 npm run build를 실행하세요.");
  process.exit(1);
}

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });

fs.writeFileSync(path.join(clientDir, "index.html"), createIndexHtml(mainScript));
fs.writeFileSync(path.join(distDir, "index.html"), createIndexHtml(mainScript));

console.log(`[모바일 웹 에셋] 생성 완료: dist/client/index.html (module: ${mainScript})`);
