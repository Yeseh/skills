(() => {
  "use strict";

  const manifest = JSON.parse(document.querySelector("#artifact-data").textContent);
  const allowedThemeTokens = new Set([
    "accent", "accent-soft", "on-accent-soft", "background", "surface", "text", "muted", "border",
    "success", "warning", "danger", "code-bg", "code-text", "radius", "shadow",
    "font-body", "font-mono", "hero-background", "hero-text", "logo-height",
  ]);
  const brand = manifest.brand || {};

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

  const syntaxAliases = {
    js: "js", javascript: "js", jsx: "js", ts: "js", typescript: "js", tsx: "js",
    json: "json", sh: "shell", bash: "shell", shell: "shell", zsh: "shell", console: "shell",
    py: "python", python: "python", css: "css", sql: "sql",
  };

  function keywordRule(words, flags = "") {
    return new RegExp(`\\b(?:${words.join("|")})\\b`, `y${flags}`);
  }

  // Sticky rules are tried in order at each position; the first match wins.
  const syntaxRules = {
    js: [
      ["comment", /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
      ["string", /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?/y],
      ["number", /\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)n?\b/y],
      ["keyword", keywordRule([
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case",
        "break", "continue", "new", "class", "extends", "import", "from", "export", "default", "async",
        "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "yield", "this",
        "super", "null", "undefined", "true", "false", "void", "delete", "interface", "type", "enum",
        "implements", "public", "private", "protected", "readonly", "as", "static", "declare", "namespace",
      ])],
      ["function", /[A-Za-z_$][\w$]*(?=\s*\()/y],
    ],
    json: [
      ["key", /"(?:\\.|[^"\\\n])*"(?=\s*:)/y],
      ["string", /"(?:\\.|[^"\\\n])*"?/y],
      ["number", /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
      ["keyword", keywordRule(["true", "false", "null"])],
    ],
    shell: [
      ["comment", /#[^\n]*/y],
      ["string", /"(?:\\.|[^"\\])*"?|'[^']*'?/y],
      ["variable", /\$\{[^}\n]*\}|\$[A-Za-z_]\w*|\$[?#@*!$0-9]/y],
      ["flag", /(?<![\w-])--?[A-Za-z][\w-]*/y],
      ["keyword", keywordRule([
        "if", "then", "else", "elif", "fi", "for", "in", "do", "done", "while", "until", "case", "esac",
        "function", "return", "export", "local", "unset", "set", "source",
      ])],
      ["builtin", keywordRule(["cd", "echo", "exit", "cat", "ls", "mkdir", "rm", "cp", "mv", "curl", "git", "npm", "npx", "node", "apm", "pip"])],
    ],
    python: [
      ["comment", /#[^\n]*/y],
      ["string", /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y],
      ["decorator", /@[A-Za-z_][\w.]*/y],
      ["number", /\b\d[\d_]*(?:\.\d+)?\b/y],
      ["keyword", keywordRule([
        "def", "class", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "is",
        "import", "from", "as", "with", "try", "except", "finally", "raise", "pass", "break", "continue",
        "lambda", "yield", "async", "await", "global", "nonlocal", "None", "True", "False",
      ])],
      ["function", /[A-Za-z_]\w*(?=\s*\()/y],
    ],
    css: [
      ["comment", /\/\*[\s\S]*?(?:\*\/|$)/y],
      ["string", /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y],
      ["keyword", /@[\w-]+/y],
      ["key", /[\w-]+(?=\s*:)/y],
      ["number", /(?<![\w-])(?:#[\da-fA-F]{3,8}\b|-?\d+(?:\.\d+)?(?:%|[a-zA-Z]+)?)/y],
    ],
    sql: [
      ["comment", /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
      ["string", /'(?:''|[^'])*'?/y],
      ["number", /\b\d+(?:\.\d+)?\b/y],
      ["keyword", keywordRule([
        "select", "from", "where", "and", "or", "not", "insert", "into", "values", "update", "set", "delete",
        "create", "table", "alter", "drop", "index", "join", "inner", "left", "right", "outer", "on", "as",
        "group", "by", "order", "having", "limit", "offset", "distinct", "null", "is", "in", "like",
        "between", "case", "when", "then", "else", "end", "primary", "key", "foreign", "references",
      ], "i")],
    ],
  };

  // Returns tokens {type, text}; plain text uses type "plain". Unknown languages stay plain.
  function tokenize(source, language) {
    const rules = syntaxRules[syntaxAliases[String(language || "").toLowerCase()]];
    if (!rules) return [{ type: "plain", text: source }];
    const tokens = [];
    let plain = "";
    let index = 0;
    while (index < source.length) {
      let hit = null;
      for (const [type, pattern] of rules) {
        pattern.lastIndex = index;
        const match = pattern.exec(source);
        if (match && match[0]) { hit = { type, text: match[0] }; break; }
      }
      if (hit) {
        if (plain) { tokens.push({ type: "plain", text: plain }); plain = ""; }
        tokens.push(hit);
        index += hit.text.length;
      } else {
        plain += source[index];
        index += 1;
      }
    }
    if (plain) tokens.push({ type: "plain", text: plain });
    return tokens;
  }

  // Splits tokens at newlines so that each source line is a list of tokens.
  function tokenLines(source, language) {
    const lines = [[]];
    for (const token of tokenize(source, language)) {
      token.text.split("\n").forEach((part, index) => {
        if (index > 0) lines.push([]);
        if (part) lines.at(-1).push({ type: token.type, text: part });
      });
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
      const lines = tokenLines(String(value.content || ""), value.language);
      const code = element("code", { class: `language-${value.language || "text"}` });
      lines.forEach((tokens, index) => {
        const lineNumber = index + 1;
        const line = tokens.map((token) => token.text).join("");
        const classes = ["va-code-line"];
        if (highlights.has(lineNumber)) classes.push("va-code-highlight");
        if (value.mode === "diff" && line.startsWith("+")) classes.push("va-code-added");
        if (value.mode === "diff" && line.startsWith("-")) classes.push("va-code-removed");
        const children = tokens.length
          ? tokens.map((token) => (token.type === "plain" ? token.text : element("span", { class: `va-tok-${token.type}` }, token.text)))
          : " ";
        code.append(element("span", { class: classes.join(" "), "data-line": lineNumber }, children));
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

  const tones = ["neutral", "info", "success", "warning", "danger"];
  const changeKinds = ["added", "modified", "removed", "unchanged"];

  class VaMetric extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const cards = (value.items || []).map((item) => {
        const tone = tones.includes(item.tone) ? item.tone : "neutral";
        return element("div", { class: `va-metric va-metric-${tone}` }, [
          element("div", { class: "va-metric-value" }, String(item.value ?? "—")),
          element("div", { class: "va-metric-label" }, item.label || ""),
          item.delta ? element("div", { class: "va-metric-delta" }, item.delta) : "",
        ]);
      });
      this.replaceChildren(element("div", { class: "va-metric-component" }, [
        value.title ? element("h3", {}, value.title) : "",
        element("div", { class: "va-metric-grid" }, cards),
      ]));
    }
  }

  class VaTimeline extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const list = element("ol", { class: "va-timeline" });
      for (const item of value.items || []) {
        const status = ["complete", "current", "pending"].includes(item.status) ? item.status : "pending";
        list.append(element("li", { class: `va-timeline-item va-timeline-${status}` }, [
          element("div", { class: "va-timeline-date" }, item.date || ""),
          element("div", { class: "va-timeline-content" }, [
            element("div", { class: "va-step-heading" }, [
              element("strong", {}, item.title || ""),
              element("span", { class: `va-step-status va-step-${status}` }, status),
            ]),
            item.description ? element("p", {}, item.description) : "",
          ]),
        ]));
      }
      this.replaceChildren(element("div", {}, [
        value.title ? element("h3", {}, value.title) : "",
        list,
      ]));
    }
  }

  class VaChecklist extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const states = ["done", "open", "blocked"];
      const list = element("ul", { class: "va-checklist" });
      for (const item of value.items || []) {
        const state = states.includes(item.state) ? item.state : "open";
        const box = element("input", { type: "checkbox", disabled: "", "aria-label": item.label || "item" });
        if (state === "done") box.checked = true;
        list.append(element("li", { class: `va-check-item va-check-${state}` }, [
          box,
          element("div", {}, [
            element("div", { class: "va-check-label" }, [
              element("span", {}, item.label || ""),
              element("span", { class: `va-step-status va-check-state va-check-state-${state}` }, state),
            ]),
            item.note ? element("div", { class: "va-subtle" }, item.note) : "",
          ]),
        ]));
      }
      this.replaceChildren(element("div", {}, [
        value.title ? element("h3", {}, value.title) : "",
        list,
      ]));
    }
  }

  class VaComparison extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const cards = (value.options || []).map((option) => {
        const pros = (option.pros || []).map((pro) => element("li", { class: "va-pro" }, pro));
        const cons = (option.cons || []).map((con) => element("li", { class: "va-con" }, con));
        return element("article", { class: `va-option${option.recommended ? " va-option-recommended" : ""}` }, [
          element("div", { class: "va-option-heading" }, [
            element("h4", {}, option.name || "Option"),
            option.recommended ? element("span", { class: "va-badge va-badge-recommended" }, "Recommended") : "",
          ]),
          option.summary ? element("p", { class: "va-subtle" }, option.summary) : "",
          pros.length ? element("ul", { class: "va-pros-cons" }, pros) : "",
          cons.length ? element("ul", { class: "va-pros-cons" }, cons) : "",
        ]);
      });
      this.replaceChildren(element("div", { class: "va-comparison-component" }, [
        value.title ? element("h3", {}, value.title) : "",
        element("div", { class: "va-comparison-grid" }, cards),
      ]));
    }
  }

  class VaFileTree extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const root = { children: new Map() };
      for (const entry of value.entries || []) {
        const parts = String(entry.path || "").replace(/\/+$/, "").split("/").filter(Boolean);
        let node = root;
        parts.forEach((part, index) => {
          if (!node.children.has(part)) node.children.set(part, { name: part, children: new Map(), change: undefined });
          node = node.children.get(part);
          if (index === parts.length - 1 && changeKinds.includes(entry.change)) node.change = entry.change;
        });
      }
      const renderLevel = (parent) => {
        const list = element("ul", { class: "va-tree" });
        for (const child of parent.children.values()) {
          const isDirectory = child.children.size > 0;
          const item = element("li", { class: isDirectory ? "va-tree-dir" : "va-tree-file" }, [
            element("span", { class: "va-tree-name" }, child.name + (isDirectory ? "/" : "")),
            child.change ? element("span", { class: `va-tree-change va-change-${child.change}` }, child.change) : "",
          ]);
          if (isDirectory) item.append(renderLevel(child));
          list.append(item);
        }
        return list;
      };
      this.replaceChildren(element("div", { class: "va-card-inset" }, [
        value.title ? element("h3", {}, value.title) : "",
        renderLevel(root),
      ]));
    }
  }

  class VaAccordion extends HTMLElement {
    set data(value) {
      this.id = value.id;
      const items = (value.items || []).map((item) => {
        const body = element("div", { class: "va-accordion-body" });
        body.append(renderText(item.markdown || ""));
        return element("details", { class: "va-accordion-item", ...(item.open ? { open: "" } : {}) }, [
          element("summary", {}, item.title || "Details"),
          body,
        ]);
      });
      this.replaceChildren(element("div", { class: "va-accordion-component" }, [
        value.title ? element("h3", {}, value.title) : "",
        ...items,
      ]));
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
    metric: "va-metric",
    timeline: "va-timeline",
    checklist: "va-checklist",
    comparison: "va-comparison",
    "file-tree": "va-file-tree",
    accordion: "va-accordion",
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
        brand.logo ? element("img", { class: "va-logo", src: brand.logo, alt: brand.name || "Logo" }) : "",
        element("p", { class: "va-eyebrow" }, manifest.kind || brand.kind || "Visual artifact"),
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

      const footerText = [
        manifest.source
          ? `Source: ${manifest.source}${manifest.revision ? ` · ${manifest.revision}` : ""}`
          : "Generated as a self-contained visual artifact",
        brand.footer,
      ].filter(Boolean).join(" · ");
      const footer = element("footer", { class: "va-footer" }, footerText);
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
  customElements.define("va-metric", VaMetric);
  customElements.define("va-timeline", VaTimeline);
  customElements.define("va-checklist", VaChecklist);
  customElements.define("va-comparison", VaComparison);
  customElements.define("va-file-tree", VaFileTree);
  customElements.define("va-accordion", VaAccordion);
  customElements.define("va-document", VaDocument);
})();
