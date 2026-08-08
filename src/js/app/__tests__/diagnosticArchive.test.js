const fs = require("fs");
const os = require("os");
const path = require("path");
const { collectLogEntries, createZip } = require("../diagnosticArchive");

describe("diagnosticArchive", () => {
  let root;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "thunder-diagnostics-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test("creates a valid empty ZIP structure", () => {
    const zip = createZip([{ name: "diagnostics.json", data: "{}" }]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.includes(Buffer.from("diagnostics.json"))).toBe(true);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
  });

  test("redacts secrets while collecting log files", async () => {
    fs.writeFileSync(
      path.join(root, "main_v1.6.0.log"),
      'request https://example.test/?token=secret {"token":"also-secret"}\n',
    );
    const entries = await collectLogEntries(root);
    expect(entries[0].data).toContain("token=[REDACTED]");
    expect(entries[0].data).not.toContain("token=secret");
    expect(entries[0].data).not.toContain("also-secret");
  });
});
