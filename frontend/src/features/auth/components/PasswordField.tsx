import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/lib/utils";

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
}: PasswordFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className={cn("text-zinc-300", labelClassName)}>
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
          className={cn(
            "bg-zinc-950 pr-10 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500",
            error ? "border-red-500" : "border-zinc-800",
            inputClassName,
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-0 top-0 h-full px-3 text-zinc-400 hover:text-zinc-100",
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
      {error && <p className={cn("mt-1 text-sm text-red-500", errorClassName)}>{error}</p>}
    </div>
  );
};
