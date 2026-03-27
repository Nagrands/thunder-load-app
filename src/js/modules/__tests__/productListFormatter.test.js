import { formatProductLists, parseProductList } from "../formatters/productListFormatter.js";

describe("productListFormatter", () => {
  test("formats the prompt sample and appends the summary", () => {
    const input = `Витамин
Банан пол пака
Лимон 2кг

Тесто
Грибы 4 кг.
картофель 10 кг.
помидоры 500г
огурцы 1 кг.
перец болгарский 5 шт.
укроп 2 пуч.
петрушка 2 Пуч.
Чеснок 0,5
Лимон 4шт

Магазин
Киви
Банан
Картофель бел 2
Укроп 20
Лук Марс
ПетрушкаЦ 15`;

    const result = formatProductLists(input, { includeSummary: true });

    expect(result.formattedSectionsText).toBe(
      `Витамин
Банан 0.5 пака
Лимон 2

Тесто
Гриб Шампиньон 4
Картофель 10
Лимон 4 шт
Огурец 1
Перец микс 5 шт
Петрушка⁕ 2п
Помидор 0.5
Укроп⁕ 2п
Чеснок 0.5

Магазин
Банан
Картофель белый 2м
Киви
Лук Марс
Петрушка⁕ 15п
Укроп⁕ 20п`,
    );

    expect(result.formattedSummaryText).toBe(
      `Итого
Банан 0.5 пака + 1ящ (Витамин, Магазин)
Гриб Шампиньон 4 кг (Тесто)
Картофель 10 кг (Тесто)
Картофель белый 2м (Магазин)
Киви 1ящ (Магазин)
Лимон 2 кг + 4 шт (Витамин, Тесто)
Лук Марс 1ящ (Магазин)
Огурец 1 кг (Тесто)
Перец микс 5 шт (Тесто)
Помидор 0.5 кг (Тесто)
Чеснок 0.5 кг (Тесто)`,
    );

    expect(result.fullOutputText).toBe(
      `${result.formattedSectionsText}\n\n${result.formattedSummaryText}`,
    );
    expect(result.sections.map((section) => section.name)).toEqual([
      "Витамин",
      "Тесто",
      "Магазин",
    ]);
    expect(result.sections[1].items[0]).toMatchObject({
      name: "Гриб Шампиньон",
      line: "Гриб Шампиньон 4",
    });
    expect(result.sections[1].text).toBe(result.sections[1].previewText);
    expect(result.summary?.text).toBe(result.formattedSummaryText);
    expect(result.summary?.items[0]).toMatchObject({
      name: "Банан",
      line: "Банан 0.5 пака + 1ящ (Витамин, Магазин)",
      sources: ["Витамин", "Магазин"],
    });
  });

  test("normalizes decimal commas, grams, and unit names in sections", () => {
    const input = `Тесто
Грибы 100г
Лимон 4шт
Петрушка 1 головка
Укроп 2 пуч.
Чеснок 0,5`;

    const result = formatProductLists(input, { includeSummary: false });

    expect(result.formattedSectionsText).toBe(
      `Тесто
Гриб Шампиньон 0.1
Лимон 4 шт
Петрушка⁕ 1 гол
Укроп⁕ 2п
Чеснок 0.5`,
    );
    expect(result.formattedSummaryText).toBe("");
    expect(result.fullOutputText).toBe(result.formattedSectionsText);
  });

  test("applies shop-specific rules, dedupes entries, and excludes greenery from summary", () => {
    const input = `Магазин
Укроп 20
Картофель бел 2
Картофель бел 3
Лук Марс
Лук Марс
Айс
ПетрушкаЦ 15`;

    const result = formatProductLists(input);

    expect(result.formattedSectionsText).toBe(
      `Магазин
Картофель белый 5м
Лук Марс
Петрушка⁕ 15п
Салат Айсберг⁕
Укроп⁕ 20п`,
    );
    expect(result.formattedSummaryText).toBe(
      `Итого
Картофель белый 5м (Магазин)
Лук Марс 1ящ (Магазин)`,
    );
  });

  test("merges cherry variants and sums weights", () => {
    const input = `Тесто
Черри 100г
Помидоры черри 0.2 кг
Помидор черри 50г`;

    const result = formatProductLists(input);

    expect(result.formattedSectionsText).toBe(`Тесто
Помидор черри 0.35`);
    expect(result.formattedSummaryText).toBe(`Итого
Помидор черри 0.35 кг (Тесто)`);
  });

  test("parseProductList returns structured sections and raw text without summary when disabled", () => {
    const parsed = parseProductList(`Витамин
Банан 1

Магазин
Банан`, { includeSummary: false });

    expect(parsed.sections).toHaveLength(2);
    expect(parsed.summary).toBeNull();
    expect(parsed.sections[0].items[0].line).toBe("Банан 1");
    expect(parsed.sections[0].text).toBe("Витамин\nБанан 1");
    expect(parsed.formattedSummaryText).toBe("");
    expect(parsed.fullOutputText).toBe("Витамин\nБанан 1\n\nМагазин\nБанан");
  });
});
