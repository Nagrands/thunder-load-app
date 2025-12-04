// src/js/modules/randomizer/ui/items.js

import { DEFAULT_WEIGHT, WEIGHT_MIN, WEIGHT_MAX } from "../helpers.js";

export function createItemsRenderer({
  getState,
  listEl,
  getSelected,
  onUpdateCount,
  onUpdateBulk,
  onUpdatePoolHint,
  onUpdateSummary,
  onSelectToggle,
  onRemoveSelected,
  onReplaceItem,
  onMoveItem,
  onSyncWeight,
  onStartInlineEdit,
}) {
  const debounce = (fn, delay = 50) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  const throttle = (fn, delay = 50) => {
    let last = 0;
    let queued = null;
    return (...args) => {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn(...args);
      } else {
        queued = args;
        setTimeout(
          () => {
            if (queued) {
              last = Date.now();
              fn(...queued);
              queued = null;
            }
          },
          delay - (now - last),
        );
      }
    };
  };

  const getItemWeight = (item) =>
    onSyncWeight?.clamp(item?.weight ?? DEFAULT_WEIGHT);
  const getItemHits = (item) => onSyncWeight?.clampHits(item?.hits ?? 0);

  const renderItemsDebounced = debounce(() => renderItems(), 40);
  const onMoveThrottled = throttle((from, to) => onMoveItem(from, to), 60);

  return function renderItems() {
    const { items, pool, settings } = getState();
    const selected = getSelected ? getSelected() : new Set();
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "placeholder";
      empty.textContent = "Пока нет вариантов. Добавьте несколько элементов.";
      listEl.appendChild(empty);
      onUpdateCount();
      onUpdateBulk();
      return;
    }

    const fragment = document.createDocumentFragment();
    let dragSource = null;

    items.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "randomizer-chip";
      chip.dataset.value = item.value;
      chip.draggable = false;

      const chipMain = document.createElement("div");
      chipMain.className = "chip-main";

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "chip-drag-handle";
      dragHandle.setAttribute("aria-label", "Перетащить вариант");
      dragHandle.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';
      dragHandle.draggable = true;

      const textWrap = document.createElement("div");
      textWrap.className = "chip-text";
      const text = document.createElement("span");
      text.className = "text";
      text.textContent = item.value;
      textWrap.appendChild(text);

      const weightWrap = document.createElement("div");
      weightWrap.className = "chip-weight";

      const weightNumber = document.createElement("input");
      weightNumber.type = "number";
      weightNumber.min = WEIGHT_MIN;
      weightNumber.max = WEIGHT_MAX;
      weightNumber.step = 1;
      weightNumber.value = getItemWeight(item);
      weightNumber.className = "chip-weight-number";

      const weightLabel = document.createElement("span");
      weightLabel.className = "chip-weight-label";
      weightLabel.textContent = `x${getItemWeight(item)}`;

      const weightPresets = document.createElement("div");
      weightPresets.className = "chip-weight-presets";
      [1, 2, 3, 5, 10].forEach((val) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip-weight-pill";
        btn.textContent = `x${val}`;
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          syncWeight(val);
        });
        weightPresets.appendChild(btn);
      });

      const statWrap = document.createElement("div");
      statWrap.className = "chip-stats";
      const hitsEl = document.createElement("span");
      hitsEl.className = "chip-stat";
      hitsEl.textContent = `Выпадений: ${getItemHits(item)}`;
      const inPoolCount = pool.filter((val) => val === item.value).length;
      const poolEl = document.createElement("span");
      poolEl.className = "chip-stat";
      poolEl.textContent = settings.noRepeat
        ? `В пуле: ${inPoolCount}`
        : "В пуле: ∞";
      statWrap.append(hitsEl, poolEl);

      const syncWeight = (nextWeight) => {
        const sanitized = onSyncWeight?.clamp(nextWeight);
        if (!onSyncWeight || sanitized === getItemWeight(item)) {
          weightNumber.value = sanitized;
          weightLabel.textContent = `x${sanitized}`;
          return;
        }
        onSyncWeight.set(item.value, sanitized);
        weightNumber.value = sanitized;
        weightLabel.textContent = `x${sanitized}`;
        renderItemsDebounced();
      };

      const stopChipEvent = (event) => event.stopPropagation();
      weightNumber.addEventListener("click", stopChipEvent);
      weightNumber.addEventListener("input", (event) => {
        event.stopPropagation();
        syncWeight(event.target.value);
      });
      weightLabel.addEventListener("click", stopChipEvent);
      weightWrap.append(weightNumber, weightPresets);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.setAttribute("aria-label", `Удалить ${item.value}`);
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      remove.addEventListener("click", () => {
        onRemoveSelected(new Set([item.value]), { silent: true });
      });

      chipMain.append(dragHandle, textWrap, weightLabel, remove);
      chip.append(chipMain, weightWrap, statWrap);

      chip.addEventListener("click", (event) => {
        if (event.detail > 1) return;
        if (event.target.closest(".chip-remove")) return;
        if (event.target.classList.contains("chip-edit-input")) return;
        onSelectToggle(item.value, chip);
      });

      chip.addEventListener("dblclick", () =>
        onStartInlineEdit(chip, item.value),
      );

      chip.addEventListener("dragover", (event) => {
        if (!dragSource || dragSource === item.value) return;
        event.preventDefault();
        chip.classList.add("drop-target");
      });

      chip.addEventListener("dragleave", () => {
        chip.classList.remove("drop-target");
      });

      chip.addEventListener("drop", (event) => {
        event.preventDefault();
        chip.classList.remove("drop-target");
        if (!dragSource || dragSource === item.value) return;
        onMoveThrottled(dragSource, item.value);
      });

      dragHandle.addEventListener("click", (event) => event.stopPropagation());
      dragHandle.addEventListener("dragstart", (event) => {
        dragSource = item.value;
        chip.classList.add("dragging");
        event.dataTransfer?.setData("text/plain", item.value);
        event.dataTransfer?.setDragImage(chip, 10, 10);
      });

      dragHandle.addEventListener("dragend", () => {
        dragSource = null;
        chip.classList.remove("dragging");
        chip.classList.remove("drop-target");
      });

      if (selected.has(item.value)) chip.classList.add("selected");
      fragment.appendChild(chip);
    });

    listEl.appendChild(fragment);
    onUpdateCount();
    onUpdateBulk();
    onUpdatePoolHint();
    onUpdateSummary();
  };
}
