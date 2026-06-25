const DROPDOWN_BOUND_KEY = "accessibleDropdownBound";

function getOptions(menu) {
  return Array.from(menu.querySelectorAll("[data-value]"));
}

function getTriggerForMenu(menu) {
  if (!menu.id) return null;
  return document.querySelector(`[aria-controls="${menu.id}"]`);
}

function setOpenState(trigger, menu, isOpen, { focusOption = false } = {}) {
  menu.classList.toggle("show", isOpen);
  trigger.setAttribute("aria-expanded", String(isOpen));

  if (!isOpen || !focusOption) return;
  const options = getOptions(menu);
  const selected =
    options.find((option) => option.getAttribute("aria-selected") === "true") ||
    options[0];
  selected?.focus();
}

function closeOtherDropdowns(currentMenu) {
  document.querySelectorAll(".dropdown-menu.show").forEach((menu) => {
    if (menu === currentMenu) return;
    menu.classList.remove("show");
    getTriggerForMenu(menu)?.setAttribute("aria-expanded", "false");
  });
}

function moveOptionFocus(menu, currentOption, key) {
  const options = getOptions(menu);
  const currentIndex = options.indexOf(currentOption);
  if (currentIndex < 0 || !options.length) return;

  const lastIndex = options.length - 1;
  const targetByKey = {
    ArrowDown: currentIndex === lastIndex ? 0 : currentIndex + 1,
    ArrowRight: currentIndex === lastIndex ? 0 : currentIndex + 1,
    ArrowUp: currentIndex === 0 ? lastIndex : currentIndex - 1,
    ArrowLeft: currentIndex === 0 ? lastIndex : currentIndex - 1,
    Home: 0,
    End: lastIndex,
  };
  options[targetByKey[key]]?.focus();
}

export function syncAccessibleDropdownSelection(menu, value) {
  getOptions(menu).forEach((option) => {
    const selected = option.dataset.value === String(value);
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

export function initAccessibleDropdown(trigger, menu) {
  if (!trigger || !menu || trigger.dataset[DROPDOWN_BOUND_KEY] === "1") return;
  trigger.dataset[DROPDOWN_BOUND_KEY] = "1";

  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (menu.id) trigger.setAttribute("aria-controls", menu.id);
  menu.setAttribute("role", "listbox");

  getOptions(menu).forEach((option) => {
    option.setAttribute("role", "option");
    option.tabIndex = -1;
    if (!option.hasAttribute("aria-selected")) {
      option.setAttribute(
        "aria-selected",
        String(option.classList.contains("active")),
      );
    }

    option.addEventListener("click", () => {
      syncAccessibleDropdownSelection(menu, option.dataset.value);
      setOpenState(trigger, menu, false);
      trigger.focus();
    });

    option.addEventListener("keydown", (event) => {
      if (
        [
          "ArrowDown",
          "ArrowRight",
          "ArrowUp",
          "ArrowLeft",
          "Home",
          "End",
        ].includes(event.key)
      ) {
        event.preventDefault();
        moveOptionFocus(menu, option, event.key);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        option.click();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpenState(trigger, menu, false);
        trigger.focus();
      }
    });
  });

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const shouldOpen = !menu.classList.contains("show");
    closeOtherDropdowns(menu);
    setOpenState(trigger, menu, shouldOpen);
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.classList.contains("show")) {
      event.preventDefault();
      event.stopPropagation();
      setOpenState(trigger, menu, false);
      trigger.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    closeOtherDropdowns(menu);
    setOpenState(trigger, menu, true, { focusOption: true });
  });

  document.addEventListener("click", (event) => {
    if (trigger.contains(event.target) || menu.contains(event.target)) return;
    setOpenState(trigger, menu, false);
  });
}
