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
    expect(wrapper.querySelector("#products-summary-toggle")?.checked).toBe(true);
    expect(wrapper.querySelector("#products-greens-toggle")?.checked).toBe(
      false,
    );
    expect(wrapper.querySelector("#products-copy")?.disabled).toBe(true);
    expect(wrapper.querySelector('[data-ui="products-empty"]')?.hidden).toBe(
      false,
    );
    expect(
      wrapper.querySelector('[data-ui="products-result-content"]')?.hidden,
    ).toBe(true);
    expect(wrapper.querySelector('[data-ui="products-result-meta"]')?.hidden).toBe(
      true,
    );
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
    firstSectionCopy.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`Тесто
Лук 1`);
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
    expect(
      wrapper.querySelectorAll(".products-preview__item--uncertain").length,
    ).toBeGreaterThan(0);
    expect(wrapper.querySelector(".products-preview__badge")?.textContent).toBe(
      "Проверить",
    );
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
    const firstList = wrapper.querySelector(".products-preview__list");
    expect(firstList?.hidden).toBe(false);
    firstToggle.click();
    expect(firstList?.hidden).toBe(true);
  });

  test("supports custom dev dictionary and shows comparison after a rerun", () => {
    const wrapper = document.getElementById("wrapper");
    renderProductFormatterView(wrapper);

    wrapper.querySelector("#products-dictionary-input").value =
      "батат = Картофель сладкий";
    wrapper.querySelector("#products-dictionary-input").dispatchEvent(
      new Event("input"),
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
  });
});
