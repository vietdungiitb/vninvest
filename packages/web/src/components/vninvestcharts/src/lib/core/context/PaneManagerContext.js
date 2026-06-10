import { createContext, createElement, useContext } from "react";
const PaneManagerContext = createContext(undefined);
export function PaneManagerProvider({ value, children }) {
    return createElement(PaneManagerContext.Provider, { value }, children);
}
export function usePaneManagerContext() {
    const context = useContext(PaneManagerContext);
    if (!context) {
        throw new Error("usePaneManagerContext must be used within a PaneManagerProvider");
    }
    return context;
}
export { PaneManagerContext };
