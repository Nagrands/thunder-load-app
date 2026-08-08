const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  configureDiagnosticsLogger,
  rotateArchivedLogs,
  sanitizeValue,
} = require("../diagnosticsLogger");

function createLog() {
  const methods = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return {
    ...methods,
    transports: {
      console: { level: "info" },
      file: {
        level: "info",
        getFile: () => ({ path: path.join("/tmp", "logs", "main.log") }),
      },
    },
  };
}

describe("diagnosticsLogger", () => {
  test("redacts secrets recursively", () => {
    expect(
      sanitizeValue({
        token: "secret-token",
        nested: { authorization: "Bearer abc", url: "https://a.test/?token=abc" },
      }),
    ).toEqual({
      token: "[REDACTED]",
      nested: { authorization: "[REDACTED]", url: "https://a.test/?token=[REDACTED]" },
    });
  });

  test("writes structured scoped events and persists debug level", () => {
    const log = createLog();
    const store = { get: jest.fn(() => "info"), set: jest.fn() };
    const logger = configureDiagnosticsLogger({
      app: { getVersion: () => "1.6.0" },
      store,
      log,
    });
    logger.createScope("Downloader").warning("retry", {
      correlationId: "job-1",
    });
    expect(JSON.parse(log.warn.mock.calls[0][0])).toMatchObject({
      scope: "Downloader",
      level: "warning",
      event: "retry",
      correlationId: "job-1",
    });
    expect(logger.setLevel("debug")).toBe("debug");
    expect(store.set).toHaveBeenCalledWith("diagnostics.logLevel", "debug");
  });

  test("keeps the current log plus four bounded archives", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "thunder-log-rotate-"));
    const current = path.join(root, "main.log");
    try {
      fs.writeFileSync(current, "current");
      for (let index = 1; index <= 4; index += 1) {
        fs.writeFileSync(`${current}.${index}`, String(index));
      }
      rotateArchivedLogs({ toString: () => current });
      expect(fs.readFileSync(`${current}.1`, "utf8")).toBe("current");
      expect(fs.readFileSync(`${current}.4`, "utf8")).toBe("3");
      expect(fs.existsSync(`${current}.5`)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
