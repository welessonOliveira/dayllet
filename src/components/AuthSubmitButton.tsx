"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type AuthSubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  className: string;
  ariaLabel?: string;
};

export function AuthSubmitButton({
  children,
  pendingLabel,
  className,
  ariaLabel,
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={ariaLabel}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
