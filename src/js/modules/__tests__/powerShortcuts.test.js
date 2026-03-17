import {
  POWER_SHORTCUT_ACTIONS,
  POWER_SHORTCUT_GROUPS,
  getPowerActionStateTone,
  isPowerActionEnabled,
} from "../views/tools/powerShortcuts.js";

describe("powerShortcuts config", () => {
  test("defines complete action config for every power shortcut", () => {
    expect(POWER_SHORTCUT_GROUPS.map((group) => group.id)).toEqual([
      "power",
      "recovery",
      "system",
    ]);
    expect(POWER_SHORTCUT_ACTIONS).toHaveLength(6);

    POWER_SHORTCUT_ACTIONS.forEach((action) => {
      expect(action.id).toBeTruthy();
      expect(action.groupId).toBeTruthy();
      expect(action.buttonId).toBeTruthy();
      expect(action.resultId).toBeTruthy();
      expect(action.detailId).toBeTruthy();
      expect(action.stateId).toBeTruthy();
      expect(action.invokeMethod).toMatch(/^createWindows/);
      expect(action.cardTitleKey).toMatch(/^quickActions\./);
      expect(action.confirmKey).toMatch(/^quickActions\./);
    });
  });

  test("maps action states to unified tones", () => {
    expect(getPowerActionStateTone("idle")).toBe("muted");
    expect(getPowerActionStateTone("creating")).toBe("warning");
    expect(getPowerActionStateTone("success")).toBe("success");
    expect(getPowerActionStateTone("error")).toBe("error");
  });

  test("enables actions only when tool is visible on windows and not busy", () => {
    expect(
      isPowerActionEnabled({ isWindows: true, showTool: true, busy: false }),
    ).toBe(true);
    expect(
      isPowerActionEnabled({ isWindows: true, showTool: true, busy: true }),
    ).toBe(false);
    expect(
      isPowerActionEnabled({ isWindows: false, showTool: true, busy: false }),
    ).toBe(false);
    expect(
      isPowerActionEnabled({ isWindows: true, showTool: false, busy: false }),
    ).toBe(false);
  });
});
