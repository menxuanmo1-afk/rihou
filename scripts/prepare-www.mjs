import { mkdir, copyFile, cp, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "www");

await cp(join(root, "css"), join(dest, "css"), { recursive: true, force: true });
await cp(join(root, "js"), join(dest, "js"), { recursive: true, force: true });
await mkdir(dest, { recursive: true });

for (const name of [
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
]) {
  await copyFile(join(root, name), join(dest, name));
}

let html = await readFile(join(root, "index.html"), "utf8");
html = html.replace(
  /\n\s*<script data-goatcounter[\s\S]*?<\/script>/,
  "",
);
await writeFile(join(dest, "index.html"), html);
console.log("www ready");
