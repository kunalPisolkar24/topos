import { render, screen, waitFor } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import { HttpResponse, graphql } from "msw";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { createApolloClient } from "@/shared/api";
import { server } from "@/test/server";
import { env } from "@/shared/config/env";
import { useWritingStudio } from "../useWritingStudio";
import { WritingStudio } from "../WritingStudio";

const noopUnauthorized = async () => {};

const renderStudio = () => {
  const clientRef: { current: ApolloClient | null } = { current: null };
  const wrapper = ({ children }: { children: ReactNode }) => {
    if (clientRef.current === null) {
      clientRef.current = createApolloClient({
        uri: env.VITE_GRAPHQL_URL,
        getToken: () => null,
        onUnauthorized: noopUnauthorized,
      });
    }
    return (
      <ApolloProvider client={clientRef.current}>
        <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>
      </ApolloProvider>
    );
  };
  const hook = renderHook(
    () =>
      useWritingStudio({
        onTitleChange: () => {},
        onContentChange: () => {},
        onTagsChange: () => {},
        onSummaryChange: () => {},
      }),
    { wrapper },
  );
  const view = render(<WritingStudio studio={hook.result.current} />, {
    wrapper,
  });
  return { hook, view };
};

const selectOption = async (label: string, option: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
};

describe("WritingStudio selects", () => {
  it("selects tone, audience, length, and structure through dropdowns", async () => {
    const { hook, view } = renderStudio();
    expect(hook.result.current.brief.tone).toBe("professional");

    await selectOption("Tone", "Witty");
    view.rerender(<WritingStudio studio={hook.result.current} />);
    expect(hook.result.current.brief.tone).toBe("witty");
    expect(screen.getByRole("combobox", { name: "Tone" })).toHaveTextContent(
      "Witty",
    );

    await selectOption("Audience", "Expert");
    expect(hook.result.current.brief.audience).toBe("expert");

    await selectOption("Length", "Deep");
    expect(hook.result.current.brief.length).toBe("deep");

    await selectOption("Structure", "Opinion");
    expect(hook.result.current.brief.structure).toBe("opinion");
  });

  it("generates a draft only after the topic is long enough", async () => {
    const { hook, view } = renderStudio();

    expect(
      screen.getByRole("button", { name: /generate draft/i }),
    ).toBeDisabled();

    await act(async () => {
      hook.result.current.setBriefField("topic", "a".repeat(31));
    });
    view.rerender(<WritingStudio studio={hook.result.current} />);
    expect(
      screen.getByRole("button", { name: /generate draft/i }),
    ).not.toBeDisabled();
  });

  it("shows per-section regenerate controls after generating", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GeneratePostContent", () =>
        HttpResponse.json({
          data: {
            generatePostContent: {
              __typename: "GeneratedPost",
              title: "Styled Title",
              body: "<p>Intro.</p><h2>Pitfalls</h2><p>Pitfalls body.</p>",
              summary: "Styled summary",
              tags: ["how-to"],
            },
          },
        }),
      ),
    );
    const { hook, view } = renderStudio();

    await act(async () => {
      hook.result.current.setBriefField("topic", "a".repeat(31));
    });
    await act(async () => {
      await hook.result.current.generate();
    });
    view.rerender(<WritingStudio studio={hook.result.current} />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /regenerate draft/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Edit brief" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Regenerate" })).toHaveLength(2);
    expect(
      screen.getAllByLabelText("Regenerate instruction (optional)"),
    ).toHaveLength(2);
  });
});
