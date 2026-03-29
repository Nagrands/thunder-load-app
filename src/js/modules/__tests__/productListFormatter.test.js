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
Банан 0.5ящ
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
Картофель 2м
Киви
Лук Марс
Петрушка⁕ 15п
Укроп⁕ 20п`,
    );

    expect(result.formattedSummaryText).toBe(
      `Итого
Банан 1.5ящ (Витамин, Магазин)
Гриб Шампиньон 4 кг (Тесто)
Картофель 10 кг + 2м (Тесто, Магазин)
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
      line: "Банан 1.5ящ (Витамин, Магазин)",
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
Картофель 5м
Лук Марс
Петрушка⁕ 15п
Салат Айсберг⁕
Укроп⁕ 20п`,
    );
    expect(result.formattedSummaryText).toBe(
      `Итого
Картофель 5м (Магазин)
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
Яйца 30

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

  test("normalizes noisy mixed procurement lists into stable sections and aliases", () => {
    const result = formatProductLists(`Рыба бар в 10

шампиньоны -2,5 кг,
картофель -6кг,
чеснок-0,500-гр,
перец светофор-2 кг,
помидор -3-кг,
огурец-1 кг,
лимон-1кг
апельсин-4шт,
укроп-0,100гр,
петрушка-0,150гр,
кунжут  белый 0,1
кунжут черный 0,1
Мангольд-0,800,
бионда о,800,
шпинат-0,800гр,
айсберг -3 головки,
яйцо куриное-30,
яйцо перепелиное-30 шт,
лук зелёный -2 пучка

Тесто

Картошка 10 кг
лук 5 кг
огурцы 1 кг
айсберг 2 головы
укроп 2 пучка
петрушки 2 пучка.
Маринованные огурцы 1 ведро
помидоры 1 кг
перец светофор 5 штук
капуста мол 17кг сред на голубцы

Витамин

Бананы 1 пак
Мандарин крупный 3кг
Апельсин 1.5кг

Мята

Болгарский перец 0,5
Айсберг 1шт
Апельсин 0,5
Лист салата 0,5
Киви 0,5
Яблоко 0,5
Апельсин 1кг
Лимон 1кг
Мед 1банка
Лайм 0,5
Мята 0,2
Розмарин 0,05

Рыба Горького

Шампиньон 1кг
Баклажан 3шт
Лимон 3кг
Лайм 1.5кг
Апельсин 3кг
Перец болгарский 1кг
Огурец 3шт длиные
Помидор 0.5кг
Черри 1.5кг
Лук репчатый 2кг
Чилли 0.3
Яйцо кур. 30шт
Имбирь 0.2

Магазин

Яйцо 60
Банан
Лимон
Апельсин
Груша
Огурец 2ящ
Огурец длин
Помидоры роз 2ящ
Помидор коктейль
Капуста не крупная
Капуста молодая
Морковь
Лук
Свекла
Перец светофор
Грибы
Баклажан
Картофель бел 2м
Картофель роз
Редис 10п
Порей 2шт
Стебель 2
Лук зел 35
Шпинат 12
Руккола 10
Кинза 10
Баз кр 2
Баз зел 2
Петрушка 25
Укроп 35
Латук 20
Росса 4
Бионда 4`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Рыба бар
Апельсин 4шт
Гриб Шампиньон 2.5
Картофель 6
Кунжут 0.1
Кунжут белый 0.1
Лимон 1
Лук зеленый⁕ 2п
Мангольд⁕ 0.8
Огурец 1
Перец микс 2
Петрушка⁕ 0.15
Помидор 3
Салат Айсберг⁕ 3шт
Салат Лолло Бионда⁕ 0.8
Укроп⁕ 0.1
Чеснок 0.5
Шпинат⁕ 0.8
Яйца 30
Яйцо перепелиное 30

Тесто
Капуста молодая 17
Картофель 10
Лук репчатый 5
Огурец 1
Огурец маринованный 1в
Перец микс 5шт
Петрушка⁕ 2п
Помидор 1
Салат Айсберг⁕ 2шт
Укроп⁕ 2п

Витамин
Апельсин 1.5
Банан 1ящ
Мандарин 3

Мята
Апельсин 1.5
Киви 0.5
Лайм 0.5
Латук⁕ 0.5
Лимон 1
Мёд 1
Мята⁕ 0.2
Перец микс 0.5
Розмарин⁕ 0.05
Салат Айсберг⁕ 1шт
Яблоко 0.5

Рыба Горького
Апельсин 3
Баклажан 3шт
Гриб Шампиньон 1
Имбирь 0.2
Лайм 1.5
Лимон 3
Лук репчатый 2
Огурец длинный 3шт
Перец микс 1
Перец Чили 0.3
Помидор 0.5
Помидор черри 1.5
Яйца 30

Магазин
Апельсин
Базилик зеленый⁕ 2п
Базилик красный⁕ 2п
Баклажан
Банан
Гриб Шампиньон
Груша
Капуста
Капуста молодая
Картофель 2м
Картофель розовый
Кинза⁕ 10п
Латук⁕ 20п
Лимон
Лук зеленый⁕ 35п
Лук порей⁕ 2шт
Лук репчатый
Морковь
Огурец 2ящ
Огурец длинный
Перец микс
Петрушка⁕ 25п
Помидор коктейль
Помидоры розовый 2ящ
Редис⁕ 10п
Руккола⁕ 10п
Салат Лолло Бионда⁕ 4п
Салат Лолло Росса⁕ 4п
Свекла
Стебель сельдерея⁕ 2шт
Укроп⁕ 35п
Шпинат⁕ 12п
Яйца 60`);
  });
});
