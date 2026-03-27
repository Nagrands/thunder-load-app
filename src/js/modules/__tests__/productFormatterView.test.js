import renderProductFormatterView from "../views/productFormatterView.js";

describe("productFormatterView", () => {
  beforeEach(() => {
    jest.useRealTimers();
    localStorage.clear();
    document.body.innerHTML = `<div id="wrapper"></div>`;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
        readText: jest.fn().mockResolvedValue(""),
      },
    });
  });

  test("renders the upgraded workspace with utility actions and empty result state", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    expect(wrapper.querySelector('[data-ui="products-workbench"]')).not.toBeNull();
    expect(wrapper.querySelector("#products-paste")).not.toBeNull();
    expect(wrapper.querySelector("#products-clear")).not.toBeNull();
    expect(wrapper.querySelector("#products-demo")).not.toBeNull();
    expect(wrapper.querySelector("#products-dictionary-toggle")).not.toBeNull();
    expect(wrapper.querySelector("#products-summary-toggle")?.checked).toBe(true);
    expect(wrapper.querySelector("#products-greens-toggle")?.checked).toBe(
      false,
    );
    expect(
      wrapper
        .querySelector("#products-summary-toggle")
        ?.closest(".products-formatter-toggle")
        ?.textContent?.trim(),
    ).toBe("Итого");
    expect(
      wrapper
        .querySelector("#products-greens-toggle")
        ?.closest(".products-formatter-toggle")
        ?.textContent?.trim(),
    ).toBe("Зелень");
    expect(
      wrapper
        .querySelector("#products-summary-toggle")
        ?.closest(".products-formatter-toggle")
        ?.getAttribute("title"),
    ).toBe('Добавляет итоговый блок «Итого» в конец результата.');
    expect(
      wrapper
        .querySelector("#products-greens-toggle")
        ?.closest(".products-formatter-toggle")
        ?.getAttribute("title"),
    ).toBe("Добавляет только отдельный блок «Зелень».");
    expect(
      wrapper.querySelector('[data-ui="products-dictionary"]')?.hidden,
    ).toBe(
      true,
    );
    expect(
      wrapper.querySelector("#products-dictionary-toggle")?.getAttribute(
        "aria-expanded",
      ),
    ).toBe("false");
    expect(wrapper.querySelector("#products-copy")?.disabled).toBe(true);
    expect(wrapper.querySelector('[data-ui="products-empty"]')?.hidden).toBe(
      false,
    );
    expect(
      wrapper.querySelector(".products-formatter-empty__title")?.textContent,
    ).toBe("Результат появится здесь");
    expect(wrapper.querySelector("#products-empty-paste")).not.toBeNull();
    expect(wrapper.querySelector("#products-empty-demo")).not.toBeNull();
    expect(
      wrapper.querySelector('[data-ui="products-result-content"]')?.hidden,
    ).toBe(true);
    expect(wrapper.querySelector('[data-ui="products-result-meta"]')?.hidden).toBe(
      true,
    );
    expect(wrapper.querySelector('[data-ui="products-dirty-state"]')?.hidden).toBe(
      true,
    );
    expect(wrapper.querySelector("#products-collapse-all")).not.toBeNull();
    expect(wrapper.querySelector("#products-expand-all")).not.toBeNull();
    expect(wrapper.querySelector("#products-apply-input")).not.toBeNull();
    expect(wrapper.querySelector("#products-filter-uncertain")).not.toBeNull();
    expect(wrapper.querySelectorAll(".products-diagnostics__filter").length).toBe(4);
  });

  test("formats into a single preview flow with summary at the end and result stats", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const textarea = wrapper.querySelector("#products-input");
    const formatButton = wrapper.querySelector("#products-format");
    const summaryCard = wrapper.querySelector("#products-summary-card");
    const preview = wrapper.querySelector("#products-preview");

    textarea.value = `Тесто
Лук 1

Магазин
Банан`;
    formatButton.click();

    expect(wrapper.querySelector('[data-ui="products-empty"]')?.hidden).toBe(
      true,
    );
    expect(
      wrapper.querySelector('[data-ui="products-result-content"]')?.hidden,
    ).toBe(false);
    expect(summaryCard.hidden).toBe(true);
    expect(
      Array.from(preview.querySelectorAll(".products-preview__title")).map(
        (el) => el.textContent,
      ),
    ).toEqual(["Тесто", "Магазин", "Итого"]);
    expect(
      wrapper.querySelector("#products-meta-sections")?.textContent,
    ).toBe("Разделов: 2");
    expect(wrapper.querySelector("#products-meta-items")?.textContent).toBe(
      "Позиций: 2",
    );
    expect(wrapper.querySelector("#products-meta-summary")?.textContent).toBe(
      "Итого включено",
    );
    expect(wrapper.querySelector("#products-meta-greens")?.textContent).toBe(
      "Зелень скрыта",
    );
    expect(wrapper.querySelector("#products-copy")?.disabled).toBe(false);
    expect(preview.querySelectorAll(".products-section-copy").length).toBe(3);
  });

  test("appends the greens summary block when the optional toggle is enabled", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const textarea = wrapper.querySelector("#products-input");
    const greensToggle = wrapper.querySelector("#products-greens-toggle");

    textarea.value = `Тесто
Укроп 2 пуч.
ПетрушкаЦ 1 пуч.

Магазин
Укроп 20
Банан`;
    greensToggle.checked = true;
    wrapper.querySelector("#products-format").click();

    expect(wrapper.querySelector("#products-meta-greens")?.textContent).toBe(
      "Зелень включена",
    );
    expect(
      Array.from(
        wrapper.querySelectorAll('[data-ui="products-result-meta-stats"] .products-result-meta__pill'),
      ).map((el) => el.id),
    ).toEqual(["products-meta-sections", "products-meta-items"]);
    expect(
      Array.from(
        wrapper.querySelectorAll('[data-ui="products-result-meta-options"] .products-result-meta__pill'),
      ).map((el) => el.id),
    ).toEqual(["products-meta-summary", "products-meta-greens"]);
    expect(
      Array.from(
        wrapper.querySelector("#products-preview")?.querySelectorAll(
          ".products-preview__title",
        ) || [],
      ).map((el) => el.textContent),
    ).toEqual(["Тесто", "Магазин", "Итого", "Зелень"]);
  });

  test("reformats the preview immediately when toggles change after formatting", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = `Тесто
Укроп 2 пуч.

Магазин
Банан`;
    wrapper.querySelector("#products-format").click();

    const summaryToggle = wrapper.querySelector("#products-summary-toggle");
    const greensToggle = wrapper.querySelector("#products-greens-toggle");
    const previewTitles = () =>
      Array.from(wrapper.querySelectorAll(".products-preview__title")).map(
        (el) => el.textContent,
      );

    expect(previewTitles()).toEqual(["Тесто", "Магазин", "Итого"]);

    greensToggle.checked = true;
    greensToggle.dispatchEvent(new Event("change"));
    expect(previewTitles()).toEqual(["Тесто", "Магазин", "Итого", "Зелень"]);

    summaryToggle.checked = false;
    summaryToggle.dispatchEvent(new Event("change"));
    expect(previewTitles()).toEqual(["Тесто", "Магазин", "Зелень"]);
    expect(wrapper.querySelector("#products-meta-summary")?.textContent).toBe(
      "Итого скрыто",
    );
    expect(wrapper.querySelector("#products-meta-greens")?.textContent).toBe(
      "Зелень включена",
    );
  });

  test("omits summary from the preview flow when the checkbox is disabled and copies raw output", async () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const textarea = wrapper.querySelector("#products-input");
    const summaryToggle = wrapper.querySelector("#products-summary-toggle");
    const formatButton = wrapper.querySelector("#products-format");
    const copyButton = wrapper.querySelector("#products-copy");
    const summaryCard = wrapper.querySelector("#products-summary-card");
    const preview = wrapper.querySelector("#products-preview");

    textarea.value = `Тесто
Лук 1`;
    summaryToggle.checked = false;
    formatButton.click();

    expect(summaryCard.hidden).toBe(true);
    expect(
      Array.from(preview.querySelectorAll(".products-preview__title")).map(
        (el) => el.textContent,
      ),
    ).toEqual(["Тесто"]);
    expect(wrapper.querySelector("#products-meta-summary")?.textContent).toBe(
      "Итого скрыто",
    );
    expect(wrapper.querySelector("#products-meta-greens")?.textContent).toBe(
      "Зелень скрыта",
    );

    copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`Тесто
Лук 1`);
    expect(copyButton.getAttribute("title")).toBe("Скопировано");
    expect(wrapper.querySelector("#products-status")?.textContent).toBe(
      "Результат скопирован.",
    );
  });

  test("supports demo, paste and clear actions with coherent status and reset state", async () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const input = wrapper.querySelector("#products-input");
    const demoButton = wrapper.querySelector("#products-demo");
    const pasteButton = wrapper.querySelector("#products-paste");
    const clearButton = wrapper.querySelector("#products-clear");
    const formatButton = wrapper.querySelector("#products-format");
    const status = wrapper.querySelector("#products-status");

    demoButton.click();
    expect(input.value).toContain("Витамин");
    expect(status.textContent).toBe("Демо-список загружен.");

    navigator.clipboard.readText.mockResolvedValueOnce("Тесто\nЛук 1");
    pasteButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(input.value).toBe("Тесто\nЛук 1");
    expect(status.textContent).toBe("Текст вставлен из буфера обмена.");

    formatButton.click();
    expect(wrapper.querySelector('[data-ui="products-result-content"]')?.hidden).toBe(
      false,
    );

    input.value = "Тесто\nЛук 2";
    formatButton.click();
    expect(
      wrapper.querySelector('[data-ui="products-comparison-panel"]')?.hidden,
    ).toBe(false);

    clearButton.click();
    expect(input.value).toBe("");
    expect(wrapper.querySelector('[data-ui="products-empty"]')?.hidden).toBe(
      false,
    );
    expect(
      wrapper.querySelector('[data-ui="products-result-content"]')?.hidden,
    ).toBe(true);
    expect(wrapper.querySelector('[data-ui="products-result-meta"]')?.hidden).toBe(
      true,
    );
    expect(wrapper.querySelector("#products-copy")?.disabled).toBe(true);
    expect(status.textContent).toBe("Поле очищено.");
    expect(
      wrapper.querySelector('[data-ui="products-comparison-panel"]')?.hidden,
    ).toBe(true);
  });

  test("marks the result as stale after editing the source and clears it on rerun", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const input = wrapper.querySelector("#products-input");
    const formatButton = wrapper.querySelector("#products-format");
    const dirtyState = wrapper.querySelector('[data-ui="products-dirty-state"]');

    input.value = "Тесто\nЛук 1";
    formatButton.click();
    expect(dirtyState?.hidden).toBe(true);

    input.value = "Тесто\nЛук 2";
    input.dispatchEvent(new Event("input"));
    expect(dirtyState?.hidden).toBe(false);
    expect(dirtyState?.textContent).toContain("Результат устарел");

    formatButton.click();
    expect(dirtyState?.hidden).toBe(true);
  });

  test("supports empty-state quick actions for paste and demo", async () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    navigator.clipboard.readText.mockResolvedValueOnce("Тесто\nЛук 1");
    wrapper.querySelector("#products-empty-paste").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.querySelector("#products-input")?.value).toBe("Тесто\nЛук 1");
    expect(wrapper.querySelector("#products-status")?.textContent).toBe(
      "Текст вставлен из буфера обмена.",
    );

    wrapper.querySelector("#products-empty-demo").click();
    expect(wrapper.querySelector("#products-input")?.value).toContain("Витамин");
    expect(wrapper.querySelector("#products-status")?.textContent).toBe(
      "Демо-список загружен.",
    );
  });

  test("surfaces clipboard errors through the inline status channel", async () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    navigator.clipboard.readText.mockRejectedValueOnce(new Error("denied"));
    wrapper.querySelector("#products-paste").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.querySelector("#products-status")?.textContent).toBe(
      "Не удалось прочитать буфер обмена.",
    );

    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
    const textarea = wrapper.querySelector("#products-input");
    textarea.value = "Тесто\nЛук 1";
    wrapper.querySelector("#products-format").click();
    wrapper.querySelector("#products-copy").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.querySelector("#products-status")?.textContent).toBe(
      "Не удалось скопировать результат.",
    );
  });

  test("copies an individual section from its local action", async () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const textarea = wrapper.querySelector("#products-input");
    textarea.value = `Тесто
Лук 1

Магазин
Банан`;
    wrapper.querySelector("#products-format").click();

    const firstSectionCopy = wrapper.querySelector(".products-section-copy");
    expect(firstSectionCopy?.classList.contains("small-button")).toBe(false);
    expect(firstSectionCopy?.classList.contains("products-icon-button")).toBe(
      false,
    );
    firstSectionCopy.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`Тесто
Лук 1`);
    expect(firstSectionCopy.getAttribute("title")).toBe("Скопировано");
    expect(wrapper.querySelector("#products-status")?.textContent).toBe(
      "Раздел скопирован.",
    );
  });

  test("renders diagnostics and highlights uncertain normalized lines", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = `Тесто
Лук 5
Лук 1 кг
ПетрушкаЦ 2 пуч.

Магазин
Чеснок 3`;
    wrapper.querySelector("#products-format").click();

    expect(wrapper.querySelector('[data-ui="products-diagnostics"]')?.hidden).toBe(
      false,
    );
    expect(
      wrapper.querySelector('[data-ui="products-issues-panel"]')?.textContent,
    ).toContain("объединены дубли");
    expect(
      wrapper.querySelector('[data-ui="products-diff-panel"]')?.textContent,
    ).toContain("ПетрушкаЦ 2 пуч");
    expect(wrapper.querySelector("#products-diff-list")?.hidden).toBe(true);
    expect(
      wrapper.querySelectorAll(".products-preview__item--uncertain").length,
    ).toBeGreaterThan(0);
    expect(wrapper.querySelector(".products-preview__badge")?.textContent).toBe(
      "Проверить",
    );
  });

  test("keeps normalization collapsed by default and expands on click", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = `Тесто
Лук 5`;
    wrapper.querySelector("#products-format").click();

    const diffToggle = wrapper.querySelector("#products-diff-toggle");
    const diffList = wrapper.querySelector("#products-diff-list");

    expect(diffToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(diffList?.hidden).toBe(true);
    expect(
      wrapper.querySelector('[data-ui="products-diff-panel"]')?.classList.contains(
        "products-diagnostics__panel--collapsed",
      ),
    ).toBe(true);

    diffToggle.click();

    expect(diffToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(diffList?.hidden).toBe(false);
  });

  test("allows dismissing warnings from the diagnostics panel", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = `Тесто
Лук 5

Магазин
Чеснок 3`;
    wrapper.querySelector("#products-format").click();

    const diagnostics = wrapper.querySelector('[data-ui="products-diagnostics"]');
    const issuesPanel = wrapper.querySelector('[data-ui="products-issues-panel"]');
    const closeButtons = wrapper.querySelectorAll(".products-issue__close");

    expect(diagnostics?.hidden).toBe(false);
    expect(issuesPanel?.hidden).toBe(false);
    expect(closeButtons.length).toBeGreaterThan(0);

    closeButtons.forEach((button) => button.click());

    expect(issuesPanel?.hidden).toBe(true);
    expect(diagnostics?.hidden).toBe(false);
    expect(wrapper.querySelector('[data-ui="products-diff-panel"]')?.hidden).toBe(
      false,
    );
  });

  test("supports collapsible sections and keeps normalization stats visible", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = `Тесто
Лук 5
Лук 1 кг`;
    wrapper.querySelector("#products-format").click();

    expect(
      wrapper.querySelector('[data-ui="products-normalization-stats"]')?.hidden,
    ).toBe(false);
    expect(wrapper.querySelector("#products-stat-duplicates")?.textContent).toBe(
      "Дубли: 1",
    );

    const firstToggle = wrapper.querySelector(".products-preview__heading-button");
    const firstSection = wrapper.querySelector(".products-preview__section");
    expect(firstSection?.classList.contains("products-preview__section--collapsed")).toBe(
      false,
    );
    firstToggle.click();
    expect(firstSection?.classList.contains("products-preview__section--collapsed")).toBe(
      true,
    );
  });

  test("supports quick actions for collapsing, expanding, and filtering uncertain items", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = `Тесто
Лук 5
Лук 1 кг
ПетрушкаЦ 2 пуч.

Магазин
Чеснок 3`;
    wrapper.querySelector("#products-format").click();

    wrapper.querySelector("#products-collapse-all").click();
    expect(
      Array.from(wrapper.querySelectorAll(".products-preview__section")).every(
        (section) =>
          section.classList.contains("products-preview__section--collapsed"),
      ),
    ).toBe(true);

    wrapper.querySelector("#products-expand-all").click();
    expect(
      Array.from(wrapper.querySelectorAll(".products-preview__section")).every(
        (section) =>
          !section.classList.contains("products-preview__section--collapsed"),
      ),
    ).toBe(true);

    const filterToggle = wrapper.querySelector("#products-filter-uncertain");
    filterToggle.checked = true;
    filterToggle.dispatchEvent(new Event("change"));

    expect(
      wrapper.querySelectorAll(".products-preview__item:not(.products-preview__item--uncertain)").length,
    ).toBe(0);
    expect(
      wrapper.querySelectorAll(".products-preview__item--uncertain").length,
    ).toBeGreaterThan(0);
  });

  test("filters diagnostics by category", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = `Тесто
Лук 5
Лук 1 кг
ПетрушкаЦ 2 пуч.

Магазин
Чеснок 3`;
    wrapper.querySelector("#products-format").click();

    const typoFilter = wrapper.querySelector(
      '.products-diagnostics__filter[data-filter="typos"]',
    );
    typoFilter.click();

    expect(typoFilter.getAttribute("data-active")).toBe("true");
    expect(
      wrapper.querySelector('[data-ui="products-issues-panel"]')?.textContent,
    ).toContain("нормализовано как");
    expect(
      wrapper.querySelector('[data-ui="products-issues-panel"]')?.textContent,
    ).not.toContain("объединены дубли");
    expect(wrapper.querySelector("#products-diff-list")?.textContent).toContain(
      "ПетрушкаЦ 2 пуч",
    );

    wrapper.querySelector('.products-diagnostics__filter[data-filter="duplicates"]').click();

    expect(
      wrapper.querySelector('[data-ui="products-issues-panel"]')?.textContent,
    ).toContain("объединены дубли");
    expect(wrapper.querySelector("#products-diff-list")?.textContent).toContain(
      "Для фильтра «Дубли» совпадений нет.",
    );
  });

  test("applies normalized text back to the input", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const textarea = wrapper.querySelector("#products-input");
    textarea.value = `Тесто
ПетрушкаЦ 2 пуч.
Лук 1 кг`;
    wrapper.querySelector("#products-format").click();

    wrapper.querySelector("#products-apply-input").click();

    expect(textarea.value).toBe(`Тесто
Лук 1
Петрушка 2п`);
    expect(
      wrapper.querySelector('[data-ui="products-result-content"]')?.hidden,
    ).toBe(true);
    expect(wrapper.querySelector("#products-status")?.textContent).toBe(
      "Нормализованный текст подставлен во вход.",
    );
  });

  test("supports custom dev dictionary and shows comparison after a rerun", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const dictionaryToggle = wrapper.querySelector("#products-dictionary-toggle");
    dictionaryToggle.focus();
    dictionaryToggle.click();
    expect(
      wrapper.querySelector('[data-ui="products-dictionary"]')?.hidden,
    ).toBe(false);
    expect(dictionaryToggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(
      wrapper.querySelector("#products-dictionary-input"),
    );
    wrapper.querySelector("#products-dictionary-input").value =
      "батат = Картофель сладкий";
    wrapper.querySelector("#products-dictionary-input").dispatchEvent(
      new Event("input"),
    );
    expect(wrapper.querySelector("#products-dictionary-meta")?.textContent).toBe(
      "Правил: 1",
    );

    wrapper.querySelector("#products-input").value = `Тесто
батат 2`;
    wrapper.querySelector("#products-format").click();

    expect(wrapper.querySelector("#products-preview")?.textContent).toContain(
      "Картофель сладкий 2",
    );

    wrapper.querySelector("#products-input").value = `Тесто
батат 3`;
    wrapper.querySelector("#products-format").click();

    expect(
      wrapper.querySelector('[data-ui="products-comparison-panel"]')?.hidden,
    ).toBe(false);
    expect(wrapper.querySelector("#products-comparison-list")?.textContent).toContain(
      "Картофель сладкий 3",
    );
    wrapper.querySelector("#products-dictionary-close").click();
    expect(
      wrapper.querySelector('[data-ui="products-dictionary"]')?.hidden,
    ).toBe(
      true,
    );
    expect(document.activeElement).toBe(dictionaryToggle);
  });

  test("shows dictionary validation when malformed rules are entered", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-dictionary-toggle").click();
    const dictionaryInput = wrapper.querySelector("#products-dictionary-input");

    dictionaryInput.value = "батат\nморковь =\nлук = Лук";
    dictionaryInput.dispatchEvent(new Event("input"));

    expect(
      dictionaryInput.classList.contains("products-dictionary__textarea--invalid"),
    ).toBe(true);
    expect(wrapper.querySelector("#products-dictionary-meta")?.textContent).toBe(
      "Правил: 1, строк с ошибкой: 1, 2",
    );
  });

  test("closes the dictionary via escape and backdrop and traps focus while open", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    const dictionaryToggle = wrapper.querySelector("#products-dictionary-toggle");
    const dictionaryLayer = wrapper.querySelector('[data-ui="products-dictionary"]');
    const dictionaryPanel = wrapper.querySelector("#products-dictionary-panel");
    const dictionaryInput = wrapper.querySelector("#products-dictionary-input");
    const dictionaryClose = wrapper.querySelector("#products-dictionary-close");
    const dictionaryReset = wrapper.querySelector("#products-dictionary-reset");
    const backdrop = wrapper.querySelector('[data-ui="products-dictionary-backdrop"]');

    dictionaryToggle.focus();
    dictionaryToggle.click();
    expect(dictionaryLayer?.hidden).toBe(false);
    expect(document.activeElement).toBe(dictionaryInput);

    dictionaryReset.focus();
    dictionaryPanel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement).toBe(dictionaryClose);

    dictionaryClose.focus();
    dictionaryPanel.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(document.activeElement).toBe(dictionaryReset);

    dictionaryPanel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(dictionaryLayer?.hidden).toBe(true);
    expect(document.activeElement).toBe(dictionaryToggle);

    dictionaryToggle.click();
    backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dictionaryLayer?.hidden).toBe(true);
  });

  test("resets comparison history after paste and demo actions", async () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-input").value = "Тесто\nЛук 1";
    wrapper.querySelector("#products-format").click();
    wrapper.querySelector("#products-input").value = "Тесто\nЛук 2";
    wrapper.querySelector("#products-format").click();

    expect(
      wrapper.querySelector('[data-ui="products-comparison-panel"]')?.hidden,
    ).toBe(false);

    navigator.clipboard.readText.mockResolvedValueOnce("Тесто\nЛук 4");
    wrapper.querySelector("#products-paste").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    wrapper.querySelector("#products-format").click();
    expect(
      wrapper.querySelector('[data-ui="products-comparison-panel"]')?.hidden,
    ).toBe(true);

    wrapper.querySelector("#products-demo").click();
    wrapper.querySelector("#products-format").click();
    expect(
      wrapper.querySelector('[data-ui="products-comparison-panel"]')?.hidden,
    ).toBe(true);
  });
});
