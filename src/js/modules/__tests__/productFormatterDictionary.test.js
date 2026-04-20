import {
  inspectProductFormatterDictionary,
  parseProductFormatterDictionary,
  parseProductFormatterDictionaryRules,
  removeInvalidProductFormatterDictionaryLines,
} from "../formatters/productFormatterDictionary.js";

describe("productFormatterDictionary", () => {
  test("parses valid rules and keeps the last duplicate key", () => {
    const result = parseProductFormatterDictionary(`батат = Картофель сладкий
Батат = Батат новый
лук = Лук репчатый`);

    expect(result).toEqual({
      батат: "Батат новый",
      лук: "Лук репчатый",
    });
  });

  test("inspects invalid, duplicate, no-op, and override rules", () => {
    const result = inspectProductFormatterDictionary(`батат
батат = Картофель сладкий
Батат = Батат новый
лук = лук
черри = Томаты черри`);

    expect(result).toMatchObject({
      appliedCount: 3,
      invalidLines: [1],
      duplicateLines: [3],
      noopLines: [4],
      overrideLines: [5],
    });
    expect(result.dictionary).toEqual({
      батат: "Батат новый",
      черри: "Томаты черри",
    });
  });

  test("removes only invalid dictionary lines", () => {
    const result = removeInvalidProductFormatterDictionaryLines(`батат
батат = Картофель сладкий
морковь =
лук = лук
черри = Томаты черри`);

    expect(result).toBe(`батат = Картофель сладкий
лук = лук
черри = Томаты черри`);
  });

  test("parses structured alias, normalize, and token rules", () => {
    const result = inspectProductFormatterDictionary(`alias: батат = Картофель сладкий
normalize: симмеренко = симиренко
tokens: лук + репчат !зел [магазин|заявка 4] = Лук репчатый`);

    expect(result.appliedCount).toBe(3);
    expect(result.typeCounts).toEqual({
      alias: 1,
      normalize: 1,
      token_rule: 1,
    });
    expect(parseProductFormatterDictionaryRules(`alias: батат = Картофель сладкий
normalize: симмеренко = симиренко
tokens: лук + репчат !зел [магазин|заявка 4] = Лук репчатый`)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "alias",
          normalizedSource: "батат",
          target: "Картофель сладкий",
        }),
        expect.objectContaining({
          type: "normalize",
          normalizedSource: "симмеренко",
          target: "симиренко",
        }),
        expect.objectContaining({
          type: "token_rule",
          requiresTokens: ["лук", "репчат"],
          forbidsTokens: ["зел"],
          sections: ["магазин", "заявка 4"],
          target: "Лук репчатый",
        }),
      ]),
    );
  });
});
