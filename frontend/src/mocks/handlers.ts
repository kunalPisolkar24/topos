import { HttpResponse, graphql, http } from "msw";
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
} from "./data";

const gql = graphql.link("http://localhost:4000/graphql");

const isAuthenticated = (request: Request) =>
  request.headers.get("authorization") !== null;

const me = () => {
  const user = getSignedInUser();
  return user ? toUserResponse(user) : null;
};

export const handlers = [
  gql.query("Me", ({ request }) =>
    HttpResponse.json({
      data: { me: isAuthenticated(request) ? me() : null },
    }),
  ),

  gql.mutation("Signin", () =>
    HttpResponse.json({
      data: { signin: authenticate() },
    }),
  ),

  gql.mutation("Signup", () =>
    HttpResponse.json({
      data: { signup: authenticate() },
    }),
  ),

  gql.mutation("UpdateProfile", ({ variables }) =>
    HttpResponse.json({
      data: {
        updateProfile: updateProfile({
          name: variables?.name,
          bio: variables?.bio,
          avatarUrl: variables?.avatarUrl,
          bannerUrl: variables?.bannerUrl,
        }),
      },
    }),
  ),

  gql.query("Posts", ({ variables }) =>
    HttpResponse.json({
      data: { posts: listPosts(variables?.page ?? 1, variables?.limit ?? 6) },
    }),
  ),

  gql.query("PostsByTag", ({ variables }) =>
    HttpResponse.json({
      data: {
        postsByTag: listPostsByTag(
          variables?.tag,
          variables?.page ?? 1,
          variables?.limit ?? 6,
        ),
      },
    }),
  ),

  gql.query("Post", ({ variables }) =>
    HttpResponse.json({
      data: { post: getPost(variables?.id) },
    }),
  ),

  gql.query("Tags", ({ variables }) =>
    HttpResponse.json({
      data: { tags: listTags(variables?.query ?? "", variables?.limit ?? 6) },
    }),
  ),

  gql.query("MyPosts", ({ request, variables }) =>
    HttpResponse.json({
      data: {
        me: isAuthenticated(request)
          ? {
              __typename: "User",
              id: me()?.id,
              posts: listPosts(variables?.page ?? 1, variables?.limit ?? 6),
            }
          : null,
      },
    }),
  ),

  gql.query("SearchPosts", ({ variables }) =>
    HttpResponse.json({
      data: {
        searchPosts: searchPosts(
          variables?.query,
          variables?.page ?? 1,
          variables?.limit ?? 6,
        ),
      },
    }),
  ),

  gql.query("RecommendedPosts", ({ request, variables }) =>
    HttpResponse.json(
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
    ),
  ),

  gql.mutation("CreatePost", ({ variables }) =>
    HttpResponse.json({
      data: { createPost: createPost(variables?.input) },
    }),
  ),

  gql.mutation("UpdatePost", ({ variables }) =>
    HttpResponse.json({
      data: { updatePost: updatePost(variables?.id, variables?.input) },
    }),
  ),

  gql.mutation("DeletePost", ({ variables }) =>
    HttpResponse.json({
      data: { deletePost: deletePost(variables?.id) },
    }),
  ),

  gql.mutation("RecordPostView", () =>
    HttpResponse.json({
      data: { recordPostView: recordPostView() },
    }),
  ),

  gql.mutation("LikePost", ({ variables }) =>
    HttpResponse.json({
      data: { likePost: togglePostLike(variables?.postId) },
    }),
  ),

  gql.mutation("SavePost", ({ variables }) =>
    HttpResponse.json({
      data: { savePost: togglePostSave(variables?.postId) },
    }),
  ),

  gql.mutation("GenerateTags", ({ variables }) =>
    HttpResponse.json({
      data: { generateTags: generateTags(variables?.title, variables?.body) },
    }),
  ),

  gql.mutation("GeneratePostContent", ({ variables }) =>
    HttpResponse.json({
      data: { generatePostContent: generatePostContent(variables?.prompt) },
    }),
  ),

  gql.query("PostDrafts", ({ variables }) =>
    HttpResponse.json({
      data: { postDrafts: listPostDrafts(variables?.page ?? 1, variables?.limit ?? 6) },
    }),
  ),

  gql.query("MyPostDrafts", ({ variables }) =>
    HttpResponse.json({
      data: { myPostDrafts: listMyPostDrafts(variables?.page ?? 1, variables?.limit ?? 6) },
    }),
  ),

  gql.mutation("CreatePostDraft", ({ variables }) =>
    HttpResponse.json({
      data: { createPostDraft: createPostDraft(variables?.prompt) },
    }),
  ),

  gql.mutation("ApprovePostDraft", ({ variables }) =>
    HttpResponse.json({
      data: { approvePostDraft: approvePostDraft(variables?.id, variables?.input) },
    }),
  ),

  gql.mutation("RejectPostDraft", ({ variables }) =>
    HttpResponse.json({
      data: { rejectPostDraft: rejectPostDraft(variables?.id) },
    }),
  ),

  gql.mutation("DeletePostDraft", ({ variables }) =>
    HttpResponse.json({
      data: { deletePostDraft: deletePostDraft(variables?.id) },
    }),
  ),

  http.post("https://api.cloudinary.com/v1_1/:cloudName/image/upload", () =>
    HttpResponse.json({
      secure_url: `https://picsum.photos/seed/upload-${Date.now()}/1200/630`,
    }),
  ),
];