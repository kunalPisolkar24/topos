import { gql } from "@apollo/client";
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
import type { PostDraft } from "./content-documents";

// TEMPORARY preview-first contract for review-gated publishing.
//
// Today the backend only offers `createPostDraft(prompt: String!)`, so
// human-authored content (title/body/tags/cover) cannot enter review.
// These documents define the shape the backend will adopt
// (`createContentDraft` + `resubmitContentDraft`, `imageUrl` on the draft).
// They live outside codegen on purpose: do NOT move them into
// `content-documents.ts` until the backend schema lands, then delete this
// file and switch imports to the generated documents.

export interface ContentDraftInput {
  title: string;
  body: string;
  summary?: string | null;
  tags?: string[] | null;
  imageUrl?: string | null;
  postId?: string | null;
}

// A draft as preview returns it: the codegen PostDraft plus the cover the
// reviewer must see. Backend adoption must include `imageUrl`.
export type PreviewPostDraft = PostDraft & {
  imageUrl: string | null;
};

export interface CreateContentDraftMutationVariables {
  input: ContentDraftInput;
}

export interface CreateContentDraftMutation {
  __typename?: "Mutation";
  createContentDraft: PreviewPostDraft;
}

export interface ResubmitContentDraftMutationVariables {
  id: string;
  input: ContentDraftInput;
}

export interface ResubmitContentDraftMutation {
  __typename?: "Mutation";
  resubmitContentDraft: PreviewPostDraft;
}

const PREVIEW_POST_DRAFT_FIELDS = gql`
  fragment PreviewPostDraftFields on PostDraft {
    id
    approvalId
    prompt
    title
    body
    summary
    tags
    status
    authorId
    postId
    createdAt
    updatedAt
    imageUrl
  }
`;

export const CreateContentDraftDocument = gql`
  mutation CreateContentDraft($input: ContentDraftInput!) {
    createContentDraft(input: $input) {
      ...PreviewPostDraftFields
    }
  }
  ${PREVIEW_POST_DRAFT_FIELDS}
` as DocumentNode<CreateContentDraftMutation, CreateContentDraftMutationVariables>;

export const ResubmitContentDraftDocument = gql`
  mutation ResubmitContentDraft($id: ID!, $input: ContentDraftInput!) {
    resubmitContentDraft(id: $id, input: $input) {
      ...PreviewPostDraftFields
    }
  }
  ${PREVIEW_POST_DRAFT_FIELDS}
` as DocumentNode<ResubmitContentDraftMutation, ResubmitContentDraftMutationVariables>;
