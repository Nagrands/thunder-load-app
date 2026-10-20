/** @jest-environment jsdom */

describe("batch review metadata loader", () => {
  let createBatchMetadataLoader;
  let resolvers;
  let getInfo;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    jest.resetModules();
    resolvers = new Map();
    getInfo = jest.fn(
      (url) =>
        new Promise((resolve) => {
          resolvers.set(url, resolve);
        }),
    );
    ({
      createBatchMetadataLoader,
    } = require("../features/batchReview/metadata.js"));
  });

  test("limits concurrency and reports loaded metadata", async () => {
    const onUpdate = jest.fn();
    const loader = createBatchMetadataLoader({
      getInfo,
      onUpdate,
      concurrency: 2,
    });

    loader.ensure(["a", "b", "c"]);
    expect(getInfo).toHaveBeenCalledTimes(2);

    resolvers.get("a")({ success: true, title: "A" });
    await flush();

    expect(onUpdate).toHaveBeenCalledWith("a", {
      success: true,
      title: "A",
    });
    expect(getInfo).toHaveBeenCalledTimes(3);

    loader.dispose();
  });

  test("ignores stale results after reset and deduplicates requests", async () => {
    const onUpdate = jest.fn();
    const loader = createBatchMetadataLoader({
      getInfo,
      onUpdate,
      concurrency: 2,
    });

    loader.ensure(["a", "a"]);
    loader.ensure(["a"]);
    expect(getInfo).toHaveBeenCalledTimes(1);

    loader.reset();
    loader.ensure(["b"]);
    expect(getInfo).toHaveBeenCalledTimes(2);

    resolvers.get("a")({ success: true, title: "A" });
    await flush();
    expect(onUpdate).not.toHaveBeenCalled();

    resolvers.get("b")({ success: true, title: "B" });
    await flush();
    expect(onUpdate).toHaveBeenCalledWith("b", {
      success: true,
      title: "B",
    });

    loader.dispose();
  });

  test("normalizes failed and unavailable preview responses", async () => {
    const onUpdate = jest.fn();
    const loader = createBatchMetadataLoader({
      getInfo,
      onUpdate,
      concurrency: 1,
    });

    loader.ensure(["a", "b"]);
    resolvers.get("a")({ success: false, error: "nope" });
    await flush();
    expect(onUpdate).toHaveBeenCalledWith("a", null);

    resolvers.get("b")({ success: true, title: "B" });
    await flush();
    expect(onUpdate).toHaveBeenCalledWith("b", {
      success: true,
      title: "B",
    });

    loader.dispose();
  });
});
