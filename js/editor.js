(function () {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const params = new URLSearchParams(location.search);
  if (!local) return;

  function bootEditor() {
    if (params.get("edit") === "0") {
      showPreviewLink();
      return;
    }
    start();
  }

  if (window.Tyto) bootEditor();
  else document.addEventListener("tyto:ready", bootEditor);

  function showPreviewLink() {
    const link = document.createElement("a");
    link.id = "edit-link";
    link.href = location.pathname;
    link.textContent = "edit layout";
    document.body.appendChild(link);
  }

  function round(n) {
    return Math.round(n);
  }

  function point(event) {
    const rect = document.getElementById("canvas").getBoundingClientRect();
    const scale = rect.width / document.getElementById("canvas").offsetWidth;
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale
    };
  }

  function canMove(item) {
    return item && item.role !== "title" && item.type !== "facts" && (item.type === "image" || item.type === "text");
  }

  function find(id) {
    return window.Tyto.layout.elements.find(function (item) { return item.id === id; });
  }

  function start() {
    document.body.classList.add("editing");
    window.Tyto.paint();

    const bar = document.createElement("div");
    bar.id = "editor-bar";
    bar.innerHTML =
      '<button type="button" data-act="text">add text</button>' +
      '<button type="button" data-act="image">add image</button>' +
      '<button type="button" data-act="save">save</button>' +
      '<a href="' + location.pathname + '?edit=0">view</a>' +
      '<span class="status">drag images and text · corner resizes them · titles and details stay put · ⌘Z undo · ' +
      window.Tyto.file + "</span>";
    document.body.appendChild(bar);

    const status = bar.querySelector(".status");
    const canvas = document.getElementById("canvas");
    const HISTORY_LIMIT = 30;
    let drag = null;
    let selected = null;
    let endTextEdit = null;
    let history = [];
    let coalesce = null;

    function cloneElements() {
      return JSON.parse(JSON.stringify(window.Tyto.layout.elements));
    }

    function checkpoint(kind) {
      if (kind && coalesce && coalesce.kind === kind && Date.now() - coalesce.at < 700) {
        coalesce.at = Date.now();
        return;
      }
      history.push(cloneElements());
      if (history.length > HISTORY_LIMIT) history.shift();
      coalesce = kind ? { kind: kind, at: Date.now() } : null;
    }

    function undo() {
      const prev = history.pop();
      coalesce = null;
      if (!prev) {
        status.textContent = "nothing to undo";
        return;
      }
      window.Tyto.layout.elements = prev;
      const keep = selected && prev.some(function (el) { return el.id === selected; }) ? selected : null;
      window.Tyto.paint();
      select(keep);
      status.textContent = "undid";
    }

    function commitDrag() {
      if (!drag) return;
      const before = drag.before;
      drag = null;
      if (!before || JSON.stringify(before) === JSON.stringify(window.Tyto.layout.elements)) return;
      history.push(before);
      if (history.length > HISTORY_LIMIT) history.shift();
      coalesce = null;
    }

    function select(id) {
      selected = id;
      window.__selected = id;
      canvas.querySelectorAll(".el.selected").forEach(function (node) {
        node.classList.remove("selected");
      });
      canvas.querySelectorAll(".handle").forEach(function (node) { node.remove(); });
      const item = id && find(id);
      if (!item) {
        status.textContent = "nothing selected · " + window.Tyto.file;
        return;
      }
      const node = window.Tyto.nodeFor(id);
      node.classList.add("selected");
      const handle = document.createElement("span");
      handle.className = "handle";
      if (canMove(item)) node.appendChild(handle);
      status.textContent = item.id + "  " + item.x + ", " + item.y +
        (item.w ? "  " + item.w + "×" + (item.h || "auto") : "");
    }

    function placeInView() {
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width / canvas.offsetWidth;
      return {
        x: 80,
        y: round((window.scrollY - rect.top + 140) / scale)
      };
    }

    function readText(node) {
      return node.innerText.replace(/\u00a0/g, " ").replace(/\n$/, "");
    }

    function editText(node, item) {
      commitDrag();
      const before = cloneElements();
      const original = item.text || "";
      select(item.id);
      node.querySelectorAll(".handle").forEach(function (handle) { handle.remove(); });
      node.classList.add("editing-text");
      node.contentEditable = "true";
      endTextEdit = function (cancel) { finish(cancel); };
      node.addEventListener("blur", onBlur);
      node.addEventListener("keydown", onKey);
      node.addEventListener("input", onInput);
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "editing " + item.id + " · esc to cancel · click away to keep";

      function finish(cancel) {
        if (node.contentEditable !== "true") return;
        endTextEdit = null;
        const next = cancel ? original : readText(node);
        item.text = next;
        if (next !== original) {
          history.push(before);
          if (history.length > HISTORY_LIMIT) history.shift();
          coalesce = null;
        }
        node.textContent = item.text;
        node.contentEditable = "false";
        node.classList.remove("editing-text");
        node.removeEventListener("blur", onBlur);
        node.removeEventListener("keydown", onKey);
        node.removeEventListener("input", onInput);
        select(item.id);
      }
      function onBlur() { finish(false); }
      function onInput() { item.text = readText(node); }
      function onKey(event) {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          finish(true);
        }
      }
    }

    function editFacts(fieldEl, item) {
      commitDrag();
      const field = fieldEl.dataset.field;
      const before = cloneElements();
      const original = item[field] || "";
      select(item.id);
      window.Tyto.nodeFor(item.id).querySelectorAll(".handle").forEach(function (handle) {
        handle.remove();
      });
      fieldEl.classList.add("editing-text");
      fieldEl.contentEditable = "true";
      endTextEdit = function (cancel) { finish(cancel); };
      fieldEl.addEventListener("blur", onBlur);
      fieldEl.addEventListener("keydown", onKey);
      fieldEl.addEventListener("input", onInput);
      fieldEl.focus();
      const range = document.createRange();
      range.selectNodeContents(fieldEl);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "editing " + field + " · esc to cancel · click away to keep";

      function finish(cancel) {
        if (fieldEl.contentEditable !== "true") return;
        endTextEdit = null;
        const next = cancel ? original : readText(fieldEl);
        item[field] = next;
        if (next !== original) {
          history.push(before);
          if (history.length > HISTORY_LIMIT) history.shift();
          coalesce = null;
        }
        fieldEl.textContent = item[field];
        fieldEl.contentEditable = "false";
        fieldEl.classList.remove("editing-text");
        fieldEl.removeEventListener("blur", onBlur);
        fieldEl.removeEventListener("keydown", onKey);
        fieldEl.removeEventListener("input", onInput);
        select(item.id);
      }
      function onBlur() { finish(false); }
      function onInput() { item[field] = readText(fieldEl); }
      function onKey(event) {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          finish(true);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          finish(false);
        }
      }
    }

    canvas.addEventListener("pointerdown", function (event) {
      if (event.target.closest("#editor-bar")) return;
      const node = event.target.closest(".el");
      if ((node && node.isContentEditable) || event.target.isContentEditable) return;
      if (endTextEdit) endTextEdit(false);
      if (!node) return;
      const item = find(node.dataset.id);
      if (event.detail >= 2) {
        event.preventDefault();
        if (item.type === "facts") {
          const fieldEl = event.target.closest("[data-field]");
          if (fieldEl) editFacts(fieldEl, item);
          return;
        }
        if (item.type === "image") {
          const next = prompt("Image path", item.src || "static/");
          if (next && next !== item.src) {
            checkpoint();
            item.src = next;
            window.Tyto.paint();
            select(item.id);
          }
          return;
        }
        editText(node, item);
        return;
      }
      if (event.target.closest("a.place-link")) return;
      if (!canMove(item)) {
        select(item.id);
        return;
      }
      event.preventDefault();
      select(item.id);
      const start = point(event);
      drag = {
        id: item.id,
        mode: event.target.classList.contains("handle") ? "resize" : "move",
        startX: start.x,
        startY: start.y,
        origX: item.x,
        origY: item.y,
        origW: item.w || node.offsetWidth,
        origH: item.h || node.offsetHeight,
        before: cloneElements()
      };
      try { canvas.setPointerCapture(event.pointerId); } catch (err) { /* synthetic events */ }
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!drag) return;
      const item = find(drag.id);
      const p = point(event);
      if (drag.mode === "move") {
        item.x = round(drag.origX + (p.x - drag.startX));
        item.y = round(drag.origY + (p.y - drag.startY));
      } else {
        item.w = Math.max(48, round(drag.origW + (p.x - drag.startX)));
        item.h = Math.max(16, round(drag.origH + (p.y - drag.startY)));
      }
      window.Tyto.apply(item, window.Tyto.nodeFor(item.id));
      select(item.id);
    });

    canvas.addEventListener("pointerup", commitDrag);
    canvas.addEventListener("pointercancel", commitDrag);

    canvas.addEventListener("click", function (event) {
      if (event.target.closest("a.place-link")) return;
      if (event.target.closest("a")) event.preventDefault();
    });

    window.addEventListener("keydown", function (event) {
      const item = selected && find(selected);
      const typing = document.activeElement && document.activeElement.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        if (typing) return;
        event.preventDefault();
        undo();
        return;
      }
      if (!item || typing || !canMove(item)) return;
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") { checkpoint("nudge"); item.x -= step; event.preventDefault(); }
      else if (event.key === "ArrowRight") { checkpoint("nudge"); item.x += step; event.preventDefault(); }
      else if (event.key === "ArrowUp") { checkpoint("nudge"); item.y -= step; event.preventDefault(); }
      else if (event.key === "ArrowDown") { checkpoint("nudge"); item.y += step; event.preventDefault(); }
      else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        checkpoint();
        window.Tyto.layout.elements = window.Tyto.layout.elements.filter(function (el) {
          return el.id !== item.id;
        });
        selected = null;
        window.__selected = null;
        window.Tyto.paint();
        select(null);
        return;
      } else return;
      window.Tyto.apply(item, window.Tyto.nodeFor(item.id));
      select(item.id);
    });

    bar.addEventListener("click", function (event) {
      const act = event.target.dataset.act;
      if (act === "text") addText();
      if (act === "image") addImage();
      if (act === "save") save();
    });

    function addText() {
      const at = placeInView();
      const standard = window.Tyto.article;
      const item = {
        id: "text-" + Date.now(),
        type: "text",
        text: "new text",
        x: standard.textX,
        y: at.y,
        w: standard.textW,
        fontSize: standard.fontSize
      };
      checkpoint();
      window.Tyto.layout.elements.push(item);
      window.Tyto.paint();
      select(item.id);
    }

    function addImage() {
      const src = prompt("Image path", "static/");
      if (!src) return;
      const at = placeInView();
      const item = {
        id: "image-" + Date.now(),
        type: "image",
        src: src,
        alt: "",
        x: at.x,
        y: at.y,
        w: 280,
        h: 360
      };
      checkpoint();
      window.Tyto.layout.elements.push(item);
      window.Tyto.paint();
      select(item.id);
    }

    async function save() {
      const editing = canvas.querySelector(".editing-text");
      if (editing) editing.blur();
      status.textContent = "saving…";
      try {
        const res = await fetch("/__save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: window.Tyto.file, layout: window.Tyto.layout })
        });
        if (!res.ok) throw new Error(await res.text());
        history = [];
        coalesce = null;
        status.textContent = "saved " + window.Tyto.file;
      } catch (err) {
        download();
        status.textContent = "server did not save (" + err.message + "). downloaded a copy instead — use python3 server.py";
      }
    }

    function download() {
      const blob = new Blob([JSON.stringify(window.Tyto.layout, null, 2) + "\n"], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = window.Tyto.file.split("/").pop();
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }
})();
