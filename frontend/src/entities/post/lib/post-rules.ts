import { toPlainText } from "./post-text";
import { MIN_TAG_BODY_LENGTH, MIN_TAG_TITLE_LENGTH } from "./post-text";

export interface PublishReadinessInput {
  title: string;
  body: string;
  cardImage?: File | null;
  cardImageUrl?: string | null;
  cardImagePreview?: string | null;
  tags: string[];
  isUploadingCardImage?: boolean;
  isCreatingPost?: boolean;
}

export interface PublishReadiness {
  titleReady: boolean;
  contentReady: boolean;
  imageReady: boolean;
  tagsReady: boolean;
  publishDisabled: boolean;
  publishLabel: string;
}

const PUBLISH_LABEL_IDLE = "Publish Post";
const PUBLISH_LABEL_UPLOADING = "Uploading...";
const PUBLISH_LABEL_PUBLISHING = "Publishing...";

export function evaluatePublishReadiness(
  input: PublishReadinessInput,
): PublishReadiness {
  const trimmedTitle = input.title.trim();
  const contentText = toPlainText(input.body);
  const titleReady = trimmedTitle.length > 0;
  const contentReady = contentText.length > 0;
  const imageReady = Boolean(
    input.cardImage || input.cardImageUrl || input.cardImagePreview,
  );
  const tagsReady = input.tags.length > 0;

  const publishDisabled =
    Boolean(input.isUploadingCardImage) || Boolean(input.isCreatingPost);
  const publishLabel = input.isUploadingCardImage
    ? PUBLISH_LABEL_UPLOADING
    : input.isCreatingPost
      ? PUBLISH_LABEL_PUBLISHING
      : PUBLISH_LABEL_IDLE;

  return { titleReady, contentReady, imageReady, tagsReady, publishDisabled, publishLabel };
}

export function canGenerateAiTags(title: string, body: string) {
  return (
    title.trim().length >= MIN_TAG_TITLE_LENGTH &&
    toPlainText(body).length >= MIN_TAG_BODY_LENGTH
  );
}
