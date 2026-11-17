(function () {
  const pages = [
    ["about", "about.html", "about"],
    ["mobility", "mobility.html", "mobility"],
    ["habitat", "habitat.html", "habitat"],
    ["ceramics", "ceramics.html", "ceramics"]
  ];

  function withPreview(href) {
    if (new URLSearchParams(location.search).get("edit") !== "0") return href;
    const hashAt = href.indexOf("#");
    const hash = hashAt === -1 ? "" : href.slice(hashAt);
    const base = hashAt === -1 ? href : href.slice(0, hashAt);
    return base + (base.includes("?") ? "&" : "?") + "edit=0" + hash;
  }

  function mount(page) {
    const header = document.createElement("header");
    header.className = "site-header";

    const brand = document.createElement("a");
    brand.className = "brand";
    brand.href = withPreview("index.html");
    const word = document.createElement("span");
    word.textContent = "tyto";
    const mark = document.createElement("img");
    mark.src = "static/mark.png";
    mark.alt = "";
    brand.append(word, mark);

    const nav = document.createElement("nav");
    nav.className = "site-nav";
    pages.forEach(function (item) {
      const link = document.createElement("a");
      link.href = withPreview(item[1]);
      link.textContent = item[2];
      if (item[0] === page) link.classList.add("current");
      nav.appendChild(link);
    });

    header.append(brand, nav);

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    const instagram = document.createElement("a");
    instagram.href = "https://www.instagram.com/tyto.habitat";
    instagram.target = "_blank";
    instagram.rel = "noopener";
    instagram.textContent = "instagram.com/tyto.habitat";
    footer.append(
      document.createTextNode("salt.reuben@gmail.com / "),
      instagram,
      document.createTextNode(" / birmingham, uk ©")
    );

    const stage = document.getElementById("stage");
    document.body.insertBefore(header, stage);
    document.body.appendChild(footer);
  }

  function sections(list) {
    if (!list || !list.length) return;
    const nav = document.createElement("nav");
    nav.className = "section-nav";
    nav.setAttribute("aria-label", "Sections");

    list.forEach(function (section) {
      const link = document.createElement("a");
      link.href = "#" + section.target;
      link.dataset.target = section.target;
      link.textContent = section.label;
      link.addEventListener("click", function (event) {
        event.preventDefault();
        const el = document.querySelector('[data-id="' + CSS.escape(section.target) + '"]');
        if (!el) return;
        const clearance = nav.getBoundingClientRect().bottom + 18;
        const top = el.getBoundingClientRect().top + window.scrollY - clearance;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
      nav.appendChild(link);
    });

    document.body.appendChild(nav);

    function spy() {
      const line = window.scrollY + 140;
      let current = nav.querySelector("a");
      nav.querySelectorAll("a").forEach(function (link) {
        const el = document.querySelector('[data-id="' + CSS.escape(link.dataset.target) + '"]');
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= line) current = link;
      });
      nav.querySelectorAll("a").forEach(function (link) {
        link.classList.toggle("current", link === current);
      });
    }

    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }

  window.TytoChrome = { mount: mount, sections: sections };
})();
