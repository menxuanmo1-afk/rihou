import { mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "www");

// www is generated and gitignored. Never ship a previous web build's valuation modules.
await rm(dest, { recursive: true, force: true });
await mkdir(join(dest,"css"), { recursive: true });
await mkdir(join(dest,"js"), { recursive: true });
await copyFile(join(root,"css/app.css"),join(dest,"css/app.css"));
await copyFile(join(root,"css/assistant.css"),join(dest,"css/assistant.css"));
const result=await build({
  entryPoints:[join(root,"js/native/app.js")], outfile:join(dest,"js/native.js"), bundle:true,
  format:"esm", target:"safari16", minifySyntax:true,
  treeShaking:true, metafile:true, charset:"utf8",
});
const shipped=Object.values(result.metafile.outputs).flatMap(output=>Object.entries(output.inputs).filter(([,v])=>v.bytesInOutput>0).map(([path])=>path));
const forbidden=shipped.filter(p=>/\/(analysis|lines|ai-export|web-assets)\.js/.test(p));
if(forbidden.length) throw Error(`Native build contains web-only modules: ${forbidden.join(", ")}`);

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
html=html.replace(/\.\/js\/app\.js\?v=\d+/,"./js/native.js").replace("</head>",'<link rel="stylesheet" href="./css/assistant.css" /></head>');
await writeFile(join(dest, "index.html"), html);
console.log("www ready");
