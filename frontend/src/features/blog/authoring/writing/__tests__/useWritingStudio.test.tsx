import { HttpResponse, graphql } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import { server } from "@/test/server";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { MIN_PROMPT_LENGTH } from "@/entities/post/lib";
import type { WritingBrief } from "../types";
import { useWritingStudio, type UseWritingStudioResult } from "../useWritingStudio";

const noopUnauthorized = async () => {};

function makeApolloWrapper() {
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
  return { wrapper };
}

const generatedBody = [
  "<p>Intro.</p>",
  "<h2>Setup in minutes</h2><p>Setup body.</p>",
  "<h2>Pitfalls</h2><p>Pitfalls body.</p>",
].join("\n");

function mockGenerate(captured: { variables?: unknown }) {
  const graphqlApi = graphql.link("http://localhost:4000/graphql");
  server.use(
    graphqlApi.mutation("GeneratePostContent", async ({ request }) => {
      const body = (await request.json()) as unknown as {
        variables?: unknown;
      };
      captured.variables = body.variables;
      return HttpResponse.json({
        data: {
          generatePostContent: {
            __typename: "GeneratedPost",
            title: "Styled Title",
            body: generatedBody,
            summary: "Styled summary",
            tags: ["how-to", "technical"],
          },
        },
      });
    }),
  );
}

const renderStudio = (onApplied?: (brief: WritingBrief) => void) => {
  const onTitleChange = vi.fn();
  const onContentChange = vi.fn();
  const onTagsChange = vi.fn();
  const onSummaryChange = vi.fn();
  const { wrapper } = makeApolloWrapper();
  const utils = renderHook(
    () =>
      useWritingStudio({
        onTitleChange,
        onContentChange,
        onTagsChange,
        onSummaryChange,
        ...(onApplied ? { onApplied } : {}),
      }),
    { wrapper },
  );
  return {
    ...utils,
    onTitleChange,
    onContentChange,
    onTagsChange,
    onSummaryChange,
  };
};

const fillTopic = (result: { current: UseWritingStudioResult }) => {
  act(() => {
    result.current.setBriefField("topic", "a".repeat(MIN_PROMPT_LENGTH + 1));
  });
};

describe("useWritingStudio", () => {
  it("stays on the brief step until the topic is long enough", () => {
    const { result } = renderStudio();

    expect(result.current.step).toBe("brief");
    expect(result.current.canGenerate).toBe(false);

    fillTopic(result);
    expect(result.current.canGenerate).toBe(true);
  });

  it("sends the brief and splits the body into sections", async () => {
    const captured: { variables?: unknown } = {};
    mockGenerate(captured);
    const { result } = renderStudio();
    fillTopic(result);

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.step).toBe("draft");
    });
    expect(captured.variables).toMatchObject({
      prompt: "a".repeat(MIN_PROMPT_LENGTH + 1),
      brief: expect.objectContaining({ tone: "PROFESSIONAL" }),
    });
    expect(result.current.sections.map((section) => section.heading)).toEqual([
      "",
      "Setup in minutes",
      "Pitfalls",
    ]);
  });

  it("edits, reorders, and removes sections before applying", async () => {
    mockGenerate({});
    const onApplied = vi.fn();
    const {
      result,
      onTitleChange,
      onContentChange,
      onTagsChange,
      onSummaryChange,
    } = renderStudio(onApplied);
    fillTopic(result);

    await act(async () => {
      await result.current.generate();
    });
    await waitFor(() => {
      expect(result.current.step).toBe("draft");
    });

    const pitfallsId = result.current.sections[2].id;
    act(() => result.current.moveSection(pitfallsId, -1));
    expect(result.current.sections[1].heading).toBe("Pitfalls");

    act(() => result.current.updateSectionHeading(pitfallsId, "Watch out"));
    expect(result.current.sections[1].heading).toBe("Watch out");

    const introId = result.current.sections[0].id;
    act(() => result.current.removeSection(introId));
    expect(result.current.sections).toHaveLength(2);

    act(() => result.current.applyToEditor());
    expect(onTitleChange).toHaveBeenCalledWith("Styled Title");
    expect(onContentChange).toHaveBeenCalledWith(
      expect.stringContaining("<h2>Watch out</h2>"),
    );
    expect(onTagsChange).toHaveBeenCalledWith(["how-to", "technical"]);
    expect(onSummaryChange).toHaveBeenCalledWith("Styled summary");
    expect(onApplied).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "professional" }),
    );
  });

  it("reports incomplete drafts without leaving the brief step", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GeneratePostContent", () =>
        HttpResponse.json({
          data: {
            generatePostContent: {
              __typename: "GeneratedPost",
              title: "",
              body: "<p>No sections.</p>",
              summary: null,
              tags: [],
            },
          },
        }),
      ),
    );
    const { result } = renderStudio();
    fillTopic(result);

    await act(async () => {
      await result.current.generate();
    });

    expect(result.current.step).toBe("brief");
    expect(result.current.sections).toEqual([]);
  });

  it("edits section bodies and returns to the brief without losing sections", async () => {
    mockGenerate({});
    const { result } = renderStudio();
    fillTopic(result);

    await act(async () => {
      await result.current.generate();
    });
    await waitFor(() => {
      expect(result.current.step).toBe("draft");
    });

    const targetId = result.current.sections[1].id;
    act(() => result.current.updateSectionBody(targetId, "<p>Hand-edited.</p>"));
    expect(result.current.sections[1].bodyHtml).toBe("<p>Hand-edited.</p>");

    act(() => result.current.editBrief());
    expect(result.current.step).toBe("brief");
    expect(result.current.sections).toHaveLength(3);
  });

  it("regenerates the whole draft in place", async () => {
    const captured: { variables?: unknown } = {};
    mockGenerate(captured);
    const { result } = renderStudio();
    fillTopic(result);

    await act(async () => {
      await result.current.generate();
    });
    await waitFor(() => {
      expect(result.current.step).toBe("draft");
    });

    await act(async () => {
      await result.current.regenerateAll();
    });

    expect(result.current.step).toBe("draft");
    expect(result.current.sections).toHaveLength(3);
    expect(captured.variables).toMatchObject({
      brief: expect.objectContaining({ tone: "PROFESSIONAL" }),
    });
  });

  it("regenerates a single section with an instruction", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    const captured: { variables?: unknown } = {};
    let calls = 0;
    server.use(
      graphqlApi.mutation("GeneratePostContent", async ({ request }) => {
        const body = (await request.json()) as unknown as {
          variables?: unknown;
        };
        captured.variables = body.variables;
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({
            data: {
              generatePostContent: {
                __typename: "GeneratedPost",
                title: "Styled Title",
                body: generatedBody,
                summary: "Styled summary",
                tags: ["how-to", "technical"],
              },
            },
          });
        }
        return HttpResponse.json({
          data: {
            generatePostContent: {
              __typename: "GeneratedPost",
              title: "Styled Title",
              body: "<p>Intro.</p><h2>Pitfalls</h2><p>Fresh take on pitfalls.</p>",
              summary: "Styled summary",
              tags: ["how-to", "technical"],
            },
          },
        });
      }),
    );
    const { result } = renderStudio();
    fillTopic(result);

    await act(async () => {
      await result.current.generate();
    });
    await waitFor(() => {
      expect(result.current.step).toBe("draft");
    });

    const before = result.current.sections.map((section) => section.bodyHtml);
    const pitfallsId = result.current.sections[2].id;

    await act(async () => {
      await result.current.regenerateSection(pitfallsId, "make it shorter");
    });

    expect(result.current.regeneratingSectionId).toBeNull();
    expect(result.current.sections[2].bodyHtml).toContain("Fresh take on pitfalls");
    expect(result.current.sections[0].bodyHtml).toBe(before[0]);
    expect(captured.variables).toMatchObject({
      brief: expect.objectContaining({ tone: "PROFESSIONAL" }),
    });
    expect(JSON.stringify(captured.variables)).toContain("make it shorter");
  });
});
