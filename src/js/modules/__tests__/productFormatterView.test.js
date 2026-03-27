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

  test("formats into a summary card and section preview with result stats", () => {
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
    expect(summaryCard.hidden).toBe(false);
    expect(summaryCard.querySelector(".products-preview__title")?.textContent).toBe(
      "Итого",
    );
    expect(
      Array.from(preview.querySelectorAll(".products-preview__title")).map(
        (el) => el.textContent,
      ),
    ).toEqual(["Тесто", "Магазин"]);
    expect(
      wrapper.querySelector("#products-meta-sections")?.textContent,
    ).toBe("Разделов: 2");
    expect(wrapper.querySelector("#products-meta-items")?.textContent).toBe(
      "Позиций: 2",
    );
    expect(wrapper.querySelector("#products-meta-summary")?.textContent).toBe(
      "Итого включено",
    );
    expect(wrapper.querySelector("#products-copy")?.disabled).toBe(false);
  });

  test("hides the summary card when the checkbox is disabled and copies raw output", async () => {
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

    copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`Тесто
Лук 1`);
    expect(copyButton.textContent).toContain("Скопировано");
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
});
