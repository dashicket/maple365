(() => {
  "use strict";
  const config = window.DANPUNG_PAY || {};
  const menuButton = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");
  const dialog = document.querySelector("#contact-dialog");
  const siteHeader = document.querySelector(".site-header");
  let contactTrigger = null;

  if (siteHeader) {
    const updateHeader = () => siteHeader.classList.toggle("is-scrolled", window.scrollY > 16);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("pageshow", updateHeader);
  }

  // Keep the hero button aligned with the headline across fonts and viewport sizes.
  const heroHeadline = document.querySelector(".welcome-copy h1 em");
  const heroConsult = document.querySelector(".hero-consult");
  if (heroHeadline && heroConsult) {
    const matchHeadlineWidth = () => {
      const width = heroHeadline.getBoundingClientRect().width;
      if (width > 0) heroConsult.style.setProperty("--hero-consult-width", `${width}px`);
    };
    matchHeadlineWidth();
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(matchHeadlineWidth).observe(heroHeadline);
    } else {
      window.addEventListener("resize", matchHeadlineWidth);
      document.fonts?.ready.then(matchHeadlineWidth);
    }
  }

  function closeMenu(restoreFocus = false) {
    if (!menuButton || !mobileNav) return;
    mobileNav.hidden = true;
    siteHeader?.classList.remove("is-menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "메뉴 열기");
    if (restoreFocus) menuButton.focus();
  }

  menuButton?.addEventListener("click", () => {
    const opening = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(opening));
    menuButton.setAttribute("aria-label", opening ? "메뉴 닫기" : "메뉴 열기");
    mobileNav.hidden = !opening;
    siteHeader?.classList.toggle("is-menu-open", opening);
    if (opening) document.dispatchEvent(new CustomEvent("danpung:menuopen", { detail: { menu: mobileNav } }));
  });
  mobileNav
    ?.querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menuButton?.getAttribute("aria-expanded") === "true" &&
      !dialog?.open
    )
      closeMenu(true);
  });
  window
    .matchMedia("(min-width: 900px)")
    .addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });

  function consultationUrl() {
    const value = typeof config.kakaoUrl === "string" ? config.kakaoUrl.trim() : "";
    if (!/^https?:\/\//i.test(value)) return "";
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function consultationPhone() {
    const value = typeof config.phoneNumber === "string" ? config.phoneNumber.trim().replace(/^tel:/i, "") : "";
    if (!/^\+?[\d\s().-]+$/.test(value)) return null;
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    const international = value.startsWith("+");
    const number = (international ? "+" : "") + digits;
    let label = number;
    if (!international) {
      if (/^02\d{7,8}$/.test(digits)) label = digits.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
      else if (/^0\d{9,10}$/.test(digits)) label = digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
      else if (digits.length === 8) label = digits.replace(/^(\d{4})(\d{4})$/, "$1-$2");
    }
    return { href: "tel:" + number, label };
  }

  const kakaoUrl = consultationUrl();
  const phone = consultationPhone();
  const choiceView = dialog?.querySelector('[data-contact-view="choice"]');
  const phoneView = dialog?.querySelector('[data-contact-view="phone"]');
  let redirectTimer;
  const stopRedirect = () => {
    clearInterval(redirectTimer);
    redirectTimer = undefined;
  };
  function showChannelUnavailable(view) {
    const status = view?.querySelector(".contact-status");
    if (!status) return;
    status.textContent = "카카오톡 상담 채널을 준비 중입니다.";
    status.hidden = false;
  }
  function openContact(mode, trigger) {
    if (!dialog || !choiceView || !phoneView) return;
    stopRedirect();
    if (trigger && !dialog.contains(trigger)) {
      contactTrigger = mobileNav?.contains(trigger) ? menuButton : trigger;
      closeMenu();
    }
    dialog.querySelectorAll(".contact-status").forEach((status) => {
      status.hidden = true;
      status.textContent = "";
    });
    const phoneMode = mode === "phone";
    choiceView.hidden = phoneMode;
    phoneView.hidden = !phoneMode;
    const titleId = phoneMode ? "phone-contact-title" : "contact-title";
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", phoneMode ? "phone-contact-description" : "contact-description");
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modal-open");
    document.getElementById(titleId)?.focus({ preventScroll: true });
    if (phoneMode) {
      const countdown = phoneView.querySelector("[data-phone-countdown]");
      countdown.hidden = !kakaoUrl;
      if (kakaoUrl) {
        const deadline = Date.now() + 3000;
        countdown.querySelector("strong").textContent = "3";
        redirectTimer = setInterval(() => {
          const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
          countdown.querySelector("strong").textContent = String(seconds);
          if (seconds === 0) {
            stopRedirect();
            if (dialog.open && !phoneView.hidden) {
              dialog.close();
              window.location.assign(kakaoUrl);
            }
          }
        }, 200);
      } else showChannelUnavailable(phoneView);
    }
    document.dispatchEvent(new CustomEvent("danpung:contactopen", { detail: { dialog } }));
  }
  document.querySelectorAll("[data-contact]").forEach((button) => {
    button.addEventListener("click", () => {
      const channel = button.dataset.contact;
      if (channel === "kakao" && kakaoUrl) {
        closeMenu();
        window.open(kakaoUrl, "_blank", "noopener,noreferrer");
        return;
      }
      openContact(channel === "phone" ? "phone" : "choice", button);
      if (channel === "kakao" && !kakaoUrl) showChannelUnavailable(choiceView);
    });
  });
  dialog?.querySelector('[data-contact-channel="phone"]')?.addEventListener("click", () => openContact("phone"));
  dialog?.querySelectorAll("[data-kakao-link]").forEach((link) => {
    if (kakaoUrl) {
      link.href = kakaoUrl;
      if (choiceView.contains(link)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    }
    link.addEventListener("click", (event) => {
      if (!kakaoUrl) {
        event.preventDefault();
        showChannelUnavailable(link.closest("[data-contact-view]"));
        return;
      }
      stopRedirect();
      dialog.close();
    });
  });
  dialog
    ?.querySelectorAll("[data-close-dialog]")
    .forEach((button) =>
      button.addEventListener("click", () => { stopRedirect(); dialog.close(); }),
    );
  dialog?.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      stopRedirect();
      dialog.close();
    }
  });
  dialog?.addEventListener("cancel", stopRedirect);
  dialog?.addEventListener("close", () => {
    stopRedirect();
    document.body.classList.remove("modal-open");
    contactTrigger?.focus({ preventScroll: true });
  });
  window.addEventListener("pagehide", stopRedirect);

  // Keep one answer open per FAQ group while retaining native details behavior.
  document.querySelectorAll(".faq-item").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      item.parentElement
        .querySelectorAll(".faq-item[open]")
        .forEach((other) => {
          if (other !== item) other.open = false;
        });
    });
  });

  // A slow, visible-only tour. Tabs and keyboard navigation remain available when paused.
  const journeyTabs = [...document.querySelectorAll(".journey-tab")];
  const journey = document.querySelector(".home-journey");
  if (journey && journeyTabs.length) {
    const panels = journey.querySelector(".journey-panels");
    const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
    const hoverPreference = matchMedia("(hover: hover)");
    const interval = 10000;
    let selectedIndex = 0;
    let remaining = interval;
    let timer = 0;
    let startedAt = 0;
    let panelAnimation;
    let visible = false;
    let hovered = false;
    let pageAway = false;
    let printing = false;
    journey.classList.add("journey-enhanced");

    journeyTabs.slice(0, -1).forEach((tab) => {
      const connector = document.createElement("span");
      connector.className = "journey-connector";
      connector.setAttribute("aria-hidden", "true");
      tab.prepend(connector);
    });

    function selectJourney(index, focus = false, animate = true) {
      selectedIndex = index;
      clearTimeout(timer);
      timer = 0;
      remaining = interval;
      panelAnimation?.cancel();
      journeyTabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(tab.getAttribute("aria-controls"));
        panel.hidden = !selected;
        panel.inert = !selected;
      });
      const tab = journeyTabs[index];
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      // Animate only the detail panel; its text is always visible without motion.js.
      if (animate && !motionPreference.matches && typeof panel.animate === "function") {
        panelAnimation = panel.animate(
          [{ opacity: 0, translate: "10px 0" }, { opacity: 1, translate: "0 0" }],
          { duration: 350, easing: "ease-out" }
        );
      }
      if (focus) tab.focus({ preventScroll: true });
    }
    function syncPlayback() {
      const focusInside = journey.contains(document.activeElement);
      const running = visible && !hovered && !focusInside && !document.hidden && !motionPreference.matches && !dialog?.open && !pageAway && !printing;
      journey.dataset.autoplay = running ? "playing" : "paused";
      panels.setAttribute("aria-live", running ? "off" : "polite");
      if (running && !timer) {
        startedAt = performance.now();
        timer = setTimeout(() => {
          timer = 0;
          selectJourney((selectedIndex + 1) % journeyTabs.length);
          syncPlayback();
        }, remaining);
      } else if (!running && timer) {
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
        clearTimeout(timer);
        timer = 0;
      }
    }
    journeyTabs.forEach((tab, index) => {
      tab.addEventListener("click", () => { selectJourney(index); syncPlayback(); });
      tab.addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % journeyTabs.length;
        if (event.key === "ArrowLeft") next = (index - 1 + journeyTabs.length) % journeyTabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = journeyTabs.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        selectJourney(next, true);
        syncPlayback();
      });
    });
    journey.querySelectorAll("[data-journey-next]").forEach((button) => {
      button.addEventListener("click", () => {
        selectJourney((selectedIndex + 1) % journeyTabs.length, true);
        syncPlayback();
      });
    });
    journey.addEventListener("mouseenter", () => { hovered = hoverPreference.matches; syncPlayback(); });
    journey.addEventListener("mouseleave", () => { hovered = false; syncPlayback(); });
    journey.addEventListener("focusin", syncPlayback);
    journey.addEventListener("focusout", () => queueMicrotask(syncPlayback));
    document.addEventListener("visibilitychange", syncPlayback);
    document.addEventListener("danpung:contactopen", syncPlayback);
    dialog?.addEventListener("close", syncPlayback);
    motionPreference.addEventListener("change", syncPlayback);
    window.addEventListener("pagehide", () => { pageAway = true; syncPlayback(); });
    window.addEventListener("pageshow", () => { pageAway = false; syncPlayback(); });
    window.addEventListener("beforeprint", () => { printing = true; syncPlayback(); });
    window.addEventListener("afterprint", () => { printing = false; syncPlayback(); });
    selectJourney(0, false, false);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        if (visible) journey.querySelectorAll("img").forEach((image) => { image.loading = "eager"; });
        syncPlayback();
      }, { threshold: [0, 0.15] }).observe(journey);
    } else { visible = true; }
    syncPlayback();
  }

  const searchForm = document.querySelector(".search-form");
  const searchInput = document.querySelector("#faq-search");
  if (searchForm && searchInput) {
    const items = [...document.querySelectorAll(".faq-list .faq-item")];
    const filters = [...document.querySelectorAll("[data-filter]")];
    const resultCount = document.querySelector(".result-count");
    const emptyState = document.querySelector(".empty-state");
    let category = "all";
    const normalize = (value) =>
      value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
    function filterQuestions() {
      const query = normalize(searchInput.value);
      let total = 0;
      items.forEach((item) => {
        const matches =
          (category === "all" || item.dataset.category === category) &&
          normalize(item.textContent).includes(query);
        item.hidden = !matches;
        if (!matches) item.open = false;
        if (matches) total++;
      });
      resultCount.textContent = `총 ${total}개의 질문`;
      emptyState.hidden = total > 0;
      document.dispatchEvent(new Event("danpung:faqfilter"));
    }
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      filterQuestions();
    });
    searchInput.addEventListener("input", filterQuestions);
    filters.forEach((button) =>
      button.addEventListener("click", () => {
        category = button.dataset.filter;
        filters.forEach((filter) =>
          filter.setAttribute("aria-pressed", String(filter === button)),
        );
        filterQuestions();
      }),
    );
    document
      .querySelector("[data-reset-search]")
      ?.addEventListener("click", () => {
        searchInput.value = "";
        category = "all";
        filters.forEach((filter) =>
          filter.setAttribute(
            "aria-pressed",
            String(filter.dataset.filter === "all"),
          ),
        );
        filterQuestions();
        searchInput.focus();
      });
  }

  const businessFields = [
    ["상호", config.businessName],
    ["대표", config.representative],
    ["사업자등록번호", config.registrationNumber],
    ["주소", config.address],
    ["전화", phone?.label],
    ["이메일", config.email],
  ].filter(([, value]) => typeof value === "string" && value.trim());
  document.querySelectorAll("[data-business]").forEach((element) => {
    element.replaceChildren();
    businessFields.forEach(([label, value], index) => {
      if (index) element.append("  |  ");
      element.append(`${label} `);
      if (label === "전화") {
        const link = document.createElement("a");
        link.href = phone.href;
        link.textContent = phone.label;
        element.append(link);
      } else element.append(value.trim());
    });
    element.hidden = businessFields.length === 0;
  });
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
})();
