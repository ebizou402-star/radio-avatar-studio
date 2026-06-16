import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const mimeByExt = new Map([
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const readText = (file) => fs.readFileSync(path.join(root, file), "utf8");
const cspHash = (value) => {
  return `sha256-${crypto.createHash("sha256").update(value).digest("base64")}`;
};
const readAssetDataUri = (file) => {
  const ext = path.extname(file).toLowerCase();
  const mime = mimeByExt.get(ext);

  if (!mime) {
    throw new Error(`Unsupported asset type: ${file}`);
  }

  const data = fs.readFileSync(path.join(root, file)).toString("base64");
  return `data:${mime};base64,${data}`;
};

let html = readText("index.html");
const css = readText("styles.css");
const js = readText("app.js");
const cssBlock = `\n${css}\n`;
const jsBlock = `\n${js.replaceAll("</script>", "<\\/script>")}\n`;
const csp = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  `script-src '${cspHash(jsBlock)}'`,
  `style-src '${cspHash(cssBlock)}'`,
  "img-src 'self' data:",
  "media-src 'self' blob: data:",
  "connect-src 'self' stun:",
  "worker-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

html = html.replace(
  /content="default-src [^"]+"/,
  `content="${csp}"`,
);

html = html.replace(
  /<link rel="stylesheet" href="styles\.css\?v=\d+" \/>/,
  `<style>${cssBlock}</style>`,
);

html = html.replace(
  /<script src="app\.js\?v=\d+" type="module"><\/script>/,
  `<script type="module">${jsBlock}</script>`,
);

html = html.replace(/src="(assets\/[^"]+?)\?v=\d+"/g, (_match, assetPath) => {
  return `src="${readAssetDataUri(assetPath)}"`;
});

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), html);

const bytes = fs.statSync(path.join(distDir, "index.html")).size;
console.log(`dist/index.html ${bytes} bytes`);
