export function createPlayerIcon(name, { spinning = false } = {}) {
  const icon = document.createElement("i");
  icon.dataset.lucide = name;
  icon.dataset.playerIcon = "";
  icon.setAttribute("aria-hidden", "true");
  if (spinning) icon.classList.add("is-spinning");
  return icon;
}

export function refreshPlayerIcons(container) {
  const lucide = window?.lucide;
  if (!lucide?.createIcons || !lucide?.icons) return;
  lucide.createIcons({ icons: lucide.icons, root: container });
}

export function setPlayerIcon(
  container,
  name,
  { spinning = false } = {},
) {
  if (!container) return false;
  const key = `${name}:${spinning}`;
  if (container.dataset.playerIconKey === key) return false;
  container.dataset.playerIconKey = key;
  const previous = container.querySelector(
    "[data-player-icon], svg.lucide, i",
  );
  const icon = createPlayerIcon(name, { spinning });
  if (previous) previous.replaceWith(icon);
  else container.prepend(icon);
  refreshPlayerIcons(container);
  return true;
}
