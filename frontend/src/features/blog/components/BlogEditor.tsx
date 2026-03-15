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
      <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-zinc-100 flex items-center">
            <FileText className="mr-2 h-5 w-5 text-zinc-400" />
            Blog Content
          </CardTitle>
          <p className="text-sm text-zinc-400">
            Write your blog content using the rich text editor
          </p>
        </CardHeader>
        <CardContent>
          <div className="blog-content-editor-wrapper rounded-lg overflow-hidden border border-zinc-700">
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
