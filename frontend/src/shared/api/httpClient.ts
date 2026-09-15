import { getGraphQLErrorMessage } from "./errors/graphql-error";

export interface HttpClient {
  postFormData(
    url: string,
    formData: FormData,
    headers?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export const fetchHttpClient: HttpClient = {
  async postFormData(url, formData, headers, signal) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", onExternalAbort, { once: true });
      }
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const fallback = `Upload failed with status ${response.status}`;
        let data: unknown = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (data && typeof data === "object") {
          const record = data as Record<string, unknown>;
          const maybeError = record.error;

          let cloudinaryMessage: string | null = null;
          if (typeof maybeError === "string" && maybeError.trim()) {
            cloudinaryMessage = maybeError;
          } else if (
            maybeError &&
            typeof maybeError === "object" &&
            "message" in maybeError &&
            typeof (maybeError as { message: unknown }).message === "string" &&
            (maybeError as { message: string }).message.trim()
          ) {
            cloudinaryMessage = (maybeError as { message: string }).message;
          }

          if (cloudinaryMessage) {
            throw new Error(cloudinaryMessage);
          }

          const fromData = getGraphQLErrorMessage(data, "");
          if (fromData) {
            throw new Error(fromData);
          }

          if (maybeError) {
            const fromError = getGraphQLErrorMessage(maybeError, "");
            if (fromError) {
              throw new Error(fromError);
            }
          }
        }

        if (data) {
          const msg = getGraphQLErrorMessage(data, fallback);
          throw new Error(msg);
        }

        throw new Error(fallback);
      }

      return response.json();
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        if (signal?.aborted) {
          throw error;
        }
        throw new Error("Upload timed out. Please try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener("abort", onExternalAbort);
      }
    }
  },
};

export const createMockHttpClient = (response: unknown): HttpClient => ({
  async postFormData() {
    return response;
  },
});
