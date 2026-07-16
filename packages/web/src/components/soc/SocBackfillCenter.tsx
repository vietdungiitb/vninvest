// SocBackfillCenter was a near-duplicate of SocDataOpsOperationsSection.
// Per the SOC theme/tech-debt audit (Step 7), the two surfaces are merged:
// this module now delegates to the canonical Operations Section so there is
// a single source of truth for the backfill form, planner preview and run logs.
import { createElement } from "react";
import { SocDataOpsOperationsSection } from "./SocDataOpsOperationsSection.js";

interface SocBackfillCenterProps {
  customGroups?: Array<{ slug: string; name: string; type: string; symbol_count?: number; description?: string }>;
}

export function SocBackfillCenter(_props: SocBackfillCenterProps) {
  return createElement(SocDataOpsOperationsSection);
}
