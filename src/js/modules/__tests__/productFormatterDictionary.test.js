import {
  inspectProductFormatterDictionary,
  parseProductFormatterDictionary,
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
      appliedCount: 2,
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
});
