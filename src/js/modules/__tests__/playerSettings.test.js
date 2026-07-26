const mockShowToast = jest.fn();

jest.mock("../toast.js", () => ({
  showToast: mockShowToast,
}));

function renderPlayerSettings() {
  document.body.innerHTML = `
    <input id="settings-player-sidebar-pinned" type="checkbox">
    <input id="settings-player-background-playback" type="checkbox">
    <input id="settings-player-shuffle" type="checkbox">
    <div role="radiogroup">
      <button type="button" role="radio" data-player-repeat="off"></button>
      <button type="button" role="radio" data-player-repeat="one"></button>
      <button type="button" role="radio" data-player-repeat="all"></button>
    </div>
    <input id="settings-player-volume" type="range" min="0" max="100">
    <output id="settings-player-volume-value"></output>`;
}

const completeState = (overrides = {}) => ({
  sidebarPinned: false,
  backgroundPlayback: true,
  shuffle: false,
  repeat: "off",
  volume: 1,
  muted: false,
  ...overrides,
});

describe("Player settings controller", () => {
  beforeEach(() => {
    jest.resetModules();
    mockShowToast.mockReset();
    renderPlayerSettings();
    window.electron = {
      invoke: jest.fn().mockResolvedValue({ success: true }),
    };
  });

  test("loads and normalizes current Player state when Settings opens", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        success: true,
        data: completeState({
          sidebarPinned: true,
          repeat: "all",
          volume: 0.64,
        }),
      }),
      updateSettings: jest.fn(),
    };
    const { createPlayerSettingsController } = require(
      "../features/settings/playerSettings.js"
    );
    const controller = createPlayerSettingsController({ api });

    window.dispatchEvent(new Event("settings:opened"));
    await Promise.resolve();
    await Promise.resolve();

    expect(api.getState).toHaveBeenCalledTimes(1);
    expect(document.getElementById("settings-player-sidebar-pinned").checked).toBe(
      true,
    );
    expect(
      document.querySelector('[data-player-repeat="all"]').getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
    expect(document.getElementById("settings-player-volume").value).toBe("64");
    expect(
      document.getElementById("settings-player-volume").getAttribute(
        "aria-valuetext",
      ),
    ).toBe("64%");
    controller.dispose();
  });

  test("saves changes immediately and publishes an apply event", async () => {
    const api = {
      getState: jest.fn(),
      updateSettings: jest.fn(async (patch) => ({
        success: true,
        data: completeState(patch),
      })),
    };
    const { createPlayerSettingsController } = require(
      "../features/settings/playerSettings.js"
    );
    const applied = jest.fn();
    window.addEventListener("now-playing:settings-apply", applied);
    const controller = createPlayerSettingsController({ api });
    const shuffle = document.getElementById("settings-player-shuffle");

    shuffle.checked = true;
    shuffle.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(api.updateSettings).toHaveBeenCalledWith({ shuffle: true });
    expect(applied).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ shuffle: true }),
      }),
    );
    window.removeEventListener("now-playing:settings-apply", applied);
    controller.dispose();
  });

  test("maps zero volume to mute and unmutes above zero", async () => {
    let saved = completeState();
    const api = {
      getState: jest.fn(),
      updateSettings: jest.fn(async (patch) => {
        saved = completeState({ ...saved, ...patch });
        return { success: true, data: saved };
      }),
    };
    const { createPlayerSettingsController } = require(
      "../features/settings/playerSettings.js"
    );
    const controller = createPlayerSettingsController({ api });
    const volume = document.getElementById("settings-player-volume");

    volume.value = "0";
    volume.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(api.updateSettings).toHaveBeenLastCalledWith({
      volume: 0,
      muted: true,
    });

    volume.value = "25";
    volume.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(api.updateSettings).toHaveBeenLastCalledWith({
      volume: 0.25,
      muted: false,
    });
    expect(document.getElementById("settings-player-volume-value").value).toBe(
      "25%",
    );
    controller.dispose();
  });

  test("updates from an open Player without saving back or creating a loop", () => {
    const api = {
      getState: jest.fn(),
      updateSettings: jest.fn(),
    };
    const { createPlayerSettingsController } = require(
      "../features/settings/playerSettings.js"
    );
    const controller = createPlayerSettingsController({ api });

    window.dispatchEvent(
      new CustomEvent("now-playing:settings-state", {
        detail: completeState({
          backgroundPlayback: false,
          shuffle: true,
          repeat: "one",
          volume: 0.8,
          muted: true,
        }),
      }),
    );

    expect(
      document.getElementById("settings-player-background-playback").checked,
    ).toBe(false);
    expect(document.getElementById("settings-player-shuffle").checked).toBe(
      true,
    );
    expect(
      document.querySelector('[data-player-repeat="one"]').getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
    expect(document.getElementById("settings-player-volume").value).toBe("0");
    expect(api.updateSettings).not.toHaveBeenCalled();
    controller.dispose();
  });

  test("restores the previous value when atomic saving fails", async () => {
    const api = {
      getState: jest.fn(),
      updateSettings: jest.fn().mockResolvedValue({
        success: false,
        error: { message: "Save failed" },
      }),
    };
    const { createPlayerSettingsController } = require(
      "../features/settings/playerSettings.js"
    );
    const controller = createPlayerSettingsController({ api });
    const pin = document.getElementById("settings-player-sidebar-pinned");

    pin.checked = true;
    pin.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(pin.checked).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith("Save failed", "error");
    controller.dispose();
  });
});
