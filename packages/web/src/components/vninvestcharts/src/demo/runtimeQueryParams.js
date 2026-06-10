export function isCleanSmokeModeEnabled(search) {
    const params = new URLSearchParams(search ?? "");
    return params.get("smoke") === "clean" || params.get("cleanSmoke") === "1";
}
