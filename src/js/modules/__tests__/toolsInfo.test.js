import { renderToolsInfo } from "../toolsInfo";

jest.mock("../tooltipInitializer.js", () => ({
  initTooltips: jest.fn(),
}));

jest.mock("../modals.js", () => ({
  showConfirmationDialog: jest.fn(),
}));

describe("renderToolsInfo", () => {
  const versionPayload = {
    ytDlp: { ok: true, path: "/bin/yt-dlp", version: "2024.01.01" },
    ffmpeg: { ok: true, path: "/bin/ffmpeg", version: "ffmpeg version 7.1" },
    deno: { ok: true, path: "/bin/deno", version: "deno 1.42.0" },
  };

  beforeEach(() => {
    document.body.innerHTML = '<section id="tools-info"></section>';
    Object.defineProperty(window.navigator, "onLine", {
      value: true,
      configurable: true,
    });
    window.electron = {
      invoke: jest.fn().mockResolvedValue(undefined),
      tools: {
        getLocation: jest.fn().mockResolvedValue({
          success: true,
          path: "/tmp/tools",
          isDefault: false,
          defaultPath: "/opt/tools",
        }),
        getVersions: jest.fn().mockResolvedValue(versionPayload),
      },
    };
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete window.electron;
    jest.clearAllMocks();
  });

  it("renders dynamic tools UI with ti- prefixed ids", async () => {
    await renderToolsInfo();

    expect(document.getElementById("ti-tools-location-path")).not.toBeNull();
    expect(document.getElementById("tools-location-path")).toBeNull();
  });

  it("shows tools version summary when all tools exist", async () => {
    await renderToolsInfo();
    const status = document.getElementById("tools-status");

    expect(status).not.toBeNull();
    expect(status.textContent).toContain("yt-dlp 2024.01.01");
    expect(status.textContent).toContain("ffmpeg 7.1");
    expect(status.textContent).toContain("Deno 1.42.0");
  });
});
