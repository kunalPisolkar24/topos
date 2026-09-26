/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment ChatFields on Chat {\n    id\n    title\n    createdAt\n    updatedAt\n  }\n": typeof types.ChatFieldsFragmentDoc,
    "\n  fragment ChatMessageFields on ChatMessage {\n    id\n    chatId\n    role\n    content\n    citedPostIds\n    createdAt\n  }\n": typeof types.ChatMessageFieldsFragmentDoc,
    "\n  query Chats($page: Int, $limit: Int) {\n    chats(page: $page, limit: $limit) {\n      chats {\n        ...ChatFields\n      }\n      totalPages\n      currentPage\n      totalChats\n    }\n  }\n  \n": typeof types.ChatsDocument,
    "\n  query Chat($id: ID!) {\n    chat(id: $id) {\n      ...ChatFields\n    }\n  }\n  \n": typeof types.ChatDocument,
    "\n  query ChatMessages($chatId: ID!, $page: Int, $limit: Int) {\n    chatMessages(chatId: $chatId, page: $page, limit: $limit) {\n      messages {\n        ...ChatMessageFields\n      }\n      totalPages\n      currentPage\n      totalMessages\n    }\n  }\n  \n": typeof types.ChatMessagesDocument,
    "\n  mutation CreateChat($title: String) {\n    createChat(title: $title) {\n      ...ChatFields\n    }\n  }\n  \n": typeof types.CreateChatDocument,
    "\n  mutation RenameChat($id: ID!, $title: String!) {\n    renameChat(id: $id, title: $title) {\n      ...ChatFields\n    }\n  }\n  \n": typeof types.RenameChatDocument,
    "\n  mutation DeleteChat($id: ID!) {\n    deleteChat(id: $id)\n  }\n": typeof types.DeleteChatDocument,
    "\n  mutation AskChat($chatId: ID!, $query: String!) {\n    askChat(chatId: $chatId, query: $query) {\n      ...ChatMessageFields\n    }\n  }\n  \n": typeof types.AskChatDocument,
    "\n  fragment PostDraftStatus on PostDraft {\n    status\n  }\n": typeof types.PostDraftStatusFragmentDoc,
    "\n  fragment PostInteractionState on Post {\n    likedByMe\n    savedByMe\n  }\n": typeof types.PostInteractionStateFragmentDoc,
    "\n  query ForceNetwork {\n    __typename\n    posts {\n      posts {\n        id\n      }\n    }\n  }\n": typeof types.ForceNetworkDocument,
    "\n  fragment PostCardFields on Post {\n    id\n    title\n    body\n    imageUrl\n    createdAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    tags {\n      id\n      name\n    }\n  }\n": typeof types.PostCardFieldsFragmentDoc,
    "\n  fragment PostDetailFields on Post {\n    id\n    title\n    body\n    slug\n    imageUrl\n    summary\n    summaryStatus\n    createdAt\n    updatedAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      email\n      name\n      bio\n      avatarUrl\n    }\n    approvedById\n    tags {\n      id\n      name\n    }\n    related {\n      ...PostCardFields\n    }\n  }\n  \n": typeof types.PostDetailFieldsFragmentDoc,
    "\n  fragment PaginatedPostFields on PaginatedPosts {\n    posts {\n      ...PostCardFields\n    }\n    totalPages\n    currentPage\n    totalPosts\n  }\n  \n": typeof types.PaginatedPostFieldsFragmentDoc,
    "\n  query Posts($page: Int, $limit: Int) {\n    posts(page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n": typeof types.PostsDocument,
    "\n  query PostsByTag($tag: String!, $page: Int, $limit: Int) {\n    postsByTag(tag: $tag, page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n": typeof types.PostsByTagDocument,
    "\n  query Post($id: ID!) {\n    post(id: $id) {\n      ...PostDetailFields\n    }\n  }\n  \n": typeof types.PostDocument,
    "\n  query Tags($query: String, $limit: Int) {\n    tags(query: $query, limit: $limit) {\n      id\n      name\n    }\n  }\n": typeof types.TagsDocument,
    "\n  mutation CreatePost($input: CreatePostInput!) {\n    createPost(input: $input) {\n      id\n    }\n  }\n": typeof types.CreatePostDocument,
    "\n  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {\n    updatePost(id: $id, input: $input) {\n      ...PostDetailFields\n    }\n  }\n  \n": typeof types.UpdatePostDocument,
    "\n  mutation DeletePost($id: ID!) {\n    deletePost(id: $id)\n  }\n": typeof types.DeletePostDocument,
    "\n  mutation RecordPostView($postId: ID!, $mode: RecommendMode) {\n    recordPostView(postId: $postId, mode: $mode)\n  }\n": typeof types.RecordPostViewDocument,
    "\n  mutation LikePost($postId: ID!, $mode: RecommendMode) {\n    likePost(postId: $postId, mode: $mode)\n  }\n": typeof types.LikePostDocument,
    "\n  mutation SavePost($postId: ID!, $mode: RecommendMode) {\n    savePost(postId: $postId, mode: $mode)\n  }\n": typeof types.SavePostDocument,
    "\n  mutation GenerateTags($title: String!, $body: String!) {\n    generateTags(title: $title, body: $body)\n  }\n": typeof types.GenerateTagsDocument,
    "\n  mutation GeneratePostContent($prompt: String!) {\n    generatePostContent(prompt: $prompt) {\n      title\n      body\n      summary\n      tags\n    }\n  }\n": typeof types.GeneratePostContentDocument,
    "\n  query MyPosts($page: Int, $limit: Int) {\n    me {\n      id\n      posts(page: $page, limit: $limit) {\n        ...PaginatedPostFields\n      }\n    }\n  }\n  \n": typeof types.MyPostsDocument,
    "\n  query SearchPosts($query: String!, $page: Int, $limit: Int) {\n    searchPosts(query: $query, page: $page, limit: $limit) {\n      hits {\n        ...PostCardFields\n      }\n      total\n    }\n  }\n  \n": typeof types.SearchPostsDocument,
    "\n  query RecommendedPosts(\n    $page: Int\n    $limit: Int\n    $mode: RecommendMode\n    $seed: Int\n  ) {\n    recommendedPosts(page: $page, limit: $limit, mode: $mode, seed: $seed) {\n      ...PaginatedPostFields\n      reasons {\n        postId\n        reason\n      }\n    }\n  }\n  \n": typeof types.RecommendedPostsDocument,
    "\n  fragment PostDraftFields on PostDraft {\n    id\n    approvalId\n    prompt\n    title\n    body\n    summary\n    tags\n    imageUrl\n    status\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    authorId\n    postId\n    reviewedById\n    reviewedAt\n    rejectionNote\n    createdAt\n    updatedAt\n  }\n": typeof types.PostDraftFieldsFragmentDoc,
    "\n  fragment PaginatedPostDraftFields on PaginatedPostDrafts {\n    drafts {\n      ...PostDraftFields\n    }\n    totalPages\n    currentPage\n    totalDrafts\n  }\n  \n": typeof types.PaginatedPostDraftFieldsFragmentDoc,
    "\n  query PostDrafts($page: Int, $limit: Int) {\n    postDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n": typeof types.PostDraftsDocument,
    "\n  query MyPostDrafts($page: Int, $limit: Int) {\n    myPostDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n": typeof types.MyPostDraftsDocument,
    "\n  mutation CreatePostDraft($prompt: String!) {\n    createPostDraft(prompt: $prompt) {\n      ...PostDraftFields\n    }\n  }\n  \n": typeof types.CreatePostDraftDocument,
    "\n  mutation ApprovePostDraft($id: ID!, $input: DraftEditsInput) {\n    approvePostDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n": typeof types.ApprovePostDraftDocument,
    "\n  mutation RejectPostDraft($id: ID!, $reason: String) {\n    rejectPostDraft(id: $id, reason: $reason) {\n      ...PostDraftFields\n    }\n  }\n  \n": typeof types.RejectPostDraftDocument,
    "\n  mutation DeletePostDraft($id: ID!) {\n    deletePostDraft(id: $id)\n  }\n": typeof types.DeletePostDraftDocument,
    "\n  mutation CreateContentDraft($input: ContentDraftInput!) {\n    createContentDraft(input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n": typeof types.CreateContentDraftDocument,
    "\n  mutation ResubmitContentDraft($id: ID!, $input: ContentDraftInput!) {\n    resubmitContentDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n": typeof types.ResubmitContentDraftDocument,
    "fragment UserCore on User {\n  id\n  username\n  email\n  name\n  bio\n  avatarUrl\n  bannerUrl\n  createdAt\n}": typeof types.UserCoreFragmentDoc,
    "query Me {\n  me {\n    ...UserCore\n  }\n}": typeof types.MeDocument,
    "mutation Signin($email: String!, $password: String!) {\n  signin(email: $email, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}": typeof types.SigninDocument,
    "mutation Signup($email: String!, $username: String!, $password: String!) {\n  signup(email: $email, username: $username, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}": typeof types.SignupDocument,
    "mutation UpdateProfile($username: String, $name: String, $bio: String, $avatarUrl: String, $bannerUrl: String) {\n  updateProfile(\n    username: $username\n    name: $name\n    bio: $bio\n    avatarUrl: $avatarUrl\n    bannerUrl: $bannerUrl\n  ) {\n    ...UserCore\n  }\n}": typeof types.UpdateProfileDocument,
    "query User($id: ID!) {\n  user(id: $id) {\n    ...UserCore\n  }\n}": typeof types.UserDocument,
};
const documents: Documents = {
    "\n  fragment ChatFields on Chat {\n    id\n    title\n    createdAt\n    updatedAt\n  }\n": types.ChatFieldsFragmentDoc,
    "\n  fragment ChatMessageFields on ChatMessage {\n    id\n    chatId\n    role\n    content\n    citedPostIds\n    createdAt\n  }\n": types.ChatMessageFieldsFragmentDoc,
    "\n  query Chats($page: Int, $limit: Int) {\n    chats(page: $page, limit: $limit) {\n      chats {\n        ...ChatFields\n      }\n      totalPages\n      currentPage\n      totalChats\n    }\n  }\n  \n": types.ChatsDocument,
    "\n  query Chat($id: ID!) {\n    chat(id: $id) {\n      ...ChatFields\n    }\n  }\n  \n": types.ChatDocument,
    "\n  query ChatMessages($chatId: ID!, $page: Int, $limit: Int) {\n    chatMessages(chatId: $chatId, page: $page, limit: $limit) {\n      messages {\n        ...ChatMessageFields\n      }\n      totalPages\n      currentPage\n      totalMessages\n    }\n  }\n  \n": types.ChatMessagesDocument,
    "\n  mutation CreateChat($title: String) {\n    createChat(title: $title) {\n      ...ChatFields\n    }\n  }\n  \n": types.CreateChatDocument,
    "\n  mutation RenameChat($id: ID!, $title: String!) {\n    renameChat(id: $id, title: $title) {\n      ...ChatFields\n    }\n  }\n  \n": types.RenameChatDocument,
    "\n  mutation DeleteChat($id: ID!) {\n    deleteChat(id: $id)\n  }\n": types.DeleteChatDocument,
    "\n  mutation AskChat($chatId: ID!, $query: String!) {\n    askChat(chatId: $chatId, query: $query) {\n      ...ChatMessageFields\n    }\n  }\n  \n": types.AskChatDocument,
    "\n  fragment PostDraftStatus on PostDraft {\n    status\n  }\n": types.PostDraftStatusFragmentDoc,
    "\n  fragment PostInteractionState on Post {\n    likedByMe\n    savedByMe\n  }\n": types.PostInteractionStateFragmentDoc,
    "\n  query ForceNetwork {\n    __typename\n    posts {\n      posts {\n        id\n      }\n    }\n  }\n": types.ForceNetworkDocument,
    "\n  fragment PostCardFields on Post {\n    id\n    title\n    body\n    imageUrl\n    createdAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    tags {\n      id\n      name\n    }\n  }\n": types.PostCardFieldsFragmentDoc,
    "\n  fragment PostDetailFields on Post {\n    id\n    title\n    body\n    slug\n    imageUrl\n    summary\n    summaryStatus\n    createdAt\n    updatedAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      email\n      name\n      bio\n      avatarUrl\n    }\n    approvedById\n    tags {\n      id\n      name\n    }\n    related {\n      ...PostCardFields\n    }\n  }\n  \n": types.PostDetailFieldsFragmentDoc,
    "\n  fragment PaginatedPostFields on PaginatedPosts {\n    posts {\n      ...PostCardFields\n    }\n    totalPages\n    currentPage\n    totalPosts\n  }\n  \n": types.PaginatedPostFieldsFragmentDoc,
    "\n  query Posts($page: Int, $limit: Int) {\n    posts(page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n": types.PostsDocument,
    "\n  query PostsByTag($tag: String!, $page: Int, $limit: Int) {\n    postsByTag(tag: $tag, page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n": types.PostsByTagDocument,
    "\n  query Post($id: ID!) {\n    post(id: $id) {\n      ...PostDetailFields\n    }\n  }\n  \n": types.PostDocument,
    "\n  query Tags($query: String, $limit: Int) {\n    tags(query: $query, limit: $limit) {\n      id\n      name\n    }\n  }\n": types.TagsDocument,
    "\n  mutation CreatePost($input: CreatePostInput!) {\n    createPost(input: $input) {\n      id\n    }\n  }\n": types.CreatePostDocument,
    "\n  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {\n    updatePost(id: $id, input: $input) {\n      ...PostDetailFields\n    }\n  }\n  \n": types.UpdatePostDocument,
    "\n  mutation DeletePost($id: ID!) {\n    deletePost(id: $id)\n  }\n": types.DeletePostDocument,
    "\n  mutation RecordPostView($postId: ID!, $mode: RecommendMode) {\n    recordPostView(postId: $postId, mode: $mode)\n  }\n": types.RecordPostViewDocument,
    "\n  mutation LikePost($postId: ID!, $mode: RecommendMode) {\n    likePost(postId: $postId, mode: $mode)\n  }\n": types.LikePostDocument,
    "\n  mutation SavePost($postId: ID!, $mode: RecommendMode) {\n    savePost(postId: $postId, mode: $mode)\n  }\n": types.SavePostDocument,
    "\n  mutation GenerateTags($title: String!, $body: String!) {\n    generateTags(title: $title, body: $body)\n  }\n": types.GenerateTagsDocument,
    "\n  mutation GeneratePostContent($prompt: String!) {\n    generatePostContent(prompt: $prompt) {\n      title\n      body\n      summary\n      tags\n    }\n  }\n": types.GeneratePostContentDocument,
    "\n  query MyPosts($page: Int, $limit: Int) {\n    me {\n      id\n      posts(page: $page, limit: $limit) {\n        ...PaginatedPostFields\n      }\n    }\n  }\n  \n": types.MyPostsDocument,
    "\n  query SearchPosts($query: String!, $page: Int, $limit: Int) {\n    searchPosts(query: $query, page: $page, limit: $limit) {\n      hits {\n        ...PostCardFields\n      }\n      total\n    }\n  }\n  \n": types.SearchPostsDocument,
    "\n  query RecommendedPosts(\n    $page: Int\n    $limit: Int\n    $mode: RecommendMode\n    $seed: Int\n  ) {\n    recommendedPosts(page: $page, limit: $limit, mode: $mode, seed: $seed) {\n      ...PaginatedPostFields\n      reasons {\n        postId\n        reason\n      }\n    }\n  }\n  \n": types.RecommendedPostsDocument,
    "\n  fragment PostDraftFields on PostDraft {\n    id\n    approvalId\n    prompt\n    title\n    body\n    summary\n    tags\n    imageUrl\n    status\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    authorId\n    postId\n    reviewedById\n    reviewedAt\n    rejectionNote\n    createdAt\n    updatedAt\n  }\n": types.PostDraftFieldsFragmentDoc,
    "\n  fragment PaginatedPostDraftFields on PaginatedPostDrafts {\n    drafts {\n      ...PostDraftFields\n    }\n    totalPages\n    currentPage\n    totalDrafts\n  }\n  \n": types.PaginatedPostDraftFieldsFragmentDoc,
    "\n  query PostDrafts($page: Int, $limit: Int) {\n    postDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n": types.PostDraftsDocument,
    "\n  query MyPostDrafts($page: Int, $limit: Int) {\n    myPostDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n": types.MyPostDraftsDocument,
    "\n  mutation CreatePostDraft($prompt: String!) {\n    createPostDraft(prompt: $prompt) {\n      ...PostDraftFields\n    }\n  }\n  \n": types.CreatePostDraftDocument,
    "\n  mutation ApprovePostDraft($id: ID!, $input: DraftEditsInput) {\n    approvePostDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n": types.ApprovePostDraftDocument,
    "\n  mutation RejectPostDraft($id: ID!, $reason: String) {\n    rejectPostDraft(id: $id, reason: $reason) {\n      ...PostDraftFields\n    }\n  }\n  \n": types.RejectPostDraftDocument,
    "\n  mutation DeletePostDraft($id: ID!) {\n    deletePostDraft(id: $id)\n  }\n": types.DeletePostDraftDocument,
    "\n  mutation CreateContentDraft($input: ContentDraftInput!) {\n    createContentDraft(input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n": types.CreateContentDraftDocument,
    "\n  mutation ResubmitContentDraft($id: ID!, $input: ContentDraftInput!) {\n    resubmitContentDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n": types.ResubmitContentDraftDocument,
    "fragment UserCore on User {\n  id\n  username\n  email\n  name\n  bio\n  avatarUrl\n  bannerUrl\n  createdAt\n}": types.UserCoreFragmentDoc,
    "query Me {\n  me {\n    ...UserCore\n  }\n}": types.MeDocument,
    "mutation Signin($email: String!, $password: String!) {\n  signin(email: $email, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}": types.SigninDocument,
    "mutation Signup($email: String!, $username: String!, $password: String!) {\n  signup(email: $email, username: $username, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}": types.SignupDocument,
    "mutation UpdateProfile($username: String, $name: String, $bio: String, $avatarUrl: String, $bannerUrl: String) {\n  updateProfile(\n    username: $username\n    name: $name\n    bio: $bio\n    avatarUrl: $avatarUrl\n    bannerUrl: $bannerUrl\n  ) {\n    ...UserCore\n  }\n}": types.UpdateProfileDocument,
    "query User($id: ID!) {\n  user(id: $id) {\n    ...UserCore\n  }\n}": types.UserDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ChatFields on Chat {\n    id\n    title\n    createdAt\n    updatedAt\n  }\n"): (typeof documents)["\n  fragment ChatFields on Chat {\n    id\n    title\n    createdAt\n    updatedAt\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ChatMessageFields on ChatMessage {\n    id\n    chatId\n    role\n    content\n    citedPostIds\n    createdAt\n  }\n"): (typeof documents)["\n  fragment ChatMessageFields on ChatMessage {\n    id\n    chatId\n    role\n    content\n    citedPostIds\n    createdAt\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Chats($page: Int, $limit: Int) {\n    chats(page: $page, limit: $limit) {\n      chats {\n        ...ChatFields\n      }\n      totalPages\n      currentPage\n      totalChats\n    }\n  }\n  \n"): (typeof documents)["\n  query Chats($page: Int, $limit: Int) {\n    chats(page: $page, limit: $limit) {\n      chats {\n        ...ChatFields\n      }\n      totalPages\n      currentPage\n      totalChats\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Chat($id: ID!) {\n    chat(id: $id) {\n      ...ChatFields\n    }\n  }\n  \n"): (typeof documents)["\n  query Chat($id: ID!) {\n    chat(id: $id) {\n      ...ChatFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ChatMessages($chatId: ID!, $page: Int, $limit: Int) {\n    chatMessages(chatId: $chatId, page: $page, limit: $limit) {\n      messages {\n        ...ChatMessageFields\n      }\n      totalPages\n      currentPage\n      totalMessages\n    }\n  }\n  \n"): (typeof documents)["\n  query ChatMessages($chatId: ID!, $page: Int, $limit: Int) {\n    chatMessages(chatId: $chatId, page: $page, limit: $limit) {\n      messages {\n        ...ChatMessageFields\n      }\n      totalPages\n      currentPage\n      totalMessages\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateChat($title: String) {\n    createChat(title: $title) {\n      ...ChatFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation CreateChat($title: String) {\n    createChat(title: $title) {\n      ...ChatFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RenameChat($id: ID!, $title: String!) {\n    renameChat(id: $id, title: $title) {\n      ...ChatFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation RenameChat($id: ID!, $title: String!) {\n    renameChat(id: $id, title: $title) {\n      ...ChatFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteChat($id: ID!) {\n    deleteChat(id: $id)\n  }\n"): (typeof documents)["\n  mutation DeleteChat($id: ID!) {\n    deleteChat(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AskChat($chatId: ID!, $query: String!) {\n    askChat(chatId: $chatId, query: $query) {\n      ...ChatMessageFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation AskChat($chatId: ID!, $query: String!) {\n    askChat(chatId: $chatId, query: $query) {\n      ...ChatMessageFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment PostDraftStatus on PostDraft {\n    status\n  }\n"): (typeof documents)["\n  fragment PostDraftStatus on PostDraft {\n    status\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment PostInteractionState on Post {\n    likedByMe\n    savedByMe\n  }\n"): (typeof documents)["\n  fragment PostInteractionState on Post {\n    likedByMe\n    savedByMe\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ForceNetwork {\n    __typename\n    posts {\n      posts {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  query ForceNetwork {\n    __typename\n    posts {\n      posts {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment PostCardFields on Post {\n    id\n    title\n    body\n    imageUrl\n    createdAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    tags {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  fragment PostCardFields on Post {\n    id\n    title\n    body\n    imageUrl\n    createdAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    tags {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment PostDetailFields on Post {\n    id\n    title\n    body\n    slug\n    imageUrl\n    summary\n    summaryStatus\n    createdAt\n    updatedAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      email\n      name\n      bio\n      avatarUrl\n    }\n    approvedById\n    tags {\n      id\n      name\n    }\n    related {\n      ...PostCardFields\n    }\n  }\n  \n"): (typeof documents)["\n  fragment PostDetailFields on Post {\n    id\n    title\n    body\n    slug\n    imageUrl\n    summary\n    summaryStatus\n    createdAt\n    updatedAt\n    likedByMe\n    savedByMe\n    author {\n      id\n      username\n      email\n      name\n      bio\n      avatarUrl\n    }\n    approvedById\n    tags {\n      id\n      name\n    }\n    related {\n      ...PostCardFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment PaginatedPostFields on PaginatedPosts {\n    posts {\n      ...PostCardFields\n    }\n    totalPages\n    currentPage\n    totalPosts\n  }\n  \n"): (typeof documents)["\n  fragment PaginatedPostFields on PaginatedPosts {\n    posts {\n      ...PostCardFields\n    }\n    totalPages\n    currentPage\n    totalPosts\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Posts($page: Int, $limit: Int) {\n    posts(page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n"): (typeof documents)["\n  query Posts($page: Int, $limit: Int) {\n    posts(page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PostsByTag($tag: String!, $page: Int, $limit: Int) {\n    postsByTag(tag: $tag, page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n"): (typeof documents)["\n  query PostsByTag($tag: String!, $page: Int, $limit: Int) {\n    postsByTag(tag: $tag, page: $page, limit: $limit) {\n      ...PaginatedPostFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Post($id: ID!) {\n    post(id: $id) {\n      ...PostDetailFields\n    }\n  }\n  \n"): (typeof documents)["\n  query Post($id: ID!) {\n    post(id: $id) {\n      ...PostDetailFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Tags($query: String, $limit: Int) {\n    tags(query: $query, limit: $limit) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query Tags($query: String, $limit: Int) {\n    tags(query: $query, limit: $limit) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreatePost($input: CreatePostInput!) {\n    createPost(input: $input) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation CreatePost($input: CreatePostInput!) {\n    createPost(input: $input) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {\n    updatePost(id: $id, input: $input) {\n      ...PostDetailFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {\n    updatePost(id: $id, input: $input) {\n      ...PostDetailFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeletePost($id: ID!) {\n    deletePost(id: $id)\n  }\n"): (typeof documents)["\n  mutation DeletePost($id: ID!) {\n    deletePost(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RecordPostView($postId: ID!, $mode: RecommendMode) {\n    recordPostView(postId: $postId, mode: $mode)\n  }\n"): (typeof documents)["\n  mutation RecordPostView($postId: ID!, $mode: RecommendMode) {\n    recordPostView(postId: $postId, mode: $mode)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation LikePost($postId: ID!, $mode: RecommendMode) {\n    likePost(postId: $postId, mode: $mode)\n  }\n"): (typeof documents)["\n  mutation LikePost($postId: ID!, $mode: RecommendMode) {\n    likePost(postId: $postId, mode: $mode)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SavePost($postId: ID!, $mode: RecommendMode) {\n    savePost(postId: $postId, mode: $mode)\n  }\n"): (typeof documents)["\n  mutation SavePost($postId: ID!, $mode: RecommendMode) {\n    savePost(postId: $postId, mode: $mode)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation GenerateTags($title: String!, $body: String!) {\n    generateTags(title: $title, body: $body)\n  }\n"): (typeof documents)["\n  mutation GenerateTags($title: String!, $body: String!) {\n    generateTags(title: $title, body: $body)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation GeneratePostContent($prompt: String!) {\n    generatePostContent(prompt: $prompt) {\n      title\n      body\n      summary\n      tags\n    }\n  }\n"): (typeof documents)["\n  mutation GeneratePostContent($prompt: String!) {\n    generatePostContent(prompt: $prompt) {\n      title\n      body\n      summary\n      tags\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyPosts($page: Int, $limit: Int) {\n    me {\n      id\n      posts(page: $page, limit: $limit) {\n        ...PaginatedPostFields\n      }\n    }\n  }\n  \n"): (typeof documents)["\n  query MyPosts($page: Int, $limit: Int) {\n    me {\n      id\n      posts(page: $page, limit: $limit) {\n        ...PaginatedPostFields\n      }\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SearchPosts($query: String!, $page: Int, $limit: Int) {\n    searchPosts(query: $query, page: $page, limit: $limit) {\n      hits {\n        ...PostCardFields\n      }\n      total\n    }\n  }\n  \n"): (typeof documents)["\n  query SearchPosts($query: String!, $page: Int, $limit: Int) {\n    searchPosts(query: $query, page: $page, limit: $limit) {\n      hits {\n        ...PostCardFields\n      }\n      total\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query RecommendedPosts(\n    $page: Int\n    $limit: Int\n    $mode: RecommendMode\n    $seed: Int\n  ) {\n    recommendedPosts(page: $page, limit: $limit, mode: $mode, seed: $seed) {\n      ...PaginatedPostFields\n      reasons {\n        postId\n        reason\n      }\n    }\n  }\n  \n"): (typeof documents)["\n  query RecommendedPosts(\n    $page: Int\n    $limit: Int\n    $mode: RecommendMode\n    $seed: Int\n  ) {\n    recommendedPosts(page: $page, limit: $limit, mode: $mode, seed: $seed) {\n      ...PaginatedPostFields\n      reasons {\n        postId\n        reason\n      }\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment PostDraftFields on PostDraft {\n    id\n    approvalId\n    prompt\n    title\n    body\n    summary\n    tags\n    imageUrl\n    status\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    authorId\n    postId\n    reviewedById\n    reviewedAt\n    rejectionNote\n    createdAt\n    updatedAt\n  }\n"): (typeof documents)["\n  fragment PostDraftFields on PostDraft {\n    id\n    approvalId\n    prompt\n    title\n    body\n    summary\n    tags\n    imageUrl\n    status\n    author {\n      id\n      username\n      name\n      avatarUrl\n    }\n    authorId\n    postId\n    reviewedById\n    reviewedAt\n    rejectionNote\n    createdAt\n    updatedAt\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment PaginatedPostDraftFields on PaginatedPostDrafts {\n    drafts {\n      ...PostDraftFields\n    }\n    totalPages\n    currentPage\n    totalDrafts\n  }\n  \n"): (typeof documents)["\n  fragment PaginatedPostDraftFields on PaginatedPostDrafts {\n    drafts {\n      ...PostDraftFields\n    }\n    totalPages\n    currentPage\n    totalDrafts\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PostDrafts($page: Int, $limit: Int) {\n    postDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n"): (typeof documents)["\n  query PostDrafts($page: Int, $limit: Int) {\n    postDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyPostDrafts($page: Int, $limit: Int) {\n    myPostDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n"): (typeof documents)["\n  query MyPostDrafts($page: Int, $limit: Int) {\n    myPostDrafts(page: $page, limit: $limit) {\n      ...PaginatedPostDraftFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreatePostDraft($prompt: String!) {\n    createPostDraft(prompt: $prompt) {\n      ...PostDraftFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation CreatePostDraft($prompt: String!) {\n    createPostDraft(prompt: $prompt) {\n      ...PostDraftFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ApprovePostDraft($id: ID!, $input: DraftEditsInput) {\n    approvePostDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation ApprovePostDraft($id: ID!, $input: DraftEditsInput) {\n    approvePostDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RejectPostDraft($id: ID!, $reason: String) {\n    rejectPostDraft(id: $id, reason: $reason) {\n      ...PostDraftFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation RejectPostDraft($id: ID!, $reason: String) {\n    rejectPostDraft(id: $id, reason: $reason) {\n      ...PostDraftFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeletePostDraft($id: ID!) {\n    deletePostDraft(id: $id)\n  }\n"): (typeof documents)["\n  mutation DeletePostDraft($id: ID!) {\n    deletePostDraft(id: $id)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateContentDraft($input: ContentDraftInput!) {\n    createContentDraft(input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation CreateContentDraft($input: ContentDraftInput!) {\n    createContentDraft(input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResubmitContentDraft($id: ID!, $input: ContentDraftInput!) {\n    resubmitContentDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n"): (typeof documents)["\n  mutation ResubmitContentDraft($id: ID!, $input: ContentDraftInput!) {\n    resubmitContentDraft(id: $id, input: $input) {\n      ...PostDraftFields\n    }\n  }\n  \n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "fragment UserCore on User {\n  id\n  username\n  email\n  name\n  bio\n  avatarUrl\n  bannerUrl\n  createdAt\n}"): (typeof documents)["fragment UserCore on User {\n  id\n  username\n  email\n  name\n  bio\n  avatarUrl\n  bannerUrl\n  createdAt\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me {\n  me {\n    ...UserCore\n  }\n}"): (typeof documents)["query Me {\n  me {\n    ...UserCore\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation Signin($email: String!, $password: String!) {\n  signin(email: $email, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}"): (typeof documents)["mutation Signin($email: String!, $password: String!) {\n  signin(email: $email, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation Signup($email: String!, $username: String!, $password: String!) {\n  signup(email: $email, username: $username, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}"): (typeof documents)["mutation Signup($email: String!, $username: String!, $password: String!) {\n  signup(email: $email, username: $username, password: $password) {\n    token\n    user {\n      ...UserCore\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "mutation UpdateProfile($username: String, $name: String, $bio: String, $avatarUrl: String, $bannerUrl: String) {\n  updateProfile(\n    username: $username\n    name: $name\n    bio: $bio\n    avatarUrl: $avatarUrl\n    bannerUrl: $bannerUrl\n  ) {\n    ...UserCore\n  }\n}"): (typeof documents)["mutation UpdateProfile($username: String, $name: String, $bio: String, $avatarUrl: String, $bannerUrl: String) {\n  updateProfile(\n    username: $username\n    name: $name\n    bio: $bio\n    avatarUrl: $avatarUrl\n    bannerUrl: $bannerUrl\n  ) {\n    ...UserCore\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query User($id: ID!) {\n  user(id: $id) {\n    ...UserCore\n  }\n}"): (typeof documents)["query User($id: ID!) {\n  user(id: $id) {\n    ...UserCore\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;