function initTopBarResponsive() {
  const topBar = document.querySelector(".top-bar");
  const root = document.documentElement;
  if (!topBar) return;

  const setCurrentHeight = () => {
    const next = Math.ceil(topBar.getBoundingClientRect().height);
    root.style.setProperty("--topbar-current-height", `${next}px`);
  };

  const syncScrollState = (event) => {
    const scrollTop = Math.max(
      Number(window.scrollY) || 0,
      Number(window.pageYOffset) || 0,
      Number(document.scrollingElement?.scrollTop) || 0,
      Number(document.documentElement.scrollTop) || 0,
      Number(document.body?.scrollTop) || 0,
      Number(event?.target?.scrollTop) || 0,
    );
    topBar.classList.toggle("is-scrolled", scrollTop > 0);
  };

  window.addEventListener("resize", setCurrentHeight);
  window.addEventListener("scroll", syncScrollState, { passive: true });
  document.addEventListener("scroll", syncScrollState, {
    capture: true,
    passive: true,
  });

  if (typeof window.ResizeObserver === "function") {
    const observer = new window.ResizeObserver(() => {
      setCurrentHeight();
    });
    observer.observe(topBar);
  }

  setCurrentHeight();
  syncScrollState();
}

export { initTopBarResponsive };
