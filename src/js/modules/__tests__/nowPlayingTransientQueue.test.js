import { jest } from "@jest/globals";
import { createTransientQueue } from "../nowPlaying/transientQueue.js";

describe("Now Playing transient queue", () => {
  test("keeps insertion order and supports reorder, removal and filtering", () => {
    const onChange = jest.fn();
    const queue = createTransientQueue({ onChange });
    queue.add({ id: "one", title: "One" });
    queue.add({ id: "two", title: "Two" });
    queue.move("two", -1);

    expect(queue.getItems().map((item) => item.id)).toEqual(["two", "one"]);
    expect(queue.takeNext(new Set(["one"]))).toEqual(
      expect.objectContaining({ id: "one" }),
    );
    expect(queue.getItems()).toEqual([]);
    expect(onChange).toHaveBeenCalled();
  });

  test("never exposes mutable internal items", () => {
    const queue = createTransientQueue();
    const track = { id: "one", title: "One" };
    queue.add(track);
    track.title = "Changed";
    const snapshot = queue.getItems();
    snapshot[0].title = "Also changed";
    expect(queue.getItems()[0].title).toBe("One");
  });
});
