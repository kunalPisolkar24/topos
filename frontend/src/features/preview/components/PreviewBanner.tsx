import { isPreview } from "@/shared/config/preview";

export const PreviewBanner = () => {
  if (!isPreview()) return null;

  return (
    <>
      <div
        data-slot="preview-banner"
        className="fixed inset-x-0 top-0 z-[60] flex min-h-6 items-center justify-center bg-primary-container px-4 py-1 text-center font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-primary-foreground"
      >
        <span className="hidden sm:inline">Preview — local demo data · uploads disabled · AI simulated · clearing site data resets</span>
        <span className="sm:hidden">Preview — local demo · uploads disabled</span>
      </div>
      <style>{` :root { --app-navbar-height: calc(3.5rem + 24px); --app-navbar-offset: calc(3.5rem + 24px + 1rem); } `}</style>
    </>
  );
};
