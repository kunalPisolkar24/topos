import type React from "react";

interface BlogHeaderProps {
  title: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const BlogHeader: React.FC<BlogHeaderProps> = ({
  title,
  imageUrl,
  createdAt,
  updatedAt,
}) => {
  const formatDate = (date: string) => {
    const dateValue = new Date(date);
    const isValidDate = !Number.isNaN(dateValue.getTime());

    return {
      machine: isValidDate ? dateValue.toISOString() : date,
      display: isValidDate
        ? dateValue.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : date,
    };
  };

  const publishedDate = formatDate(createdAt);
  const updatedDate = formatDate(updatedAt);
  const wasUpdated = createdAt !== updatedAt;

  return (
    <header className="relative overflow-hidden bg-surface-low ring-1 ring-outline-variant/20">
      {imageUrl && (
        <div className="relative h-[16rem] overflow-hidden sm:h-[20rem] lg:h-[26rem]">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover opacity-80 saturate-[0.82]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(var(--surface))_0%,rgb(var(--surface)/0.76)_32%,rgb(var(--surface)/0.22)_72%,rgb(var(--surface)/0.86)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgb(var(--primary-container)/0.52),transparent_32%)]" />
          <div
            className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(var(--outline-variant)/0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--outline-variant)/0.12)_1px,transparent_1px)] [background-size:4rem_4rem]"
            aria-hidden="true"
          />
        </div>
      )}

      <div className={imageUrl ? "relative -mt-20 p-4 sm:p-5 lg:p-6" : "p-4 sm:p-5 lg:p-6"}>
        <div className="bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-6 lg:p-7">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
            Article // Topos
          </p>
          <h1 className="mt-4 max-w-5xl text-balance break-words text-2xl font-semibold leading-[1.05] tracking-[-0.025em] text-foreground [overflow-wrap:anywhere] sm:text-3xl md:text-4xl lg:text-5xl">
            {title}
          </h1>
          <div className="mt-6 flex flex-wrap gap-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <time
              dateTime={publishedDate.machine}
              className="bg-surface-low px-3 py-2 ring-1 ring-outline-variant/20"
            >
              Published {publishedDate.display}
            </time>
            {wasUpdated && (
              <time
                dateTime={updatedDate.machine}
                className="bg-primary-container px-3 py-2 text-primary-foreground"
              >
                Updated {updatedDate.display}
              </time>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
