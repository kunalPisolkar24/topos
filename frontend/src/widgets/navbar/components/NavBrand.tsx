import { Link } from "react-router-dom";
import { Waypoints } from "lucide-react";

export function NavBrand() {
  return (
    <Link
      to="/"
      className="group flex min-w-0 items-center gap-3"
      aria-label="Go to home page"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-primary-foreground ring-1 ring-primary/35 transition-colors group-hover:bg-primary/90">
        <Waypoints className="h-4 w-4" />
      </span>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-foreground">
        Topos
      </p>
    </Link>
  );
}
