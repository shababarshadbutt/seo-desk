"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export function useFunctionalityStub(defaultMessage = "Functionality in progress") {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback(
    (msg?: string) => setMessage(msg ?? defaultMessage),
    [defaultMessage]
  );
  const dismiss = useCallback(() => setMessage(null), []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismiss, 3500);
    return () => clearTimeout(timer);
  }, [message, dismiss]);

  return { message, show, dismiss };
}

export function FunctionalityStubToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2"
    >
      <Sparkles className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm text-foreground">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
