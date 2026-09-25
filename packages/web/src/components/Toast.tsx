import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItemComponent key={t.id} message={t.message} variant={t.variant} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemComponent({ message, variant }: { message: string; variant: ToastVariant }) {
  const variantStyles: Record<ToastVariant, string> = {
    default: "bg-[var(--bg-panel)] border-[var(--border-default)] text-[var(--text-primary)]",
    success: "bg-[var(--bg-panel)] border-emerald-700 text-[var(--text-primary)]",
    error: "bg-[var(--bg-panel)] border-rose-700 text-[var(--text-primary)]",
    warning: "bg-[var(--bg-panel)] border-amber-700 text-[var(--text-primary)]",
    info: "bg-[var(--bg-panel)] border-cyan-700 text-[var(--text-primary)]",
  };

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-right-4 duration-200 ${variantStyles[variant]}`}
    >
      <span className="text-sm">{message}</span>
    </div>
  );
}