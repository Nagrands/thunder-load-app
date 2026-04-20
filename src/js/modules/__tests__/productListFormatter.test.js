import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatProductLists, parseProductList } from "../formatters/productListFormatter.js";

const PRODUCT_LIST_FIXTURES_DIR = join(
  process.cwd(),
  "src/js/modules/__tests__/__fixtures__/productListFormatter",
);

function loadFormatterFixture(name) {
  return JSON.parse(
    readFileSync(join(PRODUCT_LIST_FIXTURES_DIR, `${name}.json`), "utf8"),
  );
}

describe("productListFormatter", () => {
  test("formats the prompt sample and appends the summary", () => {
    const input = `Заявка 1
Банан пол пака
Лимон 2кг

Заявка 4
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
      `Заявка 1
Банан 0.5ящ
Лимон 2

Заявка 4
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
Банан 1.5ящ (Заявка 1, Магазин)
Гриб Шампиньон 4 кг (Заявка 4)
Картофель 10 кг + 2м (Заявка 4, Магазин)
Киви 1ящ (Магазин)
Лимон 2 кг + 4 шт (Заявка 1, Заявка 4)
Лук Марс 1ящ (Магазин)
Огурец 1 кг (Заявка 4)
Перец микс 5 шт (Заявка 4)
Помидор 0.5 кг (Заявка 4)
Чеснок 0.5 кг (Заявка 4)`,
    );

    expect(result.fullOutputText).toBe(
      `${result.formattedSectionsText}\n\n${result.formattedSummaryText}`,
    );
    expect(result.sections.map((section) => section.name)).toEqual([
      "Заявка 1",
      "Заявка 4",
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
      line: "Банан 1.5ящ (Заявка 1, Магазин)",
      sources: ["Заявка 1", "Магазин"],
    });
  });

  test("normalizes decimal commas, grams, and unit names in sections", () => {
    const input = `Заявка 4
Грибы 100г
Лимон 4шт
Петрушка 1 головка
Укроп 2 пуч.
Чеснок 0,5`;

    const result = formatProductLists(input, { includeSummary: false });

    expect(result.formattedSectionsText).toBe(
      `Заявка 4
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
    const input = `Заявка 4
Черри 100г
Помидоры черри 0.2 кг
Помидор черри 50г`;

    const result = formatProductLists(input);

    expect(result.formattedSectionsText).toBe(`Заявка 4
Помидор черри 0.35`);
    expect(result.formattedSummaryText).toBe(`Итого
Помидор черри 0.35 кг (Заявка 4)`);
  });

  test("parseProductList returns structured sections and raw text without summary when disabled", () => {
    const parsed = parseProductList(`Заявка 1
Банан 1

Магазин
Банан`, { includeSummary: false });

    expect(parsed.sections).toHaveLength(2);
    expect(parsed.summary).toBeNull();
    expect(parsed.sections[0].items[0].line).toBe("Банан 1");
    expect(parsed.sections[0].text).toBe("Заявка 1\nБанан 1");
    expect(parsed.formattedSummaryText).toBe("");
    expect(parsed.fullOutputText).toBe("Заявка 1\nБанан 1\n\nМагазин\nБанан");
  });

  test("appends a greens summary block when the optional toggle is enabled", () => {
    const result = formatProductLists(
      `Заявка 4
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
Петрушка 1п (Заявка 4)
Укроп 22п (Заявка 4, Магазин)`,
    );
    expect(result.greensSummary?.text).toBe(result.formattedGreensSummaryText);
    expect(result.fullOutputText).toBe(
      `${result.formattedSectionsText}\n\n${result.formattedSummaryText}\n\n${result.formattedGreensSummaryText}`,
    );
    expect(result.greensSummary?.items[0]).toMatchObject({
      name: "Петрушка",
      line: "Петрушка 1п (Заявка 4)",
    });
  });

  test("returns diagnostics for ambiguous units, duplicates, typo fixes, and ignored store quantities", () => {
    const result = formatProductLists(`Заявка 4
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
          source: "Петрушка Ц 2 пуч",
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
    const result = formatProductLists(`Заявка 4
укроп 2 пуч.
петрушка 2 Пуч.

Магазин
Укроп 20
ПетрушкаЦ 15`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Заявка 4
Петрушка⁕ 2п
Укроп⁕ 2п

Магазин
Петрушка⁕ 15п
Укроп⁕ 20п`);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "typoCorrected",
          source: "Петрушка Ц 15",
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
    const result = formatProductLists(`Заявка 4
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
    const result = formatProductLists(`Заявка 4
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
    const result = formatProductLists(`Заявка 2

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

Заявка 6

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

    expect(result.formattedSectionsText).toBe(`Заявка 2
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

Заявка 6 (бар)
Грейпфрут 1шт
Имбирь 0.4
Корица трубчатая 0.2
Лайм 1
Лимон 2
Мята⁕ 0.15
Яблоко 2

Заявка 6 (кухня)
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
Банан 3 шт (Заявка 6 кухня)
Грейпфрут 1 шт (Заявка 6 бар)
Гриб Шампиньон 2 кг (Заявка 2, Заявка 6 кухня)
Имбирь 0.4 кг (Заявка 6 бар)
Кабачок 2 шт (Заявка 2)
Картофель 3 кг (Заявка 2)
Корица трубчатая 0.2 кг (Заявка 6 бар)
Лайм 1 кг (Заявка 6 бар)
Лимон 2 кг + 5 шт (Заявка 2, Заявка 6 бар)
Лук репчатый 2 кг (Заявка 2)
Перец микс 1 кг (Заявка 2)
Помидор 1 кг (Заявка 6 кухня)
Помидор черри 2 кг (Заявка 2, Заявка 6 кухня)
Яблоко 3 кг (Заявка 6 бар, Заявка 6 кухня)
Яйца 30 шт (Заявка 2)`);
    expect(result.sections.map((section) => section.title)).toEqual([
      "Заявка 2",
      "Заявка 6 (бар)",
      "Заявка 6 (кухня)",
    ]);
  });

  test("normalizes noisy mixed procurement lists into stable sections and aliases", () => {
    const result = formatProductLists(`Заявка 2 в 10

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

Заявка 4

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

Заявка 1

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

Заявка 5

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

    expect(result.formattedSectionsText).toBe(`Заявка 2
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

Заявка 4
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

Заявка 1
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

Заявка 5
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

  test("normalizes fused section titles and missing chili or egg aliases", () => {
    const result = formatProductLists(`Заявка 2

Чили перец 500гр
Имбирь-300гр.
Петрушка -100гр
Черри 1.5кг
Помидоры 1 кг.
Огурцы 500гр.
Лук зеленый 50гр.
Яблоки 500гр.
Лимон 1 кг
Апельсин 1 кг.
Яйцо куриные 30шт.
Мята 100гр.`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Заявка 2
Апельсин 1
Имбирь 0.3
Лимон 1
Лук зеленый⁕ 0.05
Мята⁕ 0.1
Огурец 0.5
Перец Чили 0.5
Петрушка⁕ 0.1
Помидор 1
Помидор черри 1.5
Яблоко 0.5
Яйца 30`);
    expect(result.formattedSectionsText).not.toContain("Чили перец");
    expect(result.formattedSectionsText).not.toContain("Яйцо куриные");
  });

  test("keeps address-like lines from swallowing the next section and ignores bare salad leaf lines", () => {
    const result = formatProductLists(`Магазин

Банан
Лайм
Апельсин
Перец светофор
Черри
Мандарин бэби
Баклажан
Мята 3
Щавель 4
Латук 4
Лук зел 10
Айс 3шт сред

Мята

Болгарский перец 1 кг
Лук порей 1 шт
Айсберг 0.300
Апельсин 2 кг
Лимон 1 кг
Лайм 1 кг
Мята 0.100
Грейпфрут 3 шт
Розмарин 0.100

Заявка 2

Помидоры 1 кг.
Огурцы 500гр.
Апельсин 500гр.
Укроп 100гр.
Грибы 2 кг.
Помидоры черри 1кг.
Мята 50гр.
Лимон 500гр.
Лист салата
Дубок красный 200гр.
Фризе 200гр.
Росса 200гр.
Лук зеленый 50гр.`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Магазин
Апельсин
Баклажан
Банан
Лайм
Латук⁕ 4п
Лук зеленый⁕ 10п
Мандарин бэби
Мята⁕ 3п
Перец микс
Помидор черри
Салат Айсберг⁕ 3шт
Щавель⁕ 4п

Мята
Апельсин 2
Грейпфрут 3шт
Лайм 1
Лимон 1
Лук порей⁕ 1шт
Мята⁕ 0.1
Перец микс 1
Розмарин⁕ 0.1
Салат Айсберг⁕ 0.3

Заявка 2
Апельсин 0.5
Гриб Шампиньон 2
Дубок красный⁕ 0.2
Лимон 0.5
Лук зеленый⁕ 0.05
Мята⁕ 0.05
Огурец 0.5
Помидор 1
Помидор черри 1
Салат Лолло Росса⁕ 0.2
Укроп⁕ 0.1
Фризе⁕ 0.2`);
    expect(result.formattedSectionsText).not.toContain("Сергеева");
    expect(result.formattedSectionsText).not.toContain("Латук⁕\n");
    expect(result.formattedSectionsText).not.toContain("(сред.");
  });

  test("normalizes plural produce, golden apples, color abbreviations, and colon decimals", () => {
    const result = formatProductLists(`Заявка 4
Кабачки 2 шт
Баклажаны 3 шт
Гольден 1 кг
Голден 2 кг
Яблоки Голден 0,5 кг
Дубок зел 0.150
Дубок кр 0:25
Баз кр 2
Баз зел 2`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Заявка 4
Базилик зеленый⁕ 2
Базилик красный⁕ 2
Баклажан 3шт
Дубок зеленый⁕ 0.15
Дубок красный⁕ 0.25
Кабачок 2шт
Яблоко Голден 3.5`);
    expect(result.formattedSectionsText).not.toContain("Гольден");
    expect(result.formattedSectionsText).not.toContain("Кабачки");
    expect(result.formattedSectionsText).not.toContain("Баклажаны");
  });

  test("preserves uppercase vitamin heading and converts post-quantity tails into qualifiers", () => {
    const result = formatProductLists(`Заявка 1

банан 0,5 ящ зел
лимон 1
апельсин 2
гольден 4 круп
мандарин 4 крупный красивый`);

    expect(result.formattedSectionsText).toBe(`Заявка 1
Апельсин 2
Банан 0.5ящ (зеленый)
Лимон 1
Мандарин 4
Яблоко Голден 4`);
    expect(result.formattedSummaryText).toBe(`Итого
Апельсин 2 кг (Заявка 1)
Банан 0.5ящ (Заявка 1)
Лимон 1 кг (Заявка 1)
Мандарин 4 кг (крупный) (Заявка 1)
Яблоко Голден 4 кг (крупный) (Заявка 1)`);
    expect(result.formattedSectionsText).not.toContain("Гольден");
    expect(result.formattedSectionsText).not.toContain("красивый");
    expect(result.formattedSectionsText).not.toContain("Банан зел");
  });

  test("does not mistake lower-case greenery aliases for section headings", () => {
    const result = formatProductLists(`фризе зел
дубок кр
фризе кр
тимьян
розмарин
лук зел`);

    expect(result.formattedSectionsText).toBe(`Дубок красный⁕
Лук зеленый⁕
Розмарин⁕
Тимьян⁕
Фризе зеленое⁕
Фризе красное⁕`);
    expect(result.formattedSummaryText).toBe("");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({
      title: "Без раздела",
      untitled: true,
    });
  });

  test("normalizes unicode punctuation, bullets, and noisy quantity markers", () => {
    const result = formatProductLists(`Заявка 7
• “Черри” — 0,500-кг
▪ Лимоны 2x
● Укроп 0,100гр.
◦ Бананы (1 пак)
• Петрушка / 2х`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Заявка 7
Банан 1ящ
Лимон 2шт
Петрушка⁕ 2шт
Помидор черри 0.5
Укроп⁕ 0.1`);
    expect(result.formattedSectionsText).not.toContain("“");
    expect(result.formattedSectionsText).not.toContain("—");
    expect(result.formattedSectionsText).not.toContain(" ");
  });

  test("resolves contextual aliases, reordered product names, and spaced decimals", () => {
    const result = formatProductLists(`Заявка 11
гала
репчатый лук
семрнко
лук 0, 500 гр`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Заявка 11
Лук репчатый 0.5
Яблоко Гала
Яблоко Симиренко`);
    expect(result.formattedSectionsText).not.toContain("семрнко");
    expect(result.formattedSectionsText).not.toContain("0, 500");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicateMerged",
          displayName: "Лук репчатый",
        }),
      ]),
    );
  });

  test("folds simirenko typo family into one canonical apple and keeps typo diagnostics", () => {
    const result = formatProductLists(`Заявка 12
Симиренко 1
семиренко 1
симиренкоо 1
семрнко 1`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Заявка 12
Яблоко Симиренко 4`);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "typoCorrected",
          displayName: "Яблоко Симиренко",
          source: "симиренкоо 1",
        }),
        expect.objectContaining({
          code: "duplicateMerged",
          displayName: "Яблоко Симиренко",
        }),
      ]),
    );
    expect(result.sections[0].items[0]).toMatchObject({
      uncertain: true,
    });
  });

  test("does not fuzzy-match when two custom candidates are equally close", () => {
    const result = formatProductLists(`Заявка 13
сома 1`, {
      includeSummary: false,
      replacements: {
        сима: "Тест Сима",
        сема: "Тест Сема",
      },
    });

    expect(result.formattedSectionsText).toBe(`Заявка 13
Сома 1`);
    expect(
      result.issues.some((issue) => issue.code === "typoCorrected"),
    ).toBe(false);
  });

  test("splits predictable slash-delimited clipboard lines without creating false headings", () => {
    const result = formatProductLists(`Магазин
Апельсин 2 шт / Лайм 1 шт / Укроп 5 / Петрушка 3`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Магазин
Апельсин 2шт
Лайм 1шт
Петрушка⁕ 3п
Укроп⁕ 5п`);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe("Магазин");
  });

  test("keeps uncertain handling for ambiguous entries after symbol normalization", () => {
    const result = formatProductLists(`Заявка 9
Лук — 5`, {
      includeSummary: false,
    });

    expect(result.formattedSectionsText).toBe(`Заявка 9
Лук репчатый 5`);
    expect(result.sections[0].items[0]).toMatchObject({
      uncertain: true,
    });
    expect(result.sections[0].items[0].uncertainReasons).toContain(
      "ambiguousUnitAssumedKg",
    );
  });

  test("matches the grouped section fixture", () => {
    const fixture = loadFormatterFixture("grouped-sections");
    const result = formatProductLists(fixture.input, fixture.options || {});

    expect(result.formattedSectionsText).toBe(fixture.formattedSectionsText);
    expect(result.sections.map((section) => section.title)).toEqual(
      fixture.sectionTitles,
    );
  });

  test("matches the heading-free greens fixture", () => {
    const fixture = loadFormatterFixture("heading-free-greens");
    const result = formatProductLists(fixture.input, fixture.options || {});

    expect(result.formattedSectionsText).toBe(fixture.formattedSectionsText);
    expect(result.formattedSummaryText).toBe(fixture.formattedSummaryText);
    expect(
      result.sections.map((section) => ({
        title: section.title,
        untitled: !!section.untitled,
      })),
    ).toEqual(fixture.sections);
  });

  test("matches the noisy clipboard fixture", () => {
    const fixture = loadFormatterFixture("noisy-clipboard");
    const result = formatProductLists(fixture.input, fixture.options || {});

    expect(result.formattedSectionsText).toBe(fixture.formattedSectionsText);
    expect(result.formattedSummaryText).toBe(fixture.formattedSummaryText);
    expect(result.sections.map((section) => section.title)).toEqual(
      fixture.sectionTitles,
    );
  });

  test("applies new produce aliases and keeps size notes only in summary", () => {
    const result = formatProductLists(`Заявка 4
Цв капуста 2
ялта 1
Огурец сол 3
Киш-миш 0.5
Брокколи 1
Пекинка 2
Памела 1
лимоны 4
Чили 0.2
Белозерка 1
Перец Крым 2
Яблоко гольден 3
Баклажаны 4 мелкое
Лимоны 5 среднее`);

    expect(result.formattedSectionsText).toBe(`Заявка 4
Баклажан 4
Виноград Кишмиш 0.5
Капуста брокколи 1
Капуста пекинская 2
Капуста цветная 2
Лимон 4
Лимон 5
Лук Ялта 1
Огурец соленый 3
Перец Белозерка 3
Перец Чили 0.2
Помело 1
Яблоко Голден 3`);
    expect(result.formattedSummaryText).toBe(`Итого
Баклажан 4 кг (мелкий) (Заявка 4)
Виноград Кишмиш 0.5 кг (Заявка 4)
Капуста брокколи 1 кг (Заявка 4)
Капуста пекинская 2 кг (Заявка 4)
Капуста цветная 2 кг (Заявка 4)
Лимон 4 кг (Заявка 4)
Лимон 5 кг (средний) (Заявка 4)
Лук Ялта 1 кг (Заявка 4)
Огурец соленый 3 кг (Заявка 4)
Перец Белозерка 3 кг (Заявка 4)
Перец Чили 0.2 кг (Заявка 4)
Помело 1 кг (Заявка 4)
Яблоко Голден 3 кг (Заявка 4)`);
  });
});
