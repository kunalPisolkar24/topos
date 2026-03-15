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
    <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-zinc-100 flex items-center">
          <ImageIcon className="mr-2 h-5 w-5 text-zinc-400" />
          Featured Image
        </CardTitle>
        <p className="text-sm text-zinc-400">Recommended size: 600x400</p>
      </CardHeader>
      <CardContent>
        <div
          className="flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer h-64 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <div className="space-y-2 text-center">
            {preview ? (
              <img src={preview} alt="Card preview" className="mx-auto h-48 object-contain rounded-lg" />
            ) : (
              <UploadCloud className="mx-auto h-12 w-12 text-zinc-400" />
            )}
            <div className="text-sm text-zinc-400">
              <span className="font-medium text-zinc-300 hover:text-zinc-100 transition-colors">
                {cardImage ? "Change image" : "Upload an image"}
              </span>
              <input
                type="file"
                className="sr-only"
                accept="image/*"
                ref={inputRef}
                onChange={onFileChange}
              />
            </div>
            {cardImage && <p className="text-xs text-zinc-400 mt-1">{cardImage.name}</p>}
          </div>
        </div>
        {cardImageUrl && (
          <div className="mt-3 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
            <div className="text-sm text-green-300 flex items-center">
              <ImageIcon size={16} className="mr-2" />
              Image uploaded successfully
            </div>
          </div>
        )}
        {isUploading && (
          <div className="mt-3 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300">
            Uploading card image...
          </div>
        )}
      </CardContent>
    </Card>
  );
};
