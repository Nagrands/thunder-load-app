function initTopBarResponsive() {
  const topBar = document.querySelector(".top-bar");
  const root = document.documentElement;
  if (!topBar) return;

  const setCurrentHeight = () => {
    const next = Math.ceil(topBar.getBoundingClientRect().height);
    root.style.setProperty("--topbar-current-height", `${next}px`);
  };

  window.addEventListener("resize", setCurrentHeight);

  if (typeof window.ResizeObserver === "function") {
    const observer = new window.ResizeObserver(() => {
      setCurrentHeight();
    });
    observer.observe(topBar);
  }

  setCurrentHeight();
}

export { initTopBarResponsive };
