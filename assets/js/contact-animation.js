(() => {
  "use strict";
  const scene = document.querySelector(".contact-deposit");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!scene || reducedMotion.matches || !("IntersectionObserver" in window)) return;

  scene.classList.add("is-animated");
  const observer = new IntersectionObserver(async (entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    const image = scene.querySelector(".contact-device-image");
    try { await image.decode(); } catch { /* Let the content appear if image decoding fails. */ }
    scene.classList.add("is-playing");
  }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
  observer.observe(scene);
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) {
      observer.disconnect();
      scene.classList.remove("is-animated");
    }
  });
})();
