import { gql } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";
import { type RecommendMode } from "@/shared/graphql/content-documents";
import { postRepository } from "@/entities/post/api/postRepository";
import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";

export interface PostInteractionsController {
  liked: boolean;
  saved: boolean;
  isToggling: boolean;
  toggleLike: () => Promise<void>;
  toggleSave: () => Promise<void>;
}

const POST_INTERACTION_FRAGMENT = gql`
  fragment PostInteractionState on Post {
    likedByMe
    savedByMe
  }
`;

// usePostInteractions wires the like/save toggle buttons on post cards
// to the likePost/savePost mutations. The current state comes from the
// post query (likedByMe/savedByMe), and every toggle writes the new
// state straight into the normalized Post entity, so every list that
// shows the post updates in place. The UI flips optimistically and is
// rolled back to the previous value when the mutation fails.
//
// feedMode attributes the interaction to the recommendation feed the
// post was shown in (null when there is none); it rides along in the
// mutation so the backend can measure engagement per feed mode.
export const usePostInteractions = (
  postId: string,
  likedByMe: boolean,
  savedByMe: boolean,
  feedMode: RecommendMode | null = null,
): PostInteractionsController => {
  const client = useApolloClient();
  const { toast } = useToast();
  const [likePost, { loading: isLiking }] = postRepository.useLike();
  const [savePost, { loading: isSaving }] = postRepository.useSave();

  const getCurrentState = (): { liked: boolean; saved: boolean } => {
    const postRef = client.cache.identify({ __typename: "Post", id: postId });
    if (postRef) {
      const fragment = client.cache.readFragment<{ likedByMe: boolean; savedByMe: boolean }>({
        id: postRef,
        fragment: POST_INTERACTION_FRAGMENT,
      });
      if (fragment) return { liked: fragment.likedByMe, saved: fragment.savedByMe };
    }
    return { liked: likedByMe, saved: savedByMe };
  };

  const applyLiked = (liked: boolean) => {
    const postRef = client.cache.identify({ __typename: "Post", id: postId });
    if (!postRef) return;
    client.cache.modify({
      id: postRef,
      fields: { likedByMe: () => liked },
    });
  };

  const applySaved = (saved: boolean) => {
    const postRef = client.cache.identify({ __typename: "Post", id: postId });
    if (!postRef) return;
    client.cache.modify({
      id: postRef,
      fields: { savedByMe: () => saved },
    });
  };

  const reportError = (fallback: string) => (err: unknown) => {
    toast({
      title: "Error",
      description: getGraphQLErrorMessage(err, fallback),
      variant: "destructive",
    });
  };

  const modeVariable = feedMode ?? undefined;

  const toggleLike = async () => {
    if (isLiking || isSaving) return;
    const { liked: previous } = getCurrentState();
    applyLiked(!previous);
    try {
      const { data } = await likePost({
        variables: { postId, mode: modeVariable },
        optimisticResponse: { likePost: !previous },
      });
      applyLiked(data?.likePost ?? !previous);
    } catch (err) {
      applyLiked(previous);
      reportError("Could not update like.")(err);
    }
  };

  const toggleSave = async () => {
    if (isLiking || isSaving) return;
    const { saved: previous } = getCurrentState();
    applySaved(!previous);
    try {
      const { data } = await savePost({
        variables: { postId, mode: modeVariable },
        optimisticResponse: { savePost: !previous },
      });
      applySaved(data?.savePost ?? !previous);
    } catch (err) {
      applySaved(previous);
      reportError("Could not update save.")(err);
    }
  };

  const { liked, saved } = getCurrentState();

  return {
    liked,
    saved,
    isToggling: isLiking || isSaving,
    toggleLike,
    toggleSave,
  };
};