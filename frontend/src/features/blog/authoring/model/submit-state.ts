export type PostAuthoringSubmitState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "creating" }
  | { kind: "updating" }
  | { kind: "error"; message: string };

export const isSubmitInFlight = (
  state: PostAuthoringSubmitState,
): boolean =>
  state.kind === "uploading" ||
  state.kind === "creating" ||
  state.kind === "updating";

export const submitLabel = (
  state: PostAuthoringSubmitState,
  isEdit: boolean,
): string => {
  switch (state.kind) {
    case "uploading":
      return "Uploading...";
    case "creating":
      return "Publishing...";
    case "updating":
      return "Saving...";
    case "idle":
    case "error":
      return isEdit ? "Save Changes" : "Publish Post";
  }
};
