import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import {
  PREVIEW_NOTICE_DISMISSED_KEY,
  previewNoticeDismissedKey,
} from "@/shared/config/preview";
import { PreviewNoticeDialog } from "../PreviewNoticeDialog";

vi.mock("@/shared/config/preview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/config/preview")>();
  return { ...actual, isPreview: () => true };
});

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const buildMe = (id: string) => ({
  __typename: "User",
  id,
  username: id,
  email: `${id}@topos.dev`,
  name: `User ${id}`,
  bio: null,
  avatarUrl: null,
  bannerUrl: null,
  createdAt: new Date().toISOString(),
});

let currentMe: ReturnType<typeof buildMe> | null = null;

const setupMeHandler = () => {
  server.use(
    graphqlApi.query("Me", () =>
      HttpResponse.json({ data: { me: currentMe } }),
    ),
  );
};

const dismissDialog = async () => {
  await userEvent.click(screen.getByLabelText(/don't show again/i));
  await userEvent.click(screen.getByRole("button", { name: /continue in preview/i }));
};

describe("PreviewNoticeDialog dismissal", () => {
  beforeEach(() => {
    localStorage.clear();
    currentMe = null;
    sessionStoreActions.resetForTests();
    setupMeHandler();
  });

  it("stores anonymous dismissal under the shared key", async () => {
    sessionStoreActions.markAnonymous();
    renderWithProviders(<PreviewNoticeDialog trigger="landing" />);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await dismissDialog();

    expect(localStorage.getItem(PREVIEW_NOTICE_DISMISSED_KEY)).toBe("true");
  });

  it("scopes dismissal per authenticated user", async () => {
    sessionStoreActions.markAuthenticated("token-a");
    currentMe = buildMe("user-a");
    const first = renderWithProviders(<PreviewNoticeDialog trigger="landing" />);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await dismissDialog();
    expect(localStorage.getItem(previewNoticeDismissedKey("user-a"))).toBe("true");
    expect(localStorage.getItem(PREVIEW_NOTICE_DISMISSED_KEY)).toBeNull();
    first.unmount();

    // A different user on the same browser still sees the notice.
    currentMe = buildMe("user-b");
    renderWithProviders(<PreviewNoticeDialog trigger="landing" />);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("stays dismissed when the same user returns", async () => {
    sessionStoreActions.markAuthenticated("token-a");
    currentMe = buildMe("user-a");
    localStorage.setItem(previewNoticeDismissedKey("user-a"), "true");

    renderWithProviders(<PreviewNoticeDialog trigger="landing" />);

    // Wait past the landing auto-open delay, then assert it stayed shut.
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
