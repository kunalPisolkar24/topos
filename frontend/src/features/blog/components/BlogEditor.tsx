import { forwardRef, useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BlogEditorProps {
  value: string;
  onChange: (content: string) => void;
  onImageUpload?: () => void;
  placeholder?: string;
}

export const BlogEditor = forwardRef<ReactQuill, BlogEditorProps>(
  ({ value, onChange, onImageUpload, placeholder = "Write your masterpiece here..." }, ref) => {
    const modules = useMemo(
      () => ({
        toolbar: {
          container: [
            [{ header: [1, 2, 3, 4, 5, 6, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ indent: "-1" }, { indent: "+1" }],
            [{ align: [] }],
            ["link", "image", "video"],
            ["blockquote", "code-block"],
            [{ color: [] }, { background: [] }],
            ["clean"],
          ],
          handlers: onImageUpload ? { image: onImageUpload } : {},
        },
        clipboard: { matchVisual: false },
      }),
      [onImageUpload]
    );

    const formats = [
      "header",
      "bold",
      "italic",
      "underline",
      "strike",
      "list",
      "bullet",
      "indent",
      "align",
      "link",
      "image",
      "video",
      "blockquote",
      "code-block",
      "color",
      "background",
    ];

    return (
      <Card className="gap-0 bg-surface-lowest py-0">
        <CardHeader className="bg-surface-low p-4 sm:p-5">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
            04 // Body
          </p>
          <CardTitle className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            Long-form Editor
          </CardTitle>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Structure the article with headings, lists, links, and embedded media.
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="blog-content-editor-wrapper overflow-hidden ring-1 ring-outline-variant/20">
            <ReactQuill
              ref={ref}
              theme="snow"
              value={value}
              onChange={onChange}
              modules={modules}
              formats={formats}
              placeholder={placeholder}
              bounds=".blog-content-editor-wrapper"
            />
          </div>
        </CardContent>
      </Card>
    );
  }
);

BlogEditor.displayName = "BlogEditor";
