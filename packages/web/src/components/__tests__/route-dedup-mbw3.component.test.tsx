import { describe, it, expect } from "vitest";
import { routeCatalog } from "../../app/routeCatalog.js";

/**
 * mbw3 FE-DUPID — gate thật cho trùng id `portfolios-manage` (F-05).
 *
 * Contract test 2 chiều mù với trùng id: trùng hiện tại vẫn xanh. Gate thật
 * là đếm entry trùng id trong catalog == 1 (F-05). Entry giữ lại duy nhất:
 * path `/portfolios/manage` + titleKey `portfoliosManage.title` (đúng trang
 * đang render `PortfoliosPage.tsx:189`).
 */
describe("FE-DUPID: 1 entry portfolios-manage duy nhất", () => {
  it("chỉ còn đúng 1 entry id portfolios-manage", () => {
    const hits = (routeCatalog as Array<{ id: string }>).filter(
      (e) => e.id === "portfolios-manage",
    );
    expect(hits).toHaveLength(1);
  });

  it("entry giữ lại mang portfoliosManage.title + đúng path", () => {
    const entry = (routeCatalog as Array<{ id: string; path: string; titleKey: string }>)
      .find((e) => e.id === "portfolios-manage");
    expect(entry?.path).toBe("/portfolios/manage");
    expect(entry?.titleKey).toBe("portfoliosManage.title");
  });
});
