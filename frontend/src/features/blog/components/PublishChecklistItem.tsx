import type React from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface PublishChecklistItemProps {
  icon: React.ElementType;
  label: string;
  detail: string;
  complete: boolean;
}

export const PublishChecklistItem: React.FC<PublishChecklistItemProps> = ({
  icon: Icon,
  label,
  detail,
  complete,
}) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-surface-lowest p-3 ring-1 ring-outline-variant/20">
    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
    <div className="min-w-0">
      <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
    {complete ? (
      <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Complete" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" aria-label="Incomplete" />
    )}
  </div>
);
