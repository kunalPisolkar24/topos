import type React from "react";
import { UploadCloud, ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeaturedImageSectionProps {
  preview: string | null;
  cardImage: File | null;
  cardImageUrl: string | null;
  isUploading: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

export const FeaturedImageSection: React.FC<FeaturedImageSectionProps> = ({
  preview,
  cardImage,
  cardImageUrl,
  isUploading,
  onFileChange,
  inputRef,
}) => {
  return (
    <Card className="gap-0 bg-surface-lowest py-0">
      <CardHeader className="bg-surface-low p-4 sm:p-5">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
          03 // Cover Asset
        </p>
        <CardTitle className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
          <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          Featured Image
        </CardTitle>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Required for publication cards. Use a wide, quiet image that supports the headline.
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <button
          type="button"
          className="interactive-hover-primary flex min-h-72 w-full cursor-pointer items-center justify-center border border-dashed border-outline-variant/40 bg-surface-low p-5 text-left"
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-full space-y-4">
            {preview ? (
              <div className="bg-surface-lowest p-2 ring-1 ring-outline-variant/20">
                <img
                  src={preview}
                  alt="Card preview"
                  className="h-56 w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-56 w-full items-center justify-center bg-surface-lowest ring-1 ring-outline-variant/20">
                <UploadCloud className="h-12 w-12 text-primary" aria-hidden="true" />
              </div>
            )}
            <div>
              <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-foreground">
                {cardImage ? "Change image" : "Upload cover image"}
              </span>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Recommended ratio: 3:2 or wider. JPG, PNG, and WebP work best.
              </p>
            </div>
            {cardImage && (
              <p className="break-all font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                {cardImage.name}
              </p>
            )}
          </div>
        </button>
        <input
          type="file"
          className="sr-only"
          accept="image/*"
          ref={inputRef}
          onChange={onFileChange}
        />
        {cardImageUrl && (
          <div className="mt-3 bg-primary-container p-3 text-primary-foreground">
            <div className="flex items-center text-sm">
              <ImageIcon size={16} className="mr-2" aria-hidden="true" />
              Image uploaded successfully
            </div>
          </div>
        )}
        {isUploading && (
          <div className="mt-3 bg-surface-low p-3 text-sm text-muted-foreground ring-1 ring-outline-variant/20">
            Uploading card image...
          </div>
        )}
      </CardContent>
    </Card>
  );
};
