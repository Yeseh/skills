#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [manifestArgument, outputArgument] = process.argv.slice(2);

if (!manifestArgument) {
  console.error("Usage: node scripts/render.mjs <artifact.json> [output.html]");
  process.exit(2);
}

const manifestPath = resolve(manifestArgument);
const manifestDirectory = dirname(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

validateManifest(manifest);
manifest.components = await Promise.all(manifest.components.map((component) => resolveComponent(component, manifestDirectory)));

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = outputArgument
  ? resolve(outputArgument)
  : resolve("docs", "artifacts", `${slug(manifest.title)}-${timestamp}.html`);
const [styles, components] = await Promise.all([
  readFile(join(skillRoot, "assets", "styles.css"), "utf8"),
  readFile(join(skillRoot, "assets", "components.js"), "utf8"),
]);
const serializedManifest = JSON.stringify(manifest).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(manifest.title)}</title>
  <style>${styles}</style>
</head>
<body>
  <noscript>This artifact requires JavaScript to render its local components.</noscript>
  <va-document></va-document>
  <script id="artifact-data" type="application/json">${serializedManifest}</script>
  <script>${components}</script>
</body>
</html>
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(outputPath);

function validateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Artifact manifest must be an object");
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new Error("Artifact manifest requires a non-empty title");
  }
  if (!Array.isArray(value.components)) {
    throw new Error("Artifact manifest requires a components array");
  }

  const ids = new Set();
  const validateComponent = (component) => {
    if (!component || typeof component !== "object" || Array.isArray(component)) {
      throw new Error("Every component must be an object");
    }
    if (!["section", "prose", "code", "callout", "table", "steps", "image", "openapi"].includes(component.type)) {
      throw new Error(`Unsupported component type: ${component.type}`);
    }
    if (typeof component.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(component.id)) {
      throw new Error(`Invalid component id: ${component.id}`);
    }
    if (ids.has(component.id)) {
      throw new Error(`Duplicate component id: ${component.id}`);
    }
    ids.add(component.id);
    if (component.type === "section") {
      if (!Array.isArray(component.children)) {
        throw new Error(`Section ${component.id} requires a children array`);
      }
      component.children.forEach(validateComponent);
    } else if (component.children !== undefined) {
      throw new Error(`Only sections may contain children: ${component.id}`);
    }
  };
  for (const component of value.components) {
    validateComponent(component);
  }
}

async function resolveComponent(component, baseDirectory) {
  if (component.type === "section") {
    return {
      ...component,
      children: await Promise.all(component.children.map((child) => resolveComponent(child, baseDirectory))),
    };
  }
  if (component.type === "openapi" && component.source) {
    const path = resolveFrom(baseDirectory, component.source);
    if (extname(path).toLowerCase() !== ".json") {
      throw new Error(`OpenAPI source must be JSON: ${component.source}`);
    }
    return { ...component, spec: JSON.parse(await readFile(path, "utf8")), source: undefined };
  }

  if (component.type === "image" && component.source) {
    const path = resolveFrom(baseDirectory, component.source);
    const extension = extname(path).toLowerCase();
    const mimeTypes = {
      ".gif": "image/gif",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    };
    const mimeType = mimeTypes[extension];
    if (!mimeType) throw new Error(`Unsupported image format: ${component.source}`);
    const data = await readFile(path);
    return {
      ...component,
      source: `data:${mimeType};base64,${data.toString("base64")}`,
    };
  }

  return component;
}

function resolveFrom(baseDirectory, path) {
  return isAbsolute(path) ? path : resolve(baseDirectory, path);
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "artifact";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
