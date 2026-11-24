import { vi } from 'vitest';
import { createSocClient } from "../soc.js";

describe("SOC adapter — CafeF OHLC cross-check", () => {
  let coreGet;
  let corePost;
  let soc;

  beforeEach(() => {
    coreGet = vi.fn().mockResolvedValue({});
    corePost = vi.fn().mockResolvedValue({});
    soc = createSocClient({
      coreGet,
      corePost,
      corePut: vi.fn(),
      corePatch: vi.fn(),
      coreDelete: vi.fn(),
    });
  });

  it("previewCafefImport posts payload", async () => {
    await soc.previewCafefImport({ exchange: "HOSE", year: 2022 });
    expect(corePost).toHaveBeenCalledWith(
      "/operator/scraping/dataops/cafef/preview/",
      { exchange: "HOSE", year: 2022 },
    );
  });

  it("runCafefImport posts payload with dry_run", async () => {
    await soc.runCafefImport({ exchange: "HOSE", year: 2022, dry_run: true });
    expect(corePost).toHaveBeenCalledWith(
      "/operator/scraping/dataops/cafef/run/",
      { exchange: "HOSE", year: 2022, dry_run: true },
    );
  });

  it("abortCafefImport requires runId", () => {
    expect(() => soc.abortCafefImport()).toThrow("runId");
    soc.abortCafefImport("run-1");
    expect(corePost).toHaveBeenCalledWith(
      "/operator/scraping/dataops/cafef/run/run-1/abort/",
    );
  });

  it("getCafefImportStatus gets status URL", async () => {
    await soc.getCafefImportStatus("run-1");
    expect(coreGet).toHaveBeenCalledWith(
      "/operator/scraping/dataops/cafef/run/run-1/status/",
    );
  });
});

