const { EventEmitter } = require("events");
const { ProcessSupervisor } = require("../processSupervisor");

describe("ProcessSupervisor", () => {
  test("tracks a child until it closes", () => {
    const child = new EventEmitter();
    child.pid = 42;
    child.exitCode = null;
    child.once = child.once.bind(child);
    const supervisor = new ProcessSupervisor({ spawnImpl: () => child });
    expect(
      supervisor.spawn("ffmpeg", [], {}, { owner: "Player", tool: "FFmpeg" }),
    ).toBe(child);
    expect(supervisor.getSnapshot()).toHaveLength(1);
    child.exitCode = 0;
    child.emit("close", 0, null);
    expect(supervisor.getSnapshot()).toHaveLength(0);
  });

  test("falls back from SIGTERM to SIGKILL for a stuck process tree", async () => {
    const child = new EventEmitter();
    child.pid = 43;
    child.exitCode = null;
    child.once = child.once.bind(child);
    const killTree = jest.fn(async (_child, signal) => {
      if (signal === "SIGKILL") child.exitCode = 137;
      return true;
    });
    const supervisor = new ProcessSupervisor({
      spawnImpl: () => child,
      terminateGraceMs: 1,
      killTree,
    });
    supervisor.spawn("yt-dlp", [], {}, { owner: "Downloader" });
    await supervisor.terminate(child, { reason: "test" });
    expect(killTree.mock.calls.map((call) => call[1])).toEqual([
      "SIGTERM",
      "SIGKILL",
    ]);
  });
});
