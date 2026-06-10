export const TOOL_CAPABILITY_REGISTRY = {
    // ── Phase A1: Line family ──────────────────────────────────────────────────
    trendLine: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    ray: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    extendedLine: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    hLine: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: true },
        phase: "A",
        status: "parityReady",
    },
    vLine: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: true },
        phase: "A",
        status: "parityReady",
    },
    arrow: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    polyline: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    // ── Phase A2: Shape family ─────────────────────────────────────────────────
    rectangle: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    circle: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    ellipse: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    callout: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: false, canMultiStep: false, canTextEdit: true, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    text: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: false, canMultiStep: false, canTextEdit: true, canGroupSelect: true, isSinglePoint: true },
        phase: "A",
        status: "parityReady",
    },
    priceLabel: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: true },
        phase: "A",
        status: "parityReady",
    },
    triangle: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    priceRange: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    dateRange: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    barsCount: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    dateAndPriceRange: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    longPosition: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    shortPosition: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "A",
        status: "parityReady",
    },
    // ── Phase B1: Fibonacci family ─────────────────────────────────────────────
    fibonacci: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibExtension: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibArc: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibTimeZone: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibChannel: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibSpeedResistanceFan: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    trendBasedFibTime: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibCircles: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibSpiral: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibSpeedResistanceArcs: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    fibWedge: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    // ── Phase B2: Gann family ──────────────────────────────────────────────────
    gannFan: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    gannBox: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    gannSquare: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    gannSquareFixed: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    pitchfan: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    // ── Phase B3: Cycle family ─────────────────────────────────────────────────
    cyclicLines: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    timeCycles: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    sineLine: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "B",
        status: "parityReady",
    },
    // ── Phase C1: Elliott family ───────────────────────────────────────────────
    elliottImpulse: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: true, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    elliottCorrection: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: true, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    elliottTriangle: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: true, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    elliottDoubleCombo: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: true, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    elliottTripleCombo: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: true, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    // ── Phase C2: Harmonic/pattern family ──────────────────────────────────────
    channel: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    parallelChannel: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    pitchfork: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    regressionChannel: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: false, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    abcdPattern: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    xabcdPattern: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    cypherPattern: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    headAndShoulders: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    trianglePattern: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
    threeDrivesPattern: {
        capabilities: { canAuthor: true, canManipulate: true, canHitTest: true, canRenderPrimitive: true, canSnap: true, canMultiStep: true, canTextEdit: false, canGroupSelect: true, isSinglePoint: false },
        phase: "C",
        status: "parityReady",
    },
};
export function getToolCapabilityDescriptor(tool) {
    if (!tool) {
        return undefined;
    }
    return TOOL_CAPABILITY_REGISTRY[tool];
}
export function buildToolCoverageMatrix() {
    const rows = Object.entries(TOOL_CAPABILITY_REGISTRY)
        .sort(([leftTool], [rightTool]) => leftTool.localeCompare(rightTool))
        .map(([tool, descriptor]) => ({
        tool,
        phase: descriptor.phase,
        status: descriptor.status,
        capabilities: descriptor.capabilities,
    }));
    const byPhase = {
        A: rows.filter((row) => row.phase === "A"),
        B: rows.filter((row) => row.phase === "B"),
        C: rows.filter((row) => row.phase === "C"),
        legacyOnly: rows.filter((row) => row.phase === "legacyOnly"),
    };
    const byStatus = {
        parityReady: rows.filter((row) => row.status === "parityReady"),
        authoringBeta: rows.filter((row) => row.status === "authoringBeta"),
        renderOnly: rows.filter((row) => row.status === "renderOnly"),
        disabled: rows.filter((row) => row.status === "disabled"),
    };
    return {
        rows,
        summary: {
            total: rows.length,
            parityReady: byStatus.parityReady.length,
            authoringBeta: byStatus.authoringBeta.length,
            renderOnly: byStatus.renderOnly.length,
            disabled: byStatus.disabled.length,
        },
        byPhase,
        byStatus,
    };
}
export function isForkSupportedDrawingAuthoringTool(toolName) {
    if (typeof toolName !== "string") {
        return false;
    }
    const desc = getToolCapabilityDescriptor(toolName);
    return (desc !== undefined
        && desc.capabilities.canAuthor
        && desc.status !== "disabled"
        && desc.status !== "renderOnly");
}
export function isForkSupportedDrawingManipulationType(typeName) {
    if (typeof typeName !== "string") {
        return false;
    }
    const desc = getToolCapabilityDescriptor(typeName);
    return (desc !== undefined
        && desc.capabilities.canManipulate
        && desc.status === "parityReady");
}
export function isForkMultiStepTool(toolName) {
    const desc = getToolCapabilityDescriptor(toolName);
    return desc !== undefined && desc.capabilities.canMultiStep;
}
export function isForkSinglePointTool(toolName) {
    const desc = getToolCapabilityDescriptor(toolName);
    return desc !== undefined && desc.capabilities.isSinglePoint;
}
