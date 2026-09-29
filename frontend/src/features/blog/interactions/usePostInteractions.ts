import { useApolloClient } from "@apollo/client/react";
import { type RecommendMode } from "@/shared/graphql/content-documents";
import { postRepository } from "@/entities/post/api/postRepository";
import { useAppError } from "@/shared/ui/hooks/useAppError";

export interface PostInteractionsController {
  liked: boolean;
  saved: boolean;
  isToggling: boolean;
  toggleLike: () => Promise<void>;
  toggleSave: () => Promise<void>;
}

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
  const reportError = useAppError();
  const [likePost, { loading: isLiking }] = postRepository.useLike();
  const [savePost, { loading: isSaving }] = postRepository.useSave();

  const getCurrentState = (): { liked: boolean; saved: boolean } =>
    postRepository.readInteractionState(client, postId, {
      liked: likedByMe,
      saved: savedByMe,
    });

  const applyLiked = (liked: boolean) =>
    postRepository.writeLikedState(client, postId, liked);

  const applySaved = (saved: boolean) =>
    postRepository.writeSavedState(client, postId, saved);



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
      reportError(err, "Could not update like.");
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
      reportError(err, "Could not update save.");
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