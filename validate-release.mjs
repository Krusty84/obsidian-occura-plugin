import { existsSync, readFileSync, statSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message) {
  console.error(`Release validation failed: ${message}`);
  process.exitCode = 1;
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");

const requiredManifestFields = [
  "id",
  "name",
  "version",
  "minAppVersion",
  "description",
  "author",
];

for (const field of requiredManifestFields) {
  if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
    fail(`manifest.json is missing a non-empty ${field}`);
  }
}

if (packageJson.version !== manifest.version) {
  fail("package.json and manifest.json versions differ");
}

if (packageLock.version !== packageJson.version) {
  fail("package-lock.json top-level version differs from package.json");
}

if (packageLock.packages?.[""]?.version !== packageJson.version) {
  fail("package-lock.json root package version differs from package.json");
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  fail("versions.json does not map the current version to minAppVersion");
}

if (!existsSync("main.js") || statSync("main.js").size === 0) {
  fail("production main.js is missing or empty; run npm run build first");
}

if (process.exitCode !== 1) {
  console.log(`Release metadata and main.js are valid for ${manifest.version}.`);
}
