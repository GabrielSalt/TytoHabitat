(function () {
  const KEY = "cb1_5ar8_1_49c16f57673ccdec29d9806c";
  const STYLES = [
    { id: "voyager", name: "voyager", on: "voyager", off: "voyager_nolabels" },
    { id: "positron", name: "positron", on: "light_all", off: "light_nolabels" },
    { id: "dark", name: "dark matter", on: "dark_all", off: "dark_nolabels" }
  ];

  function withPreview(href) {
    if (new URLSearchParams(location.search).get("edit") !== "0") return href;
    const hashAt = href.indexOf("#");
    const hash = hashAt === -1 ? "" : href.slice(hashAt);
    const base = hashAt === -1 ? href : href.slice(0, hashAt);
    return base + (base.includes("?") ? "&" : "?") + "edit=0" + hash;
  }

  function factRow(label, value) {
    const row = document.createElement("div");
    row.textContent = label + ": " + (value || "");
    return row;
  }

  function articleHref(item) {
    return withPreview("habitat.html#" + encodeURIComponent(item.target || item.id));
  }

  async function boot() {
    if (window.TytoChrome) TytoChrome.mount("map");
    const res = await fetch("data/habitat.json");
    if (!res.ok) throw new Error("Could not load habitat places");
    const layout = await res.json();
    const places = (layout.elements || []).filter(function (item) {
      return item.type === "facts" && typeof item.lat === "number" && typeof item.lng === "number";
    });

    const frame = document.querySelector(".map-frame");
    const detail = document.getElementById("map-detail");
    const stage = document.getElementById("stage");

    function frameSize() {
      const styles = getComputedStyle(stage);
      const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;
      const panel = 280;
      const innerH = stage.clientHeight - padY;
      const innerW = stage.clientWidth - padX - gap - panel;
      return Math.max(180, Math.floor(Math.min(innerH, innerW)));
    }

    function applyFrame() {
      const size = frameSize();
      frame.style.width = size + "px";
      frame.style.height = size + "px";
    }

    applyFrame();
    const map = L.map("map").setView([52.2, 5.2], 7);
    let styleId = "voyager";
    let labels = true;
    let currentId = "";

    function tileUrl() {
      const style = STYLES.find(function (item) { return item.id === styleId; });
      const name = labels ? style.on : style.off;
      return "https://basemaps.cartocdn.com/rastertiles/" + name + "/{z}/{x}/{y}.png?key=" + KEY;
    }

    const tiles = L.tileLayer(tileUrl(), {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    const switcher = document.createElement("div");
    switcher.className = "map-switch";
    const styleGroup = document.createElement("div");
    styleGroup.className = "group";
    styleGroup.setAttribute("role", "group");
    styleGroup.setAttribute("aria-label", "Map style");
    const labelGroup = document.createElement("div");
    labelGroup.className = "group";
    labelGroup.setAttribute("role", "group");
    labelGroup.setAttribute("aria-label", "Map labels");

    function paintSwitch() {
      styleGroup.querySelectorAll("button").forEach(function (button) {
        const on = button.dataset.style === styleId;
        button.classList.toggle("current", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
      labelGroup.querySelectorAll("button").forEach(function (button) {
        const on = (button.dataset.labels === "on") === labels;
        button.classList.toggle("current", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    STYLES.forEach(function (style) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.style = style.id;
      button.textContent = style.name;
      button.addEventListener("click", function () {
        styleId = style.id;
        tiles.setUrl(tileUrl());
        paintSwitch();
      });
      styleGroup.appendChild(button);
    });

    [["on", "labels"], ["off", "no labels"]].forEach(function (pair) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.labels = pair[0];
      button.textContent = pair[1];
      button.addEventListener("click", function () {
        labels = pair[0] === "on";
        tiles.setUrl(tileUrl());
        paintSwitch();
      });
      labelGroup.appendChild(button);
    });

    switcher.append(styleGroup, labelGroup);
    paintSwitch();
    document.getElementById("map").appendChild(switcher);

    const markers = {};
    const group = [];
    places.forEach(function (item) {
      const marker = L.circleMarker([item.lat, item.lng], {
        radius: 7,
        color: "#111",
        weight: 2,
        fillColor: "#a1aafe",
        fillOpacity: 1
      }).addTo(map);
      marker.bindTooltip(item.name || item.where || "", {
        permanent: true,
        direction: "right",
        offset: [10, 0],
        className: "place-label",
        opacity: 1,
        interactive: true
      });
      marker.on("click", function () { show(item.id); });
      marker.getTooltip().on("click", function () { show(item.id); });
      markers[item.id] = { marker: marker, item: item };
      group.push(marker);
    });

    function paintMarkers() {
      Object.keys(markers).forEach(function (id) {
        const on = id === currentId;
        markers[id].marker.setStyle({
          radius: on ? 9 : 7,
          weight: on ? 3 : 2
        });
      });
    }

    function paintDetail(item) {
      detail.replaceChildren();
      if (!item) return;
      const title = document.createElement("h2");
      title.textContent = item.name || item.where || item.id;
      const button = document.createElement("a");
      button.className = "map-article";
      button.href = articleHref(item);
      button.textContent = "read";
      detail.append(title, factRow("when", item.when), factRow("where", item.where), factRow("who", item.who), button);
    }

    function show(id) {
      const place = id && markers[id];
      if (place) {
        currentId = id;
        paintMarkers();
        paintDetail(place.item);
        map.setView(place.marker.getLatLng(), 15);
        const next = "#" + encodeURIComponent(id);
        if (location.hash !== next) history.replaceState(null, "", next);
        return;
      }
      currentId = "";
      paintMarkers();
      paintDetail(null);
      if (group.length) map.fitBounds(L.featureGroup(group).getBounds(), { padding: [56, 28] });
      else map.setView([52.2, 5.2], 7);
    }

    show(decodeURIComponent(location.hash.replace(/^#/, "")));
    window.addEventListener("hashchange", function () {
      show(decodeURIComponent(location.hash.replace(/^#/, "")));
    });
    function refit() {
      applyFrame();
      map.invalidateSize();
      if (currentId && markers[currentId]) {
        map.setView(markers[currentId].marker.getLatLng(), map.getZoom(), { animate: false });
        return;
      }
      if (group.length) map.fitBounds(L.featureGroup(group).getBounds(), { padding: [56, 28] });
    }

    window.addEventListener("resize", refit);
    requestAnimationFrame(refit);
  }

  boot().catch(function (err) {
    const note = document.createElement("p");
    note.style.padding = "24px";
    note.textContent = err.message;
    document.body.appendChild(note);
  });
})();
