import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
if (process.platform !== "win32" || process.arch !== "x64")
  throw Error("This installer build currently targets Windows x64.");
const require = createRequire(import.meta.url);
if (!process.version.startsWith("v24."))
  throw Error("Build the companion with Node.js 24.x.");
const runtime = resolve(".local/desktop-runtime"),
  app = resolve(".local/desktop-app");
await mkdir(runtime, { recursive: true });
await mkdir(app, { recursive: true });
await mkdir(app + "/node_modules", { recursive: true });
const bundled = await build({
  entryPoints: ["server/index.ts"],
  outfile: runtime + "/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  metafile: true,
  external: ["vite"],
  banner: {
    js: 'import { createRequire as _createRequire } from "node:module"; const require = _createRequire(import.meta.url);',
  },
});
const packages = new Set();
for (const input of Object.keys(bundled.metafile.inputs)) {
  if (!input.includes("node_modules")) continue;
  let directory = dirname(resolve(input));
  while (
    !existsSync(directory + "/package.json") &&
    directory !== dirname(directory)
  )
    directory = dirname(directory);
  packages.add(directory);
}
let licenses = "Bundled server dependency licenses\n\n";
for (const directory of packages) {
  const pkg = JSON.parse(await readFile(directory + "/package.json", "utf8"));
  licenses += `\n--- ${pkg.name}@${pkg.version} (${pkg.license || "see package"}) ---\n`;
  for (const file of await readdir(directory))
    if (/^(license|copying|notice)(\.|$)/i.test(file)) {
      try {
        licenses += await readFile(directory + "/" + file, "utf8");
      } catch {}
    }
}
await writeFile(runtime + "/THIRD-PARTY-LICENSES.txt", licenses);
const codexLicense = await fetch(
  "https://raw.githubusercontent.com/openai/codex/main/LICENSE",
);
if (!codexLicense.ok) throw Error("Could not obtain the Codex license.");
await writeFile(runtime + "/CODEX-LICENSE.txt", await codexLicense.text());
await cp("dist", runtime + "/dist", { recursive: true });
const codexPackage = resolve(
  require.resolve("@openai/codex-win32-x64/package.json"),
  "..",
);
await cp(codexPackage + "/vendor", runtime + "/vendor", { recursive: true });
const nodeDir = dirname(process.execPath);
await mkdir(runtime + "/node", { recursive: true });
await cp(process.execPath, runtime + "/node/node.exe");
for (const file of ["npm", "npm.cmd", "npx", "npx.cmd", "LICENSE"]) {
  if (existsSync(nodeDir + "/" + file))
    await cp(nodeDir + "/" + file, runtime + "/node/" + file);
}
if (!existsSync(nodeDir + "/node_modules/npm"))
  throw Error(
    "npm must be installed alongside the build's Node.js executable.",
  );
await cp(nodeDir + "/node_modules/npm", runtime + "/node/node_modules/npm", {
  recursive: true,
});
if (!existsSync(runtime + "/node/LICENSE")) {
  const response = await fetch(
    `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`,
  );
  if (!response.ok)
    throw Error("Could not obtain the bundled Node.js license.");
  await writeFile(runtime + "/node/LICENSE", await response.text());
}
await cp("desktop/main.cjs", app + "/main.cjs");
await cp("desktop/preload.cjs", app + "/preload.cjs");
const metadata = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(
  app + "/package.json",
  JSON.stringify(
    {
      name: "galaxi",
      productName: "Galaxi",
      version: metadata.version,
      description: "Your local coding village",
      main: "main.cjs",
      author: "Dhakshini",
      license: "UNLICENSED",
    },
    null,
    2,
  ),
);
await writeFile(
  runtime + "/THIRD-PARTY-NOTICES.txt",
  "Galaxi includes Electron (MIT and Chromium third-party licenses, distributed alongside the executable), Node.js, OpenAI Codex (Apache-2.0), and bundled npm dependencies. Codex source and license: https://github.com/openai/codex\n",
);
console.log(
  "Desktop runtime prepared without source repositories, credentials or local data.",
);
