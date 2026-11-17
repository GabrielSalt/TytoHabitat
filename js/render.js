(function () {
  const canvas = document.getElementById("canvas");
  let layout = null;

  function withPreview(href) {
    if (!href || /^https?:\/\//.test(href)) return href;
    if (new URLSearchParams(location.search).get("edit") !== "0") return href;
    const hashAt = href.indexOf("#");
    const hash = hashAt === -1 ? "" : href.slice(hashAt);
    const base = hashAt === -1 ? href : href.slice(0, hashAt);
    return base + (base.includes("?") ? "&" : "?") + "edit=0" + hash;
  }

  function placeArticle(layout) {
    const titles = {};
    layout.elements.forEach(function (item) {
      if (item.role !== "title") return;
      item.x = 101;
      item.fontWeight = 700;
      item.nowrap = true;
      item.lineHeight = 1;
      titles[item.id] = item;
    });
    layout.elements.forEach(function (item) {
      if (item.type !== "facts") return;
      item.x = 696;
      item.w = 280;
      const title = item.target && titles[item.target];
      if (title) item.y = title.y;
    });
  }

  function factLine(label, value, href) {
    const line = document.createElement("div");
    line.append(label + ": ");
    const field = document.createElement(href ? "a" : "span");
    field.dataset.field = label;
    field.textContent = value || "";
    if (href) {
      field.className = "place-link";
      field.href = href;
    }
    line.appendChild(field);
    return line;
  }

  function build(item) {
    if (item.type === "image") {
      const node = document.createElement(item.href ? "a" : "div");
      node.className = "el image" + (item.plain ? " plain" : "");
      if (item.href) node.href = withPreview(item.href);
      if (item.src) {
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = item.alt || "";
        img.draggable = false;
        if (item.fit === "contain") img.classList.add("contain");
        node.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.className = "placeholder";
        ph.textContent = item.alt || "image";
        node.appendChild(ph);
      }
      return node;
    }

    if (item.type === "facts") {
      const node = document.createElement("div");
      node.className = "el facts locked";
      node.append(
        factLine("when", item.when),
        factLine("where", item.where, withPreview("tytoMap.html#" + encodeURIComponent(item.id))),
        factLine("who", item.who)
      );
      return node;
    }

    const node = document.createElement(item.type === "link" ? "a" : "div");
    node.className = "el text";
    if (item.nowrap) node.classList.add("nowrap");
    if (item.plain) node.classList.add("plain");
    if (item.underline) node.classList.add("underline");
    if (item.href) {
      node.href = withPreview(item.href);
      if (/^https?:\/\//.test(item.href)) {
        node.target = "_blank";
        node.rel = "noopener";
      }
    }
    if (item.role === "title" || item.type === "facts") node.classList.add("locked");
    node.textContent = item.text || "";
    return node;
  }

  function apply(item, node) {
    node.style.left = item.x + "px";
    node.style.top = item.y + "px";
    node.style.width = item.w ? item.w + "px" : "";
    node.style.height = item.h ? item.h + "px" : "";
    node.style.fontSize = item.fontSize ? item.fontSize + "px" : "";
    node.style.fontWeight = item.fontWeight || "";
    node.style.fontStyle = item.fontStyle || "";
    node.style.textAlign = item.align || "";
    node.style.lineHeight = item.lineHeight || "";
    node.style.color = item.color || "";
  }

  function paint() {
    placeArticle(layout);
    canvas.replaceChildren();
    canvas.style.width = layout.canvas.w + "px";
    canvas.style.height = layout.canvas.h + "px";
    layout.elements.forEach(function (item, index) {
      const node = build(item);
      node.dataset.id = item.id;
      node.style.zIndex = String(index + 1);
      apply(item, node);
      if (item.id === window.__selected) node.classList.add("selected");
      canvas.appendChild(node);
    });
    fit();
  }

  function fit() {
    if (!layout) return;
    const header = document.querySelector(".site-header");
    const footer = document.querySelector(".site-footer");
    const scale = Math.min(1, window.innerWidth / layout.canvas.w);
    const visual = layout.canvas.h * scale;
    const chrome = (header ? header.offsetHeight : 0) + (footer ? footer.offsetHeight : 0);
    const available = Math.max(0, window.innerHeight - chrome);
    const stage = document.getElementById("stage");
    stage.style.height = Math.max(visual, available) + "px";
    canvas.style.top = (visual < available ? (available - visual) / 2 : 0) + "px";
    canvas.style.transform = "translateX(-50%) scale(" + scale + ")";
  }

  function openHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!id) return;
    const el = nodeFor(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 28;
    window.scrollTo({ top: Math.max(0, top) });
  }

  function nodeFor(id) {
    return canvas.querySelector('[data-id="' + CSS.escape(id) + '"]');
  }

  async function boot() {
    const file = document.body.dataset.layout;
    const res = await fetch(file);
    if (!res.ok) throw new Error("Could not load " + file);
    layout = await res.json();
    if (window.TytoChrome) TytoChrome.mount(document.body.dataset.page || "");
    window.Tyto = {
      get layout() { return layout; },
      file: file,
      paint: paint,
      apply: apply,
      fit: fit,
      nodeFor: nodeFor,
      article: { textX: 101, textW: 820, fontSize: 12 }
    };
    paint();
    openHash();
    if (window.TytoChrome) TytoChrome.sections(layout.sections || []);
    window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    document.dispatchEvent(new Event("tyto:ready"));
  }

  boot().catch(function (err) {
    const note = document.createElement("p");
    note.style.padding = "24px";
    note.textContent = err.message + ". Start the site with: python3 server.py";
    document.body.replaceChildren(note);
  });
})();
