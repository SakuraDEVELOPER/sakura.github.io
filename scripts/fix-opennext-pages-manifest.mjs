import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const shouldSkip = process.env.NEXT_OUTPUT_EXPORT === "1";

if (shouldSkip) {
  process.exit(0);
}

const projectRoot = process.cwd();
const sourceManifestPath = resolve(projectRoot, ".next", "server", "pages-manifest.json");
const targetManifestPath = resolve(
  projectRoot,
  ".next",
  "standalone",
  ".next",
  "server",
  "pages-manifest.json"
);

if (existsSync(targetManifestPath)) {
  process.exit(0);
}

mkdirSync(dirname(targetManifestPath), { recursive: true });

if (existsSync(sourceManifestPath)) {
  copyFileSync(sourceManifestPath, targetManifestPath);
  process.exit(0);
}

writeFileSync(targetManifestPath, "{}\n", "utf8");
