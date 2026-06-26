import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  minLength?: number;
  id?: string;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  autoFocus,
  required,
  minLength = 8,
  id,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const hasMinLength = value.length >= minLength;

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-10 text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full border",
            hasMinLength
              ? "border-green-500 bg-green-500 text-white"
              : "border-muted-foreground/30 text-muted-foreground"
          )}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
        <span className={cn(hasMinLength ? "text-green-600" : "text-muted-foreground")}>
          At least {minLength} characters
        </span>
      </div>
    </div>
  );
}
