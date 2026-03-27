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
Лимон 4шт
Огурец 1
Перец микс 5шт
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
Лимон 4шт
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

  test("appends a greens summary block when the optional toggle is enabled", () => {
    const result = formatProductLists(
      `Тесто
Укроп 2 пуч.
ПетрушкаЦ 1 пуч.

Магазин
Укроп 20
Банан`,
      {
        includeSummary: true,
        includeGreensSummary: true,
      },
    );

    expect(result.formattedGreensSummaryText).toBe(
      `Зелень
Петрушка 1п (Тесто)
Укроп 22п (Тесто, Магазин)`,
    );
    expect(result.greensSummary?.text).toBe(result.formattedGreensSummaryText);
    expect(result.fullOutputText).toBe(
      `${result.formattedSectionsText}\n\n${result.formattedSummaryText}\n\n${result.formattedGreensSummaryText}`,
    );
    expect(result.greensSummary?.items[0]).toMatchObject({
      name: "Петрушка",
      line: "Петрушка 1п (Тесто)",
    });
  });

  test("returns diagnostics for ambiguous units, duplicates, typo fixes, and ignored store quantities", () => {
    const result = formatProductLists(`Тесто
Лук 5
Лук 1 кг
ПетрушкаЦ 2 пуч.

Магазин
Чеснок 3`);

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "duplicateMerged",
        "typoCorrected",
        "storeQuantityIgnored",
      ]),
    );

    expect(result.diffEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "ПетрушкаЦ 2 пуч",
          output: "Петрушка⁕ 2п",
          uncertain: true,
        }),
      ]),
    );

    const parsley = result.sections[0].items.find(
      (item) => item.name === "Петрушка",
    );
    expect(parsley).toMatchObject({
      uncertain: true,
    });
    expect(parsley.uncertainReasons).toContain("typoCorrected");
  });

  test("does not drop greenery bunch quantities in sections or store rules", () => {
    const result = formatProductLists(`Тесто
укроп 2 пуч.
петрушка 2 Пуч.

Магазин
Укроп 20
ПетрушкаЦ 15`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Тесто
Петрушка⁕ 2п
Укроп⁕ 2п

Магазин
Петрушка⁕ 15п
Укроп⁕ 20п`);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "typoCorrected",
          source: "ПетрушкаЦ 15",
          output: "Петрушка⁕ 15п",
        }),
      ]),
    );
    expect(
      result.issues.some((issue) => issue.source === "укроп 2 пуч"),
    ).toBe(false);
    expect(
      result.issues.some((issue) => issue.source === "петрушка 2 Пуч"),
    ).toBe(false);
    expect(
      result.issues.some((issue) => issue.source === "Укроп 20"),
    ).toBe(false);
  });

  test("does not warn for lines that are already in valid normalized form", () => {
    const result = formatProductLists(`Тесто
Гриб Шампиньон 4
Картофель 10
Огурец 1
Помидор 0.5
Чеснок 0.5`);

    expect(result.issues).toEqual([]);
    expect(result.diffEntries).toEqual([]);
    expect(
      result.sections[0].items.some((item) => item.uncertain === true),
    ).toBe(false);
  });

  test("applies custom replacement rules and exposes normalization stats", () => {
    const result = formatProductLists(`Тесто
батат 2
батат 1
ПетрушкаЦ 2 пуч.`, {
      replacements: {
        батат: "Картофель сладкий",
      },
    });

    expect(result.sections[0].lines).toContain("Картофель сладкий 3");
    expect(result.normalizationStats).toMatchObject({
      duplicatesMerged: 1,
      typosCorrected: 1,
      reviewRequired: 2,
    });
  });

  test("builds grouped sections and broader produce replacements from noisy source lists", () => {
    const result = formatProductLists(`Рыба бар

кабачок-2 шт,
лук репка-2 кг,
картофель -3кг,
черри-1,5 кг,
перец светофор-1 кг,
шампиньоны -1,5кг,
петрушка 0,100гр,
укроп-0,100гр,
Лук зел 1п
Мангольд-0,300гр,
Бионда-0,300гр,
шпинат-0,300гр,
лимон-5шт,
яйцо куриное -30шт

Мята

Бар
Лайм 1 кг
Лимон 2 кг
Яблоки 2 кг
Мята 0.150
Грейпфрут 1 шт
Корица палочка 0.200
Корень имбиря 0.400

Кухня
Яблоки 1 кг
Лола бьонда 0.500
Мята 0.050
Шампиньоны 0.500
Помидор 1 кг
Банан 3 шт
Лук порей 1 шт
Черри 0.500
Лук зелёный 0.050
Сельдерей стебель 1 пачка`);

    expect(result.formattedSectionsText).toBe(`Рыба бар
Гриб Шампиньон 1.5
Кабачок 2шт
Картофель 3
Лимон 5шт
Лук зеленый⁕ 1п
Лук репчатый 2
Мангольд⁕ 0.3
Перец микс 1
Петрушка⁕ 0.1
Помидор черри 1.5
Салат Лолло Бионда⁕ 0.3
Укроп⁕ 0.1
Шпинат⁕ 0.3
Яйца 30шт

Мята (бар)
Грейпфрут 1шт
Имбирь 0.4
Корица трубчатая 0.2
Лайм 1
Лимон 2
Мята⁕ 0.15
Яблоко 2

Мята (кухня)
Банан 3шт
Гриб Шампиньон 0.5
Лук зеленый⁕ 1п
Лук порей⁕ 1шт
Мята⁕ 1п
Помидор 1
Помидор черри 0.5
Салат Лолло Бионда⁕ 0.5
Стебель сельдерея⁕ 1шт
Яблоко 1`);
    expect(result.formattedSummaryText).toBe(`Итого
Банан 3 шт (Мята кухня)
Грейпфрут 1 шт (Мята бар)
Гриб Шампиньон 2 кг (Рыба бар, Мята кухня)
Имбирь 0.4 кг (Мята бар)
Кабачок 2 шт (Рыба бар)
Картофель 3 кг (Рыба бар)
Корица трубчатая 0.2 кг (Мята бар)
Лайм 1 кг (Мята бар)
Лимон 2 кг + 5 шт (Рыба бар, Мята бар)
Лук репчатый 2 кг (Рыба бар)
Перец микс 1 кг (Рыба бар)
Помидор 1 кг (Мята кухня)
Помидор черри 2 кг (Рыба бар, Мята кухня)
Яблоко 3 кг (Мята бар, Мята кухня)
Яйца 30 шт (Рыба бар)`);
    expect(result.sections.map((section) => section.title)).toEqual([
      "Рыба бар",
      "Мята (бар)",
      "Мята (кухня)",
    ]);
  });
});
