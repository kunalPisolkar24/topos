import { HttpResponse, graphql, http } from "msw";
import { isPreviewEnv } from "@/shared/config/env";
import {
  approvePostDraft,
  authenticate,
  createPost,
  createPostDraft,
  deletePost,
  deletePostDraft,
  generatePostContent,
  generateTags,
  getPost,
  getSignedInUser,
  listMyPostDrafts,
  listPostDrafts,
  listPosts,
  listPostsByTag,
  listTags,
  recordPostView,
  rejectPostDraft,
  searchPosts,
  toUserResponse,
  togglePostLike,
  togglePostSave,
  updatePost,
  updateProfile,
  type MockUser,
} from "./data";
import {
  previewApprovePostDraft,
  previewAskChat,
  previewAuthenticate,
  previewCreateChat,
  previewCreateContentDraft,
  previewCreatePost,
  previewCreatePostDraft,
  previewDeleteChat,
  previewDeletePost,
  previewDeletePostDraft,
  previewGeneratePostContent,
  previewGenerateTags,
  previewGetChat,
  previewGetPost,
  previewGetUserById,
  previewGetUserFromToken,
  previewListChatMessages,
  previewListChats,
  previewListMyPostDrafts,
  previewListMyPosts,
  previewListPostDrafts,
  previewListPosts,
  previewListPostsByTag,
  previewListRecommendedPosts,
  previewListTags,
  previewRecordSignal,
  previewRejectPostDraft,
  previewRenameChat,
  previewResubmitContentDraft,
  previewSearchPosts,
  previewToggleLike,
  previewToggleSave,
  previewUpdatePost,
  previewUpdateProfile,
} from "./preview/preview-store";
import { previewDB } from "./preview/preview-db";

const gql = graphql.link("http://localhost:4000/graphql");

const isAuthenticated = (request: Request) =>
  request.headers.get("authorization") !== null;

const getToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  return header.replace(/^Bearer\s+/i, "").trim() || null;
};

const me = () => {
  const user = getSignedInUser();
  return user ? toUserResponse(user) : null;
};

const previewMe = async (request: Request) => {
  const token = getToken(request);
  const user = await previewGetUserFromToken(token);
  return user ? toUserResponse(user) : null;
};

export const handlers = [
  gql.query("Me", async ({ request }) => {
    if (isPreviewEnv) {
      const user = await previewMe(request);
      return HttpResponse.json({ data: { me: user } });
    }
    return HttpResponse.json({
      data: { me: isAuthenticated(request) ? me() : null },
    });
  }),

  gql.query("User", async ({ variables }) => {
    if (isPreviewEnv) {
      const id = (variables as { id?: string })?.id;
      const user = id ? await previewGetUserById(id) : null;
      return HttpResponse.json({ data: { user } });
    }
    return HttpResponse.json({ data: { user: null } });
  }),

  gql.mutation("Signin", async ({ variables }) => {
    if (isPreviewEnv) {
      const email = (variables as { email?: string })?.email ?? "preview@topos.dev";
      const payload = await previewAuthenticate(email);
      return HttpResponse.json({ data: { signin: payload } });
    }
    return HttpResponse.json({
      data: { signin: authenticate() },
    });
  }),

  gql.mutation("Signup", async ({ variables }) => {
    if (isPreviewEnv) {
      const email = (variables as { email?: string })?.email ?? "preview@topos.dev";
      const payload = await previewAuthenticate(email);
      return HttpResponse.json({ data: { signup: payload } });
    }
    return HttpResponse.json({
      data: { signup: authenticate() },
    });
  }),

  gql.mutation("UpdateProfile", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      const updated = await previewUpdateProfile(user.id, {
        name: variables?.name,
        bio: variables?.bio,
        avatarUrl: variables?.avatarUrl,
        bannerUrl: variables?.bannerUrl,
      });
      return HttpResponse.json({ data: { updateProfile: updated } });
    }
    return HttpResponse.json({
      data: {
        updateProfile: updateProfile({
          name: variables?.name,
          bio: variables?.bio,
          avatarUrl: variables?.avatarUrl,
          bannerUrl: variables?.bannerUrl,
        }),
      },
    });
  }),

  gql.query("Posts", async ({ variables }) => {
    if (isPreviewEnv) {
      const data = await previewListPosts(variables?.page ?? 1, variables?.limit ?? 6);
      return HttpResponse.json({ data: { posts: data } });
    }
    return HttpResponse.json({
      data: { posts: listPosts(variables?.page ?? 1, variables?.limit ?? 6) },
    });
  }),

  gql.query("PostsByTag", async ({ variables }) => {
    if (isPreviewEnv) {
      const data = await previewListPostsByTag(
        variables?.tag,
        variables?.page ?? 1,
        variables?.limit ?? 6,
      );
      return HttpResponse.json({ data: { postsByTag: data } });
    }
    return HttpResponse.json({
      data: {
        postsByTag: listPostsByTag(
          variables?.tag,
          variables?.page ?? 1,
          variables?.limit ?? 6,
        ),
      },
    });
  }),

  gql.query("Post", async ({ variables }) => {
    if (isPreviewEnv) {
      const post = await previewGetPost(variables?.id);
      return HttpResponse.json({ data: { post } });
    }
    return HttpResponse.json({
      data: { post: getPost(variables?.id) },
    });
  }),

  gql.query("Tags", async ({ variables }) => {
    if (isPreviewEnv) {
      const tags = await previewListTags(variables?.query ?? "", variables?.limit ?? 6);
      return HttpResponse.json({ data: { tags } });
    }
    return HttpResponse.json({
      data: { tags: listTags(variables?.query ?? "", variables?.limit ?? 6) },
    });
  }),

  gql.query("MyPosts", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ data: { me: null } });
      const posts = await previewListMyPosts(user.id, variables?.page ?? 1, variables?.limit ?? 6);
      return HttpResponse.json({
        data: { me: { __typename: "User", id: user.id, posts } },
      });
    }
    return HttpResponse.json({
      data: {
        me: isAuthenticated(request)
          ? {
              __typename: "User",
              id: me()?.id,
              posts: listPosts(variables?.page ?? 1, variables?.limit ?? 6),
            }
          : null,
      },
    });
  }),

  gql.query("SearchPosts", async ({ variables }) => {
    if (isPreviewEnv) {
      const data = await previewSearchPosts(
        variables?.query,
        variables?.page ?? 1,
        variables?.limit ?? 6,
      );
      return HttpResponse.json({ data: { searchPosts: data } });
    }
    return HttpResponse.json({
      data: {
        searchPosts: searchPosts(
          variables?.query,
          variables?.page ?? 1,
          variables?.limit ?? 6,
        ),
      },
    });
  }),

  gql.query("RecommendedPosts", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      const data = await previewListRecommendedPosts(
        user.id,
        variables?.page ?? 1,
        variables?.limit ?? 6,
        variables?.mode ?? null,
        variables?.seed ?? null,
      );
      return HttpResponse.json({ data: { recommendedPosts: data } });
    }
    return HttpResponse.json(
      isAuthenticated(request)
        ? {
            data: {
              recommendedPosts: listPosts(
                variables?.page ?? 1,
                variables?.limit ?? 6,
              ),
            },
          }
        : { errors: [{ message: "unauthorized" }] },
    );
  }),

  gql.mutation("CreatePost", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      const result = await previewCreatePost(user.id, variables?.input);
      return HttpResponse.json({ data: { createPost: result } });
    }
    return HttpResponse.json({
      data: { createPost: createPost(variables?.input) },
    });
  }),

  gql.mutation("UpdatePost", async ({ variables }) => {
    if (isPreviewEnv) {
      const result = await previewUpdatePost(variables?.id, variables?.input);
      return HttpResponse.json({ data: { updatePost: result } });
    }
    return HttpResponse.json({
      data: { updatePost: updatePost(variables?.id, variables?.input) },
    });
  }),

  gql.mutation("DeletePost", async ({ variables }) => {
    if (isPreviewEnv) {
      const result = await previewDeletePost(variables?.id);
      return HttpResponse.json({ data: { deletePost: result } });
    }
    return HttpResponse.json({
      data: { deletePost: deletePost(variables?.id) },
    });
  }),

  gql.mutation("RecordPostView", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (user && variables?.postId) {
        await previewRecordSignal(user.id, variables.postId, "view", variables?.mode ?? null);
      }
      return HttpResponse.json({ data: { recordPostView: true } });
    }
    return HttpResponse.json({
      data: { recordPostView: recordPostView() },
    });
  }),

  gql.mutation("LikePost", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      const result = await previewToggleLike(variables?.postId);
      if (user && result && variables?.postId) {
        // Toggle-on publishes signal like production; toggle-off is a no-op.
        await previewRecordSignal(user.id, variables.postId, "like", variables?.mode ?? null);
      }
      return HttpResponse.json({ data: { likePost: result } });
    }
    return HttpResponse.json({
      data: { likePost: togglePostLike(variables?.postId) },
    });
  }),

  gql.mutation("SavePost", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      const result = await previewToggleSave(variables?.postId);
      if (user && result && variables?.postId) {
        await previewRecordSignal(user.id, variables.postId, "save", variables?.mode ?? null);
      }
      return HttpResponse.json({ data: { savePost: result } });
    }
    return HttpResponse.json({
      data: { savePost: togglePostSave(variables?.postId) },
    });
  }),

  gql.mutation("GenerateTags", async ({ variables }) => {
    if (isPreviewEnv) {
      return HttpResponse.json({
        data: { generateTags: previewGenerateTags(variables?.title, variables?.body) },
      });
    }
    return HttpResponse.json({
      data: { generateTags: generateTags(variables?.title, variables?.body) },
    });
  }),

  gql.mutation("GeneratePostContent", async ({ variables }) => {
    if (isPreviewEnv) {
      return HttpResponse.json({
        data: { generatePostContent: previewGeneratePostContent(variables?.prompt) },
      });
    }
    return HttpResponse.json({
      data: { generatePostContent: generatePostContent(variables?.prompt) },
    });
  }),

  gql.query("PostDrafts", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      const data = await previewListPostDrafts(
        variables?.page ?? 1,
        variables?.limit ?? 6,
        user.id,
      );
      return HttpResponse.json({ data: { postDrafts: data } });
    }
    return HttpResponse.json({
      data: { postDrafts: listPostDrafts(variables?.page ?? 1, variables?.limit ?? 6) },
    });
  }),

  gql.query("MyPostDrafts", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ data: { myPostDrafts: { drafts: [], totalPages: 1, currentPage: 1, totalDrafts: 0, __typename: "PaginatedPostDrafts" } } });
      const data = await previewListMyPostDrafts(user.id, variables?.page ?? 1, variables?.limit ?? 6);
      return HttpResponse.json({ data: { myPostDrafts: data } });
    }
    return HttpResponse.json({
      data: { myPostDrafts: listMyPostDrafts(variables?.page ?? 1, variables?.limit ?? 6) },
    });
  }),

  gql.mutation("CreatePostDraft", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      const draft = await previewCreatePostDraft(user.id, variables?.prompt);
      return HttpResponse.json({ data: { createPostDraft: draft } });
    }
    return HttpResponse.json({
      data: { createPostDraft: createPostDraft(variables?.prompt) },
    });
  }),

  gql.mutation("CreateContentDraft", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      try {
        const draft = await previewCreateContentDraft(user.id, variables?.input ?? {});
        return HttpResponse.json({ data: { createContentDraft: draft } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not submit draft";
        return HttpResponse.json({ errors: [{ message }] });
      }
    }
    return HttpResponse.json({ errors: [{ message: "not available outside preview" }] });
  }),

  gql.mutation("ResubmitContentDraft", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      try {
        const draft = await previewResubmitContentDraft(
          variables?.id,
          user.id,
          variables?.input ?? {},
        );
        return HttpResponse.json({ data: { resubmitContentDraft: draft } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not resubmit draft";
        return HttpResponse.json({ errors: [{ message }] });
      }
    }
    return HttpResponse.json({ errors: [{ message: "not available outside preview" }] });
  }),

  gql.mutation("ApprovePostDraft", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      try {
        const draft = await previewApprovePostDraft(variables?.id, user.id, variables?.input);
        return HttpResponse.json({ data: { approvePostDraft: draft } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not approve draft";
        return HttpResponse.json({ errors: [{ message }] });
      }
    }
    return HttpResponse.json({
      data: { approvePostDraft: approvePostDraft(variables?.id, variables?.input) },
    });
  }),

  gql.mutation("RejectPostDraft", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      try {
        const draft = await previewRejectPostDraft(variables?.id, user.id, variables?.reason);
        return HttpResponse.json({ data: { rejectPostDraft: draft } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not reject draft";
        return HttpResponse.json({ errors: [{ message }] });
      }
    }
    return HttpResponse.json({
      data: { rejectPostDraft: rejectPostDraft(variables?.id) },
    });
  }),

  gql.mutation("DeletePostDraft", async ({ request, variables }) => {
    if (isPreviewEnv) {
      const token = getToken(request);
      const user = await previewGetUserFromToken(token);
      if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
      try {
        const result = await previewDeletePostDraft(variables?.id, user.id);
        return HttpResponse.json({ data: { deletePostDraft: result } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not withdraw draft";
        return HttpResponse.json({ errors: [{ message }] });
      }
    }
    return HttpResponse.json({
      data: { deletePostDraft: deletePostDraft(variables?.id) },
    });
  }),

  gql.query("Chats", async ({ request, variables }) => {
    const user = await resolveChatUser(request);
    if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
    const data = await previewListChats(user.id, variables?.page ?? 1, variables?.limit ?? 10);
    return HttpResponse.json({ data: { chats: data } });
  }),

  gql.query("Chat", async ({ request, variables }) => {
    const user = await resolveChatUser(request);
    if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
    const chat = await previewGetChat(variables?.id, user.id);
    return HttpResponse.json({ data: { chat } });
  }),

  gql.query("ChatMessages", async ({ request, variables }) => {
    const user = await resolveChatUser(request);
    if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
    try {
      const data = await previewListChatMessages(
        variables?.chatId,
        user.id,
        variables?.page ?? 1,
        variables?.limit ?? 20,
      );
      return HttpResponse.json({ data: { chatMessages: data } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "not found";
      return HttpResponse.json({ errors: [{ message }] });
    }
  }),

  gql.mutation("CreateChat", async ({ request, variables }) => {
    const user = await resolveChatUser(request);
    if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
    const chat = await previewCreateChat(user.id, variables?.title);
    return HttpResponse.json({ data: { createChat: chat } });
  }),

  gql.mutation("RenameChat", async ({ request, variables }) => {
    const user = await resolveChatUser(request);
    if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
    try {
      const chat = await previewRenameChat(variables?.id, user.id, variables?.title);
      return HttpResponse.json({ data: { renameChat: chat } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "rename failed";
      return HttpResponse.json({ errors: [{ message }] });
    }
  }),

  gql.mutation("DeleteChat", async ({ request, variables }) => {
    const user = await resolveChatUser(request);
    if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
    try {
      const result = await previewDeleteChat(variables?.id, user.id);
      return HttpResponse.json({ data: { deleteChat: result } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "delete failed";
      return HttpResponse.json({ errors: [{ message }] });
    }
  }),

  gql.mutation("AskChat", async ({ request, variables }) => {
    const user = await resolveChatUser(request);
    if (!user) return HttpResponse.json({ errors: [{ message: "unauthorized" }] });
    try {
      const message = await previewAskChat(variables?.chatId, user.id, variables?.query);
      return HttpResponse.json({ data: { askChat: message } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "ask failed";
      return HttpResponse.json({ errors: [{ message }] });
    }
  }),

  http.post("https://api.cloudinary.com/v1_1/:cloudName/image/upload", () =>
    HttpResponse.json({
      secure_url: `https://picsum.photos/seed/upload-${Date.now()}/1200/630`,
    }),
  ),
];

const resolveChatUser = async (request: Request): Promise<MockUser | null> => {
  const token = getToken(request);
  const previewUser = await previewGetUserFromToken(token);
  if (previewUser) return previewUser;
  if (!isPreviewEnv) {
    const users = await previewDB.getAll<MockUser>("users");
    return users[0] ?? null;
  }
  return null;
};