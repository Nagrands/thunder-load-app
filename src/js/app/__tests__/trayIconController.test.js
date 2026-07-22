const path = require("path");

jest.mock("electron", () => ({
  nativeImage: { createFromPath: jest.fn() },
}));

jest.mock("electron-log", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

const { createTrayIconController } = require("../trayIconController.js");

describe("trayIconController", () => {
  function createController(platform = "win32") {
    const images = [];
    const imageApi = {
      createFromPath: jest.fn((iconPath) => {
        const image = {
          iconPath,
          isEmpty: jest.fn(() => false),
          setTemplateImage: jest.fn(),
        };
        images.push(image);
        return image;
      }),
    };
    const logger = { warn: jest.fn(), error: jest.fn() };
    const fileSystem = { existsSync: jest.fn(() => true) };
    const controller = createTrayIconController({
      fileSystem,
      imageApi,
      logger,
    });
    controller.configure({ getAppPath: () => "/app" }, platform);
    return { controller, fileSystem, imageApi, images, logger };
  }

  test("loads platform state resource and deduplicates updates", () => {
    const { controller, imageApi } = createController();
    const tray = { setImage: jest.fn() };
    controller.init(tray);

    expect(controller.updateTrayIcon("downloading")).toBe(true);
    expect(controller.updateTrayIcon("downloading")).toBe(false);
    expect(imageApi.createFromPath).toHaveBeenCalledWith(
      path.join("/app", "assets", "icons", "tray", "tray-active.ico"),
    );
    expect(tray.setImage).toHaveBeenCalledTimes(1);
  });

  test("marks every macOS state image as a template", () => {
    const { controller, images } = createController("darwin");
    const image = controller.loadImage("error");
    expect(image.setTemplateImage).toHaveBeenCalledWith(true);
    expect(images[0].iconPath).toContain("trayErrorTemplate.png");
  });

  test("keeps the current image when a resource is missing", () => {
    const { controller, fileSystem, logger } = createController();
    const tray = { setImage: jest.fn() };
    controller.init(tray);
    fileSystem.existsSync.mockReturnValue(false);

    expect(controller.updateTrayIcon("offline")).toBe(false);
    expect(tray.setImage).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  test("rejects invalid states without throwing", () => {
    const { controller, logger } = createController();
    controller.init({ setImage: jest.fn() });
    expect(controller.updateTrayIcon("broken")).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith("Unsupported tray state: broken");
  });
});
