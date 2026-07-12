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
    default: "bg-slate-900 border-slate-700 text-slate-100",
    success: "bg-emerald-900/50 border-emerald-700 text-emerald-100",
    error: "bg-rose-900/50 border-rose-700 text-rose-100",
    warning: "bg-amber-900/50 border-amber-700 text-amber-100",
    info: "bg-cyan-900/50 border-cyan-700 text-cyan-100",
  };

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-right-4 duration-200 ${variantStyles[variant]}`}
    >
      <span className="text-sm">{message}</span>
    </div>
  );
}