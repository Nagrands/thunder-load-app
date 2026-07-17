import {
  createWingetStatusService,
  normalizePackageIds,
} from "../views/tools/wingetStatusService.js";

describe("wingetStatusService", () => {
  test("normalizes package IDs without case-insensitive duplicates", () => {
    expect(
      normalizePackageIds([
        " Git.Git ",
        "git.git",
        "",
        "VideoLAN.VLC",
        null,
      ]),
    ).toEqual(["Git.Git", "VideoLAN.VLC"]);
  });

  test("reuses an identical in-flight request regardless of ID order", async () => {
    let resolveRequest;
    const checkStatus = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const service = createWingetStatusService(checkStatus);

    const first = service.load(["Git.Git", "VideoLAN.VLC"]);
    const second = service.load(["videolan.vlc", "git.git"]);

    expect(checkStatus).toHaveBeenCalledTimes(1);
    resolveRequest({ success: true, items: [] });
    await expect(first).resolves.toMatchObject({ success: true });
    await expect(second).resolves.toMatchObject({ success: true });
  });

  test("does not cache a completed successful request", async () => {
    const checkStatus = jest.fn().mockResolvedValue({
      success: true,
      items: [],
    });
    const service = createWingetStatusService(checkStatus);

    await service.load(["Git.Git"]);
    await service.load(["Git.Git"]);

    expect(checkStatus).toHaveBeenCalledTimes(2);
  });

  test("clears a rejected in-flight request", async () => {
    const checkStatus = jest
      .fn()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce({ success: true, items: [] });
    const service = createWingetStatusService(checkStatus);

    await expect(service.load(["Git.Git"])).rejects.toThrow("Unavailable");
    await expect(service.load(["Git.Git"])).resolves.toMatchObject({
      success: true,
    });
    expect(checkStatus).toHaveBeenCalledTimes(2);
  });
});
