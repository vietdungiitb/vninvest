import { createElement } from "react";
import { ShellSkeleton } from "../ShellSkeleton.js";

/** Trạng thái loading dùng chung; ưu tiên skeleton có sẵn. */
export function LoadingState({ count = 3, variant = "card" }: { count?: number; variant?: "card" | "text" }) {
  return createElement(ShellSkeleton, { count, variant });
}
