import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 0;

const toneStyles: Record<ToastTone, string> = {
  success: "border-success/30 bg-surface text-ink",
  error: "border-danger/30 bg-surface text-ink",
  info: "border-info/25 bg-surface text-ink",
};

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle size={20} weight="fill" className="text-success" aria-hidden="true" />,
  error: <WarningCircle size={20} weight="fill" className="text-danger" aria-hidden="true" />,
  info: <Info size={20} weight="fill" className="text-info" aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = ++nextId;
      setItems((current) => [...current.slice(-2), { ...toast, id }]);
      window.setTimeout(() => remove(id), 4800);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push({ tone: "success", title, description }),
      error: (title, description) => push({ tone: "error", title, description }),
      info: (title, description) => push({ tone: "info", title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-raised animate-slide-up",
              toneStyles[item.tone],
            )}
          >
            <div className="mt-0.5 shrink-0">{icons[item.tone]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-strong">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-sm leading-relaxed text-muted-fg">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-fg transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
