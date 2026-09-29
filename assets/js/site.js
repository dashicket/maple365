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
    if (digits.length < 8 || digits.length > 15 || /^0+$/.test(digits)) return null;
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
  let phoneRedirectTimer = null;
  let phoneCountdownTimer = null;
  let contactResizeAnimation = null;
  const phoneView = document.createElement("div");
  phoneView.className = "contact-phone-notice";
  phoneView.hidden = true;
  phoneView.innerHTML = '<h2 id="phone-notice-title" tabindex="-1">지금은 전화 문의가 어렵습니다.</h2><p class="contact-status" id="phone-notice-description" role="status"></p>';
  dialog?.append(phoneView);

  function cancelPhoneRedirect() {
    window.clearTimeout(phoneRedirectTimer);
    window.clearInterval(phoneCountdownTimer);
    phoneRedirectTimer = null;
    phoneCountdownTimer = null;
  }
  function closeContact() {
    cancelPhoneRedirect();
    contactResizeAnimation?.cancel();
    dialog?.close();
  }
  function showContactStatus(status, message) {
    if (!status) return;
    const before = dialog?.open ? dialog.getBoundingClientRect().height : 0;
    contactResizeAnimation?.cancel();
    status.replaceChildren(message);
    status.hidden = false;
    const after = dialog?.open ? dialog.getBoundingClientRect().height : 0;
    if (before && after !== before && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      contactResizeAnimation = dialog.animate([
        { height: `${before}px`, overflow: "hidden" },
        { height: `${after}px`, overflow: "hidden" },
      ], { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
    }
  }
  function showChannelUnavailable(view) {
    const status = view?.querySelector(".contact-status");
    if (!status) return;
    showContactStatus(status, "카카오톡 상담 채널을 준비 중입니다.");
  }
  function openContact(trigger, phoneOnly = false) {
    if (!dialog || !choiceView) return;
    cancelPhoneRedirect();
    contactResizeAnimation?.cancel();
    choiceView.hidden = phoneOnly;
    phoneView.hidden = !phoneOnly;
    dialog.classList.toggle("contact-dialog-phone", phoneOnly);
    dialog.setAttribute("aria-labelledby", phoneOnly ? "phone-notice-title" : "contact-title");
    dialog.setAttribute("aria-describedby", phoneOnly ? "phone-notice-description" : "contact-description");
    if (trigger && !dialog.contains(trigger)) {
      contactTrigger = mobileNav?.contains(trigger) ? menuButton : trigger;
      closeMenu();
    }
    dialog.querySelectorAll(".contact-status").forEach((status) => {
      status.hidden = true;
      status.textContent = "";
    });
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("modal-open");
    document.getElementById(phoneOnly ? "phone-notice-title" : "contact-title")?.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("danpung:contactopen", { detail: { dialog } }));
  }
  const phoneSelector = '[data-contact="phone"], [data-contact-channel="phone"], a[href^="tel:"]';
  document.querySelectorAll(phoneSelector).forEach((link) => {
    if (!link.hasAttribute("data-contact-channel")) link.dataset.contact = "phone";
    link.href = phone?.href || "#contact-dialog";
  });
  // Delegation also covers telephone links added to the footer below.
  document.addEventListener("click", (event) => {
    const link = event.target.closest(phoneSelector);
    if (!link || event.defaultPrevented) return;
    if (phone) {
      cancelPhoneRedirect();
      closeMenu();
      if (dialog?.open) closeContact();
      return;
    }
    event.preventDefault();
    const inline = dialog?.open && choiceView?.contains(link);
    if (!inline) openContact(link, true);
    else cancelPhoneRedirect();
    if (!dialog?.open) return;
    const status = (inline ? choiceView : phoneView).querySelector(".contact-status");
    const noticePrefix = inline ? "지금은 전화 문의가 어렵습니다.\n" : "";
    const countdown = document.createElement("span");
    countdown.className = "contact-status-seconds";
    countdown.textContent = "3초";
    const message = document.createDocumentFragment();
    message.append(noticePrefix);
    if (kakaoUrl) message.append(countdown, " 후 카카오톡 상담으로 안내합니다.");
    else message.append("카카오톡 상담 채널을 준비 중입니다.");
    showContactStatus(status, message);
    if (kakaoUrl) {
      const deadline = Date.now() + 3000;
      phoneCountdownTimer = window.setInterval(() => {
        const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
        countdown.textContent = `${seconds}초`;
      }, 1000);
      phoneRedirectTimer = window.setTimeout(() => {
        phoneRedirectTimer = null;
        if (!dialog.open) return;
        closeContact();
        window.location.assign(kakaoUrl);
      }, 3000);
    }
  });
  document.querySelectorAll('[data-contact]:not([data-contact="phone"])').forEach((button) => {
    button.addEventListener("click", () => {
      const channel = button.dataset.contact;
      if (channel === "kakao" && kakaoUrl) {
        cancelPhoneRedirect();
        closeMenu();
        window.open(kakaoUrl, "_blank", "noopener,noreferrer");
        return;
      }
      openContact(button);
      if (channel === "kakao" && !kakaoUrl) showChannelUnavailable(choiceView);
    });
  });
  dialog?.querySelectorAll("[data-kakao-link]").forEach((link) => {
    if (kakaoUrl) {
      link.href = kakaoUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    link.addEventListener("click", (event) => {
      cancelPhoneRedirect();
      if (!kakaoUrl) {
        event.preventDefault();
        showChannelUnavailable(choiceView);
        return;
      }
      closeContact();
    });
  });
  dialog
    ?.querySelectorAll("[data-close-dialog]")
    .forEach((button) =>
      button.addEventListener("click", closeContact),
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
      closeContact();
    }
  });
  dialog?.addEventListener("cancel", cancelPhoneRedirect);
  window.addEventListener("pagehide", cancelPhoneRedirect);
  dialog?.addEventListener("close", () => {
    cancelPhoneRedirect();
    contactResizeAnimation?.cancel();
    document.body.classList.remove("modal-open");
    contactTrigger?.focus({ preventScroll: true });
  });

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
    ["전화", phone?.label || (config.phoneNumber === "0000-0000" ? "0000-0000" : "전화 문의")],
    ["이메일", config.email],
  ].filter(([, value]) => typeof value === "string" && value.trim());
  document.querySelectorAll("[data-business]").forEach((element) => {
    element.replaceChildren();
    businessFields.forEach(([label, value], index) => {
      if (index) element.append("  |  ");
      if (label !== "전화") element.append(`${label} `);
      if (label === "전화") {
        const link = document.createElement("a");
        link.dataset.contact = "phone";
        link.className = "footer-phone-tag";
        link.href = phone?.href || "#contact-dialog";
        link.textContent = value === "전화 문의" ? value : `전화 문의 ${value}`;
        element.append(link);
      } else element.append(value.trim());
    });
    element.hidden = businessFields.length === 0;
  });
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
})();
