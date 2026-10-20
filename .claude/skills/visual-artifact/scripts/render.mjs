#!/usr/bin/env node

import { access, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { positionals, brandArgument, noBrand } = parseArguments(process.argv.slice(2));
const [manifestArgument, outputArgument] = positionals;

if (!manifestArgument) {
  console.error("Usage: node scripts/render.mjs <artifact.json> [output.html] [--brand <brand.json> | --no-brand]");
  process.exit(2);
}

const themeTokens = new Set([
  "accent", "accent-soft", "on-accent-soft", "background", "surface", "text", "muted", "border",
  "success", "warning", "danger", "code-bg", "code-text", "radius", "shadow",
  "font-body", "font-mono", "hero-background", "hero-text", "logo-height",
]);

const manifestPath = resolve(manifestArgument);
const manifestDirectory = dirname(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

validateManifest(manifest);
manifest.components = await Promise.all(manifest.components.map((component) => resolveComponent(component, manifestDirectory)));

const brandPath = noBrand ? undefined : await findBrand(brandArgument, manifestDirectory);
const brand = brandPath ? await loadBrand(brandPath) : undefined;
if (brand) manifest.brand = brand.runtime;

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
  <style>${styles}</style>${brand ? `
  <style id="va-brand">${brand.css}</style>` : ""}
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
if (brandPath) console.error(`Brand: ${brandPath}`);
console.log(outputPath);

function parseArguments(argv) {
  const result = { positionals: [], brandArgument: undefined, noBrand: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-brand") result.noBrand = true;
    else if (argument === "--brand") {
      result.brandArgument = argv[++index];
      if (!result.brandArgument) throw new Error("--brand requires a path");
    } else if (argument.startsWith("--brand=")) result.brandArgument = argument.slice("--brand=".length);
    else result.positionals.push(argument);
  }
  return result;
}

// Brand lookup order: --brand flag, VISUAL_ARTIFACT_BRAND, then the nearest
// .visual-artifact/brand.json above the manifest, then above the working directory.
async function findBrand(explicitPath, manifestDirectory) {
  const configured = explicitPath || process.env.VISUAL_ARTIFACT_BRAND;
  if (configured) {
    const path = resolve(configured);
    if (!(await exists(path))) throw new Error(`Brand file not found: ${configured}`);
    return path;
  }
  for (const start of [manifestDirectory, process.cwd()]) {
    for (let directory = resolve(start); ; directory = dirname(directory)) {
      const candidate = join(directory, ".visual-artifact", "brand.json");
      if (await exists(candidate)) return candidate;
      if (dirname(directory) === directory) break;
    }
  }
  return undefined;
}

async function loadBrand(path) {
  const directory = dirname(path);
  const brand = JSON.parse(await readFile(path, "utf8"));
  if (!brand || typeof brand !== "object" || Array.isArray(brand)) {
    throw new Error(`Brand file must be an object: ${path}`);
  }
  for (const key of ["name", "kind", "footer"]) {
    if (brand[key] !== undefined && typeof brand[key] !== "string") {
      throw new Error(`Brand ${key} must be a string: ${path}`);
    }
  }

  const rules = [
    themeRule(":root", brand.theme, "theme"),
    themeRule(":root", brand.darkTheme, "darkTheme", "@media (prefers-color-scheme: dark)"),
  ];
  if (brand.css) {
    rules.push(await readFile(resolveFrom(directory, brand.css), "utf8"));
  }

  return {
    runtime: {
      name: brand.name,
      kind: brand.kind,
      footer: brand.footer,
      logo: brand.logo ? await embedImage(resolveFrom(directory, brand.logo), brand.logo) : undefined,
    },
    css: rules.filter(Boolean).join("\n").replace(/<\/style/gi, "<\\/style"),
  };
}

function themeRule(selector, theme, label, media) {
  if (theme === undefined) return "";
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
    throw new Error(`Brand ${label} must be an object of theme tokens`);
  }
  const declarations = Object.entries(theme).map(([token, value]) => {
    if (!themeTokens.has(token)) throw new Error(`Unsupported brand ${label} token: ${token}`);
    if (typeof value !== "string" || /[;{}<]/.test(value)) throw new Error(`Invalid brand ${label} value for ${token}`);
    return `--va-${token}: ${value};`;
  });
  const derived = !theme["on-accent-soft"] && readableOn(theme["accent-soft"]);
  if (derived) declarations.push(`--va-on-accent-soft: ${derived};`);
  const rule = `${selector} { ${declarations.join(" ")} }`;
  return media ? `${media} { ${rule} }` : rule;
}

// Text colour for a hex background, matching the runtime's derivation for manifest themes.
function readableOn(color) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color?.trim() ?? "")?.[1];
  if (!hex) return undefined;
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  const luminance = [0, 2, 4]
    .map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.42 ? "#172033" : "#ffffff";
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

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
    return { ...component, source: await embedImage(resolveFrom(baseDirectory, component.source), component.source) };
  }

  return component;
}

async function embedImage(path, label) {
  const mimeTypes = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const mimeType = mimeTypes[extname(path).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported image format: ${label}`);
  const data = await readFile(path);
  return `data:${mimeType};base64,${data.toString("base64")}`;
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
