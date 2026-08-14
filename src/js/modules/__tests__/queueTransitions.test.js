import { JOB_STATUS } from "../features/queue/model.js";
import {
  canTransitionDownloadJob,
  transitionDownloadJob,
} from "../features/queue/transitions.js";

describe("queue transitions", () => {
  test.each([
    [JOB_STATUS.pending, JOB_STATUS.running],
    [JOB_STATUS.paused, JOB_STATUS.running],
    [JOB_STATUS.running, JOB_STATUS.done],
    [JOB_STATUS.running, JOB_STATUS.failed],
    [JOB_STATUS.running, JOB_STATUS.cancelled],
    [JOB_STATUS.failed, JOB_STATUS.pending],
  ])("allows %s -> %s", (from, to) => {
    expect(canTransitionDownloadJob({ status: from }, to)).toBe(true);
    expect(transitionDownloadJob({ status: from, url: "https://example.com" }, to))
      .toMatchObject({ status: to });
  });

  test("rejects unknown and terminal transitions", () => {
    expect(transitionDownloadJob({ status: JOB_STATUS.done }, JOB_STATUS.pending))
      .toBeNull();
    expect(transitionDownloadJob({ status: JOB_STATUS.pending }, "mystery"))
      .toBeNull();
  });
});
