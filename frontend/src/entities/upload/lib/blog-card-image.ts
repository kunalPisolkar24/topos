const CLOUDINARY_UPLOAD_PATH = "/image/upload/";

const BLOG_CARD_IMAGE_VARIANTS = [
  { width: 480, height: 300 },
  { width: 720, height: 450 },
  { width: 960, height: 600 },
] as const;

const DEFAULT_BLOG_CARD_IMAGE_VARIANT = BLOG_CARD_IMAGE_VARIANTS[1];

const BLOG_CARD_IMAGE_SIZES =
  "(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) 38vw, 360px";

type CloudinaryDeliverySize = {
  width: number;
  height: number;
};

export type ResponsiveImageSources = {
  src: string;
  srcSet?: string;
  sizes: string;
  width: number;
  height: number;
};

const isCloudinaryUploadUrl = (imageUrl: string) => {
  try {
    const parsedUrl = new URL(imageUrl);
    return (
      /(^|\.)res\.cloudinary\.com$/i.test(parsedUrl.hostname) &&
      parsedUrl.pathname.includes(CLOUDINARY_UPLOAD_PATH)
    );
  } catch {
    return false;
  }
};

export const getCloudinaryTransformedImageUrl = (
  imageUrl: string,
  { width, height }: CloudinaryDeliverySize,
) => {
  if (!isCloudinaryUploadUrl(imageUrl)) {
    return imageUrl;
  }

  const parsedUrl = new URL(imageUrl);
  const transformSegment =
    `c_fill,g_auto,f_auto,q_auto,dpr_auto,w_${width},h_${height}/`;
  const [beforeUploadPath, afterUploadPath] = parsedUrl.pathname.split(
    CLOUDINARY_UPLOAD_PATH,
  );

  if (!afterUploadPath) {
    return imageUrl;
  }

  if (afterUploadPath.startsWith(transformSegment)) {
    return imageUrl;
  }

  parsedUrl.pathname =
    `${beforeUploadPath}${CLOUDINARY_UPLOAD_PATH}${transformSegment}${afterUploadPath}`;

  return parsedUrl.toString();
};

export const getBlogCardImageSources = (
  imageUrl: string,
): ResponsiveImageSources => {
  if (!isCloudinaryUploadUrl(imageUrl)) {
    return {
      src: imageUrl,
      sizes: BLOG_CARD_IMAGE_SIZES,
      width: DEFAULT_BLOG_CARD_IMAGE_VARIANT.width,
      height: DEFAULT_BLOG_CARD_IMAGE_VARIANT.height,
    };
  }

  return {
    src: getCloudinaryTransformedImageUrl(
      imageUrl,
      DEFAULT_BLOG_CARD_IMAGE_VARIANT,
    ),
    srcSet: BLOG_CARD_IMAGE_VARIANTS.map(
      (variant) =>
        `${getCloudinaryTransformedImageUrl(imageUrl, variant)} ${variant.width}w`,
    ).join(", "),
    sizes: BLOG_CARD_IMAGE_SIZES,
    width: DEFAULT_BLOG_CARD_IMAGE_VARIANT.width,
    height: DEFAULT_BLOG_CARD_IMAGE_VARIANT.height,
  };
};
