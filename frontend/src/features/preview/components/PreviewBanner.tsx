import { isPreview } from "@/shared/config/preview";

export const PreviewBanner = () => {
  if (!isPreview()) return null;

  return (
    <>
      <div
        data-slot="preview-banner"
        className="fixed inset-x-0 top-0 z-[60] flex min-h-5 items-center justify-center bg-primary-container px-4 py-1 text-center font-mono text-[0.6rem] font-medium uppercase tracking-[0.12em] text-primary-foreground"
      >
        <span className="hidden sm:inline">Preview — local demo data · uploads disabled · AI simulated · clearing site data resets</span>
        <span className="sm:hidden">Preview — local demo · uploads disabled</span>
      </div>
      <style>{` :root { --app-navbar-height: 3rem; --app-navbar-offset: calc(3rem + 20px + 1rem); } `}</style>
    </>
  );
};
