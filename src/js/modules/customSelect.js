const instances = new Set();

function close(instance, restoreFocus = false) {
  instance.root.classList.remove("is-open");
  instance.trigger.setAttribute("aria-expanded", "false");
  instance.menu.classList.add("hidden");
  if (restoreFocus) instance.trigger.focus();
}

function sync(instance) {
  const options = Array.from(instance.select.options);
  instance.menu.replaceChildren(
    ...options.map((option) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "settings-cookies-select__option";
      item.setAttribute("role", "option");
      item.dataset.value = option.value;
      item.textContent = option.textContent.trim();
      item.disabled = option.disabled;
      item.setAttribute(
        "aria-selected",
        String(option.value === instance.select.value),
      );
      const check = document.createElement("i");
      check.className = "fa-solid fa-check";
      check.setAttribute("aria-hidden", "true");
      item.append(check);
      item.addEventListener("click", () => {
        instance.select.value = option.value;
        instance.select.dispatchEvent(new Event("change", { bubbles: true }));
        sync(instance);
        close(instance, true);
      });
      item.addEventListener("keydown", (event) => {
        const enabled = Array.from(
          instance.menu.querySelectorAll('[role="option"]:not(:disabled)'),
        );
        const index = enabled.indexOf(item);
        const target = {
          ArrowDown: index + 1,
          ArrowRight: index + 1,
          ArrowUp: index - 1,
          ArrowLeft: index - 1,
          Home: 0,
          End: enabled.length - 1,
        }[event.key];
        if (target !== undefined) {
          event.preventDefault();
          enabled[Math.max(0, Math.min(enabled.length - 1, target))]?.focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          close(instance, true);
        }
      });
      return item;
    }),
  );
  const selected = options.find(
    (option) => option.value === instance.select.value,
  );
  instance.label.textContent = selected?.textContent?.trim() || "";
  instance.trigger.disabled = instance.select.disabled;
}

export function initCustomSelect(root, select, { trigger, label, menu } = {}) {
  if (!root || !select || !trigger || !label || !menu) return null;
  const instance = { root, select, trigger, label, menu };
  const closeOthers = () =>
    instances.forEach((other) => other !== instance && close(other));
  const open = (focus = false) => {
    closeOthers();
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.classList.remove("hidden");
    if (focus)
      menu
        .querySelector(
          '[aria-selected="true"]:not(:disabled), [role="option"]:not(:disabled)',
        )
        ?.focus();
  };
  trigger.addEventListener("click", () =>
    root.classList.contains("is-open") ? close(instance) : open(),
  );
  trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      open(true);
    }
    if (event.key === "Escape") close(instance);
  });
  select.addEventListener("change", () => sync(instance));
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) close(instance);
  });
  instances.add(instance);
  sync(instance);
  return { sync: () => sync(instance), close: () => close(instance) };
}
