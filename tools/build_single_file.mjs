import fs from "node:fs";
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

html = html.replace(
  /<link rel="stylesheet" href="styles\.css\?v=\d+" \/>/,
  `<style>\n${css}\n</style>`,
);

html = html.replace(
  /<script src="app\.js\?v=\d+" type="module"><\/script>/,
  `<script type="module">\n${js.replaceAll("</script>", "<\\/script>")}\n</script>`,
);

html = html.replace(/src="(assets\/[^"]+?)\?v=\d+"/g, (_match, assetPath) => {
  return `src="${readAssetDataUri(assetPath)}"`;
});

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), html);

const bytes = fs.statSync(path.join(distDir, "index.html")).size;
console.log(`dist/index.html ${bytes} bytes`);
