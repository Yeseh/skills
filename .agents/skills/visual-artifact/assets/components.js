(() => {
  "use strict";

  const manifest = JSON.parse(document.querySelector("#artifact-data").textContent);
  const allowedThemeTokens = new Set([
    "accent", "accent-soft", "on-accent-soft", "background", "surface", "text", "muted", "border",
    "success", "warning", "danger", "code-bg", "code-text", "radius", "shadow",
    "font-body", "font-mono",
  ]);

  function element(name, attributes = {}, children = []) {
    const node = document.createElement(name);
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === null) continue;
      if (key === "class") node.className = value;
      else node.setAttribute(key, String(value));
    }
    for (const child of Array.isArray(children) ? children : [children]) {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:", "mailto:", "file:"].includes(url.protocol) ? value : "#";
    } catch {
      return "#";
    }
  }

  function renderInline(value) {
    const fragment = document.createDocumentFragment();
    const pattern = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      fragment.append(value.slice(cursor, match.index));
      const token = match[0];
      if (token.startsWith("**")) fragment.append(element("strong", {}, token.slice(2, -2)));
      else if (token.startsWith("_")) fragment.append(element("em", {}, token.slice(1, -1)));
      else if (token.startsWith("`")) fragment.append(element("code", { class: "va-inline-code" }, token.slice(1, -1)));
      else {
        const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        fragment.append(element("a", { href: safeUrl(parts[2]) }, parts[1]));
      }
      cursor = match.index + token.length;
    }
    fragment.append(value.slice(cursor));
    return fragment;
  }

  function renderText(markdown) {
    const container = document.createDocumentFragment();
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }

      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = Math.min(heading[1].length + 1, 6);
        container.append(element(`h${level}`, {}, renderInline(heading[2])));
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        container.append(element("blockquote", {}, renderInline(quote.join(" "))));
        continue;
      }

      if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        const ordered = /^\d+\.\s+/.test(line);
        const list = element(ordered ? "ol" : "ul");
        const expression = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
        while (index < lines.length && expression.test(lines[index])) {
          list.append(element("li", {}, renderInline(lines[index].replace(expression, ""))));
          index += 1;
        }
        container.append(list);
        continue;
      }

      const paragraph = [];
      while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+|^>\s?|^[-*]\s+|^\d+\.\s+/.test(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      container.append(element("p", {}, renderInline(paragraph.join(" "))));
    }
    return container;
  }

  class VaProse extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const container = element("div", { class: "va-prose" });
      container.append(renderText(value.markdown));
      this.replaceChildren(container);
    }
  }

  function highlightedLines(ranges = []) {
    const lines = new Set();
    for (const range of ranges) {
      const [start, end = start] = String(range).split("-").map(Number);
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      for (let line = start; line <= end; line += 1) lines.add(line);
    }
    return lines;
  }

  class VaCode extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const copy = element("button", { class: "va-copy", type: "button" }, "Copy");
      copy.addEventListener("click", async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value.content);
          } else {
            const textarea = element("textarea", { "aria-hidden": "true" }, value.content);
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.append(textarea);
            textarea.select();
            if (!document.execCommand("copy")) throw new Error("Copy command was rejected");
            textarea.remove();
          }
          copy.textContent = "Copied";
          setTimeout(() => { copy.textContent = "Copy"; }, 1600);
        } catch {
          copy.textContent = "Copy failed";
        }
      });
      const header = element("div", { class: "va-command-header" }, [
        element("div", {}, [
          value.title ? element("h3", {}, value.title) : "",
          value.description ? element("div", { class: "va-subtle" }, value.description) : "",
        ]),
        value.copy === false ? "" : copy,
      ]);
      const highlights = highlightedLines(value.highlights);
      const lines = String(value.content || "").split("\n");
      const code = element("code", { class: `language-${value.language || "text"}` });
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const classes = ["va-code-line"];
        if (highlights.has(lineNumber)) classes.push("va-code-highlight");
        if (value.mode === "diff" && line.startsWith("+")) classes.push("va-code-added");
        if (value.mode === "diff" && line.startsWith("-")) classes.push("va-code-removed");
        code.append(element("span", { class: classes.join(" "), "data-line": lineNumber }, line || " "));
      });
      const pre = element("pre", {
        class: `va-code va-code-${value.mode || "plain"}${value.lineNumbers ? " va-code-numbered" : ""}`,
      }, code);
      const card = element("div", { class: "va-code-card" }, [
        value.title || value.description ? header : "",
        value.filename ? element("div", { class: "va-code-filename" }, value.filename) : "",
        element("div", { class: "va-code-wrap" }, pre),
      ]);
      this.replaceChildren(card);
    }
  }

  class VaCallout extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const tone = ["neutral", "info", "success", "warning", "danger"].includes(value.tone) ? value.tone : "neutral";
      const body = element("div", { class: "va-callout-body" });
      body.append(renderText(value.markdown || ""));
      this.replaceChildren(element("aside", { class: `va-callout va-callout-${tone}` }, [
        value.title ? element("h3", {}, value.title) : "",
        body,
      ]));
    }
  }

  class VaTable extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const columns = Array.isArray(value.columns) ? value.columns : [];
      const rows = (value.rows || []).map((row) => columns.map((column, index) => {
        const cell = Array.isArray(row) ? row[index] : row[column.key];
        return cell === undefined || cell === null ? "—" : String(cell);
      }));
      this.replaceChildren(element("div", { class: "va-table-component" }, [
        value.title ? element("h3", {}, value.title) : "",
        value.description ? element("p", { class: "va-subtle" }, value.description) : "",
        table(columns.map((column) => column.label || column.key), rows),
      ]));
    }
  }

  class VaSteps extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const list = element("ol", { class: "va-steps" });
      for (const [index, item] of (value.items || []).entries()) {
        const status = ["complete", "current", "pending"].includes(item.status) ? item.status : "pending";
        const content = element("div", { class: "va-step-content" }, [
          element("div", { class: "va-step-heading" }, [
            element("strong", {}, item.title || `Step ${index + 1}`),
            element("span", { class: `va-step-status va-step-${status}` }, status),
          ]),
          item.description ? element("p", {}, item.description) : "",
        ]);
        list.append(element("li", {}, [element("span", { class: "va-step-index" }, index + 1), content]));
      }
      this.replaceChildren(element("div", {}, [
        value.title ? element("h3", {}, value.title) : "",
        list,
      ]));
    }
  }

  class VaSection extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const card = element("section", { class: "va-card va-section" }, [
        value.title ? element("h2", {}, value.title) : "",
        value.description ? element("p", { class: "va-section-description" }, value.description) : "",
      ]);
      const children = element("div", { class: "va-section-children" });
      for (const child of value.children || []) children.append(renderComponent(child));
      card.append(children);
      this.replaceChildren(card);
    }
  }

  function schemaSummary(schema) {
    if (!schema) return "—";
    if (schema.$ref) return schema.$ref.split("/").at(-1);
    if (schema.type === "array") return `array<${schemaSummary(schema.items)}>`;
    return schema.type || "object";
  }

  function table(headers, rows) {
    const head = element("thead", {}, element("tr", {}, headers.map((header) => element("th", {}, header))));
    const body = element("tbody", {}, rows.map((row) => element("tr", {}, row.map((cell) => element("td", {}, cell)))));
    return element("div", { class: "va-table-wrap" }, element("table", { class: "va-table" }, [head, body]));
  }

  class VaOpenapi extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const spec = value.spec;
      const card = element("section", { class: "va-card" });
      if (!spec || typeof spec !== "object" || !spec.paths) {
        card.classList.add("va-error");
        card.append(element("h2", {}, value.title || "OpenAPI"), element("p", {}, "Invalid OpenAPI document: paths are missing."));
        this.replaceChildren(card);
        return;
      }

      card.append(element("div", { class: "va-api-heading" }, [
        element("div", {}, [
          element("div", { class: "va-eyebrow va-subtle" }, `OpenAPI ${spec.openapi || "unknown"}`),
          element("h2", {}, value.title || spec.info?.title || "API reference"),
          element("div", { class: "va-subtle" }, spec.info?.description || `Version ${spec.info?.version || "unknown"}`),
        ]),
      ]));

      const selectedPaths = value.paths ? new Set(value.paths) : null;
      const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (selectedPaths && !selectedPaths.has(path)) continue;
        for (const [method, operation] of Object.entries(pathItem)) {
          if (!methods.has(method)) continue;
          const summary = element("summary", {}, [
            element("span", { class: `va-method va-${method}` }, method.toUpperCase()),
            element("code", {}, path),
            operation.deprecated ? " · Deprecated" : "",
          ]);
          const body = element("div", { class: "va-operation-body" });
          if (operation.summary || operation.description) {
            body.append(element("p", {}, operation.summary || operation.description));
          }
          const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])];
          if (parameters.length) {
            body.append(element("h4", {}, "Parameters"));
            body.append(table(
              ["Name", "In", "Required", "Type", "Description"],
              parameters.map((parameter) => [
                parameter.name || "—", parameter.in || "—", parameter.required ? "Yes" : "No",
                schemaSummary(parameter.schema), parameter.description || "—",
              ]),
            ));
          }
          if (operation.requestBody) {
            body.append(element("h4", {}, "Request body"));
            body.append(table(
              ["Content type", "Schema"],
              Object.entries(operation.requestBody.content || {}).map(([contentType, media]) => [contentType, schemaSummary(media.schema)]),
            ));
          }
          if (operation.responses) {
            body.append(element("h4", {}, "Responses"));
            body.append(table(
              ["Status", "Description", "Content"],
              Object.entries(operation.responses).map(([status, response]) => [
                status, response.description || "—", Object.keys(response.content || {}).join(", ") || "—",
              ]),
            ));
          }
          const details = element("details", { class: "va-operation" }, [summary, body]);
          card.append(details);
        }
      }
      this.replaceChildren(card);
    }
  }

  class VaImage extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const image = element("img", { class: "va-image", src: value.source, alt: value.alt || "" });
      const figure = element("figure", { class: "va-image-component" }, [
        value.title ? element("h3", {}, value.title) : "",
        image,
        value.caption ? element("figcaption", { class: "va-caption" }, value.caption) : "",
      ]);
      this.replaceChildren(figure);
    }
  }

  const componentNames = {
    section: "va-section",
    prose: "va-prose",
    code: "va-code",
    callout: "va-callout",
    table: "va-table",
    steps: "va-steps",
    image: "va-image",
    openapi: "va-openapi",
  };

  function renderComponent(component) {
    const node = document.createElement(componentNames[component.type]);
    node.data = component;
    return node;
  }

  function appendToc(toc, components, depth = 0) {
    for (const component of components) {
      if (component.title) {
        toc.append(element("a", {
          href: `#${component.id}`,
          class: depth ? "va-toc-child" : "",
        }, component.title));
      }
      if (component.type === "section") appendToc(toc, component.children || [], depth + 1);
    }
  }

  class VaDocument extends HTMLElement {
    connectedCallback() {
      for (const [token, value] of Object.entries(manifest.theme || {})) {
        if (allowedThemeTokens.has(token) && typeof value === "string" && !/[;{}]/.test(value)) {
          document.documentElement.style.setProperty(`--va-${token}`, value);
        }
      }
      if (manifest.theme?.["accent-soft"] && !manifest.theme?.["on-accent-soft"]) {
        const probe = element("span");
        probe.style.cssText = "position:fixed;visibility:hidden;background:var(--va-accent-soft)";
        document.body.append(probe);
        const channels = getComputedStyle(probe).backgroundColor.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
        probe.remove();
        if (channels?.length === 3) {
          const luminance = channels
            .map((channel) => channel / 255)
            .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
            .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
          document.documentElement.style.setProperty("--va-on-accent-soft", luminance > 0.42 ? "#172033" : "#ffffff");
        }
      }

      const hero = element("header", { class: "va-hero" }, [
        element("p", { class: "va-eyebrow" }, manifest.kind || "Visual artifact"),
        element("h1", { class: "va-title" }, manifest.title),
        manifest.purpose ? element("p", { class: "va-purpose" }, manifest.purpose) : "",
        element("div", { class: "va-meta" }, [
          manifest.status ? element("span", { class: "va-badge" }, manifest.status) : "",
          element("span", { class: "va-badge" }, manifest.generatedAt || new Date().toISOString().slice(0, 10)),
          manifest.revision ? element("span", { class: "va-badge" }, manifest.revision) : "",
        ]),
      ]);
      const toc = element("nav", { class: "va-toc", "aria-label": "Contents" }, element("strong", {}, "Contents"));
      const content = element("main", { class: "va-content" });

      for (const component of manifest.components) {
        content.append(renderComponent(component));
      }
      appendToc(toc, manifest.components);

      const footer = element("footer", { class: "va-footer" }, manifest.source
        ? `Source: ${manifest.source}${manifest.revision ? ` · ${manifest.revision}` : ""}`
        : "Generated as a self-contained visual artifact");
      const shell = element("div", { class: "va-shell" }, [
        hero,
        element("div", { class: "va-layout" }, [toc, content]),
        footer,
      ]);
      this.replaceChildren(shell);
    }
  }

  customElements.define("va-section", VaSection);
  customElements.define("va-prose", VaProse);
  customElements.define("va-code", VaCode);
  customElements.define("va-callout", VaCallout);
  customElements.define("va-table", VaTable);
  customElements.define("va-steps", VaSteps);
  customElements.define("va-openapi", VaOpenapi);
  customElements.define("va-image", VaImage);
  customElements.define("va-document", VaDocument);
})();
