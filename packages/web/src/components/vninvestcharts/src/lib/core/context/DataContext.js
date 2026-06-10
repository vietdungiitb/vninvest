import { createContext, createElement, useContext } from "react";
const DataContext = createContext(undefined);
export function DataProvider({ value, children }) {
    return createElement(DataContext.Provider, { value }, children);
}
export function useDataContext() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error("useDataContext must be used within a DataProvider");
    }
    return context;
}
export { DataContext };
