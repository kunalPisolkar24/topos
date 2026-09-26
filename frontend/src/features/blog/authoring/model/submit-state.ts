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
  isResubmit = false,
): string => {
  switch (state.kind) {
    case "uploading":
      return "Uploading...";
    case "creating":
      return "Submitting...";
    case "updating":
      return isResubmit ? "Resubmitting..." : "Submitting...";
    case "idle":
    case "error":
      if (isResubmit) return "Resubmit for review";
      return isEdit ? "Submit Revision" : "Submit for Review";
  }
};
