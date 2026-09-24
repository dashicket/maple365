(() => {
  "use strict";
  const root = document.documentElement;
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = [];
  const assigned = new WeakSet();
  const active = new Set();
  let observer;
  let objectObserver;
  const waiting = new WeakMap();
  let started = false;
  const query = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const canAnimate = () => !preference.matches && typeof Element.prototype.animate === "function";

  // If motion is unavailable or interrupted, every object remains readable.
  function release() {
    root.classList.remove("motion-ready");
    observer?.disconnect();
    objectObserver?.disconnect();
    active.forEach((animation) => animation.cancel());
    active.clear();
    root.dataset.pageReady = "true";
  }

  const effects = {
    rise: [{ opacity: 0, translate: "0 19px" }, { opacity: 1, translate: "0 0" }],
    soft: [{ opacity: 0, translate: "0 9px" }, { opacity: 1, translate: "0 0" }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    heading: [{ opacity: 0, translate: "0 23px", clipPath: "inset(0 0 100% 0)" }, { opacity: 1, translate: "0 0", clipPath: "inset(0 0 0 0)" }],
    icon: [{ opacity: 0, scale: "0.8", rotate: "-9deg" }, { opacity: 1, scale: "1", rotate: "0deg" }],
    number: [{ opacity: 0, scale: "0.88" }, { opacity: 1, scale: "1" }],
    image: [{ opacity: 0, scale: "0.94", rotate: "-3deg", translate: "0 15px" }, { opacity: 1, scale: "1", rotate: "0deg", translate: "0 0" }],
    settle: [{ opacity: 0, translate: "0 -16px", rotate: "-1deg" }, { opacity: 1, translate: "0 0", rotate: "0deg" }],
    leafLeft: [{ opacity: 0, translate: "-4px -18px", rotate: "-2deg" }, { opacity: 1, translate: "0 0", rotate: "0deg" }],
    leafRight: [{ opacity: 0, translate: "6px -22px", rotate: "2.5deg" }, { opacity: 1, translate: "0 0", rotate: "0deg" }],
    line: [{ opacity: 0, scale: "0.94 1" }, { opacity: 1, scale: "1 1" }],
  };
  const durations = { rise: 650, soft: 560, fade: 500, heading: 760, icon: 740, number: 720, image: 1050, settle: 1250, leafLeft: 900, leafRight: 1100, line: 650 };

  function animate(element, kind = "soft", delay = 0) {
    objectObserver?.unobserve(element);
    waiting.delete(element);
    element.classList.add("is-revealed");
    if (!canAnimate()) return;
    element.getAnimations().filter((item) => active.has(item)).forEach((item) => item.cancel());
    const frames = effects[kind].map((frame) => ({ ...frame }));
    frames[frames.length - 1].opacity = Number(getComputedStyle(element).opacity);
    const animation = element.animate(frames, {
      duration: durations[kind], delay, easing: "cubic-bezier(.2,.7,.25,1)", fill: "backwards",
    });
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
  }

  function group(anchor, specs, offset = 0) {
    if (!anchor) return;
    const items = [];
    specs.forEach(([selector, kind = "soft", delay = 0, stagger = 0]) => {
      const elements = selector === "self" ? [anchor] : query(selector, anchor);
      elements.forEach((element, index) => {
        if (assigned.has(element)) return;
        assigned.add(element);
        element.dataset.reveal = kind;
        items.push({ element, kind, delay: offset + delay + index * stagger });
      });
    });
    if (items.length) groups.push({ anchor, items, played: false });
  }
  function each(selector, specs, stagger = 0, cycle = 4) {
    query(selector).forEach((element, index) => group(element, specs, (index % cycle) * stagger));
  }
  function play(record, instant = false, replay = false) {
    if (record.played && !replay) return;
    record.played = true;
    record.items.forEach(({ element, kind, delay }) => {
      if (instant) {
        objectObserver?.unobserve(element);
        waiting.delete(element);
        element.getAnimations().filter((item) => active.has(item)).forEach((item) => item.cancel());
        element.classList.add("is-revealed");
      } else {
        const bounds = element.getBoundingClientRect();
        if (objectObserver && (bounds.top >= innerHeight - 20 || bounds.bottom <= 0)) {
          waiting.set(element, { kind, delay: Math.min(delay, 240) });
          objectObserver.observe(element);
        } else animate(element, kind, delay);
      }
    });
    observer?.unobserve(record.anchor);
  }
  function buildChoreography() {
    // Preserve headings and their text; only wrap each existing line for independent timing.
    query(".welcome-copy h1, .page-intro h1").forEach((heading) => {
      [...heading.childNodes].forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          const span = document.createElement("span");
          span.className = "motion-line";
          node.replaceWith(span);
          span.append(node);
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR") node.classList.add("motion-line");
      });
    });
    group(document.querySelector(".header-inner"), [
      [".brand", "fade", 80],
      [".desktop-nav a", "soft", 110, 65], [".header-actions .button, .menu-toggle", "fade", 330],
    ]);
    group(document.querySelector(".hero-introduction"), [
      [".eyebrow", "soft", 70], [".motion-line", "heading", 160, 140],
      [".welcome-copy > p:last-child", "soft", 420], [".hero-consult", "soft", 530],
    ]);
    each(".hero-backdrop", [["self", "fade", 0]]);
    each(".terrain img", [["self", "settle", 180]]);
    // Animate the outer wrappers so the leaves retain their individual resting angles.
    each(".hero-leaf-pile-left", [["self", "leafLeft", 320]]);
    each(".hero-leaf-pile-right", [["self", "leafRight", 500]]);
    group(document.querySelector(".stage-dock"), [
      ["self", "fade", 260], [":scope > a", "soft", 380, 65],
      [".dock-orb", "icon", 460], [".dock-contact > span:last-child", "fade", 590],
    ]);
    each(".home-heading, .section-title", [["p:first-child", "soft"], ["h2", "heading", 100], ["p:not(:first-child)", "soft", 220]]);
    const columns = document.querySelector(".overview-cards");
    const cardColumns = columns ? getComputedStyle(columns).gridTemplateColumns.split(" ").length : 4;
    each(".overview-card", [
      ["self", "rise"], [".overview-icon", "icon", 90], ["h3", "soft", 150],
      [".overview-rate > span", "fade", 220], [".overview-rate > strong", "number", 270],
      [".overview-description", "soft", 340], [".overview-more", "soft", 410],
    ], 100, cardColumns);
    each(".overview-note, .service-conditions", [["self", "soft"]]);
    each(".journey-tab", [[".journey-tab-icon", "icon"], [":scope > span:last-child", "soft", 130]], 80);
    each(".journey-copy", [[".journey-eyebrow", "soft"], ["h3", "heading", 90], ["p:last-child", "soft", 210]]);
    each(".journey-visual", [[".journey-picture", "image", 70], [".journey-next", "number", 400]]);
    each(".contact-symbol", [["img", "icon"]]);
    group(document.querySelector(".home-contact"), [[".home-eyebrow", "soft", 120], ["h2", "heading", 210], [".home-contact-description", "soft", 340], [".home-contact-actions > *", "soft", 440, 90]]);
    each(".useful-links h2", [["self", "fade"]]);
    each(".useful-links-grid > a", [["self", "soft"], [":scope > .icon:first-child", "icon", 80]], 75);
    each(".page-intro", [[".breadcrumb", "fade", 30], [".eyebrow", "soft", 110], [".motion-line", "heading", 200, 125], [".intro-description", "soft", 470], [".page-emblem", "image", 190]]);
    each(".page-tabs > a", [["self", "soft"]], 65);
    each(".service-detail-heading", [[".large-index", "number", 80], [":scope > .icon", "icon"], [".eyebrow", "soft", 120], ["h2", "heading", 200], [".service-detail-rate > span", "fade", 270], [".service-detail-rate > strong, .service-policy-label", "number", 340]]);
    each(".service-detail-content > div", [["h3", "soft"], ["p", "soft", 110]]);
    each(".service-detail-content > .detail-link", [["self", "soft", 150]]);
    each(".steps > li", [["self", "rise"], [".step-symbol", "icon", 90], ["h3", "soft", 190], ["p", "soft", 260], [".guide-step-note", "fade", 340]], 80);
    each(".preparation > div", [[".eyebrow", "soft"], ["h2", "heading", 110]]);
    each(".check-list > li", [[":scope > .icon", "icon"], ["h3", "soft", 80], ["p", "soft", 160]], 45);
    each(".guide-notes > h2, .guide-notes > .detail-link", [["self", "soft"]]);
    each(".guide-notes li", [["self", "soft"]], 65);
    each(".story-image", [["self", "image"], ["span", "fade", 300]]);
    each(".story-copy > *", [["self", "soft"]], 95);
    each(".contact-strip > div:first-child", [[".eyebrow", "soft"], ["h2", "heading", 100], ["p:not(.eyebrow)", "soft", 220]]);
    each(".contact-strip-actions .button", [["self", "soft", 200]], 90);
    each(".search-form", [["self", "line"]]);
    each(".filter-buttons > button", [["self", "soft"]], 55);
    each(".result-count", [["self", "fade"]]);
    each(".faq-item", [["summary", "soft"]], 45, 3);
    each(".notice-article", [[".notice-category", "soft"], ["h2", "heading", 80], ["p", "soft", 180, 90], [".detail-link", "soft", 360]]);
    each(".sitemap-groups h2, .sitemap-groups li, .legal-content > :not(ul):not(ol), .legal-content li, .error-page > *", [["self", "soft"]], 70);
    group(document.querySelector(".footer-brand-block"), [[".brand", "soft"], ["p", "fade", 130]]);
    each(".site-footer nav > a", [["self", "soft"]], 50);
    each(".footer-meta > *", [["self", "fade"]], 75);
  }

  function startReveals() {
    if (started) return;
    started = true;
    if (!("IntersectionObserver" in window)) {
      groups.forEach((record) => play(record, true));
      return;
    }
    const byAnchor = new Map(groups.map((record) => [record.anchor, record]));
    // A long card or article can start entering while its lower objects are still offscreen.
    // Those objects receive their own viewport trigger instead of spending their animation early.
    objectObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const item = waiting.get(entry.target);
        if (entry.isIntersecting && item) animate(entry.target, item.kind, item.delay);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -20px 0px" });
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) play(byAnchor.get(entry.target));
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
    groups.filter((record) => !record.played).forEach((record) => observer.observe(record.anchor));
    // Elements fixed to the viewport must not wait for an unreachable scroll threshold.
    groups.filter(({ anchor }) => anchor.closest(".site-header")).forEach((record) => play(record));
  }

  function interactions() {
    document.addEventListener("focusin", (event) => {
      groups.filter(({ anchor }) => anchor.contains(event.target)).forEach((record) => play(record, true, true));
    });
    document.addEventListener("danpung:menuopen", (event) => {
      query(":scope > a, .mobile-nav-actions > button", event.detail.menu).forEach((element, index) => animate(element, "soft", index * 45));
    });
    document.addEventListener("danpung:contactopen", (event) => {
      const dialog = event.detail.dialog;
      animate(dialog, "soft");
      query(".eyebrow, h2, .contact-description, .contact-countdown, .contact-channel", dialog)
        .filter((element) => !element.closest("[hidden]"))
        .forEach((element, index) => animate(element, "soft", 45 + index * 45));
    });
    query(".faq-item").forEach((item) => item.addEventListener("toggle", () => {
      if (item.open) query(".faq-answer > *", item).forEach((element, index) => animate(element, "soft", index * 55));
    }));
    document.addEventListener("danpung:faqfilter", () => {
      groups.filter(({ anchor }) => anchor.matches(".faq-item") && !anchor.hidden).forEach((record) => play(record, true));
      let index = 0;
      query(".faq-item:not([hidden]) summary").forEach((element) => animate(element, "soft", Math.min(index++ * 45, 225)));
      const empty = document.querySelector(".empty-state:not([hidden])");
      if (empty) animate(empty, "soft");
    });
  }

  function init() {
    if (!canAnimate()) { release(); return; }
    try {
      root.classList.add("motion-ready");
      buildChoreography();
      interactions();
      startReveals();
      root.dataset.pageReady = "true";
      document.dispatchEvent(new Event("danpung:ready"));
    } catch {
      release();
    }
  }
  preference.addEventListener("change", (event) => { if (event.matches) { release(); } });
  window.addEventListener("pageshow", (event) => { if (event.persisted) { release(); } });
  window.addEventListener("beforeprint", release);
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
