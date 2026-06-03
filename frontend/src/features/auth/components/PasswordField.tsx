import {
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/shared/lib/cn";

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  registration: UseFormRegisterReturn;
  error?: string;
  rightLabel?: ReactNode;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  toggleClassName?: string;
  errorClassName?: string;
  errorId?: string;
  inputProps?: Omit<
    ComponentPropsWithoutRef<"input">,
    "id" | "type" | "placeholder" | "className"
  >;
}

export const PasswordField = ({
  id,
  label,
  placeholder = "Enter your password",
  registration,
  error,
  rightLabel,
  className,
  labelClassName,
  inputClassName,
  toggleClassName,
  errorClassName,
  errorId,
  inputProps,
}: PasswordFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className={labelClassName}>
          {label}
        </Label>
        {rightLabel}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          {...registration}
          {...inputProps}
          className={cn(
            "pr-12",
            error && "border-destructive",
            inputClassName,
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-0 top-0 h-full w-12 border-l border-outline-variant/20 px-0 text-muted-foreground hover:bg-surface-low hover:text-foreground",
            toggleClassName,
          )}
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          <span className="sr-only">
            {showPassword ? "Hide password" : "Show password"}
          </span>
        </Button>
      </div>
      {error && (
        <p
          id={errorId}
          className={cn("mt-1 text-sm text-destructive", errorClassName)}
        >
          {error}
        </p>
      )}
    </div>
  );
};
