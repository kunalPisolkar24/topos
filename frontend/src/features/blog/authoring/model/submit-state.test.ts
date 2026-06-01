import {
  isSubmitInFlight,
  submitLabel,
  type PostAuthoringSubmitState,
} from "../model/submit-state";

describe("PostAuthoringSubmitState helpers", () => {
  const states: PostAuthoringSubmitState[] = [
    { kind: "idle" },
    { kind: "uploading" },
    { kind: "creating" },
    { kind: "updating" },
    { kind: "error", message: "boom" },
  ];

  it("isSubmitInFlight is true only for the in-flight kinds", () => {
    expect(isSubmitInFlight({ kind: "idle" })).toBe(false);
    expect(isSubmitInFlight({ kind: "uploading" })).toBe(true);
    expect(isSubmitInFlight({ kind: "creating" })).toBe(true);
    expect(isSubmitInFlight({ kind: "updating" })).toBe(true);
    expect(isSubmitInFlight({ kind: "error", message: "x" })).toBe(false);
  });

  it("submitLabel reflects the in-flight state", () => {
    expect(submitLabel({ kind: "uploading" }, false)).toBe("Uploading...");
    expect(submitLabel({ kind: "creating" }, false)).toBe("Publishing...");
    expect(submitLabel({ kind: "updating" }, true)).toBe("Saving...");
  });

  it("submitLabel returns the idle label based on mode", () => {
    expect(submitLabel({ kind: "idle" }, false)).toBe("Publish Post");
    expect(submitLabel({ kind: "idle" }, true)).toBe("Save Changes");
  });

  it("submitLabel treats error as idle for label purposes", () => {
    expect(submitLabel({ kind: "error", message: "x" }, false)).toBe("Publish Post");
    expect(submitLabel({ kind: "error", message: "x" }, true)).toBe("Save Changes");
  });

  it("exhaustiveness: every state kind is accounted for", () => {
    expect(states.length).toBe(5);
    expect(new Set(states.map((state) => state.kind))).toEqual(
      new Set(["idle", "uploading", "creating", "updating", "error"]),
    );
  });
});
