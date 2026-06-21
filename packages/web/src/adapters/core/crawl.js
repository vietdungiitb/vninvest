export function createCrawlClient({ coreGet, corePost }) {
  return {
    getAdminCrawlJobs() {
      return coreGet("/v1/admin/crawl/jobs/");
    },

    runAdminCrawlJob(id) {
      if (!id) throw new Error("id is required for runAdminCrawlJob");
      return corePost(`/v1/admin/crawl/jobs/${encodeURIComponent(id)}/run/`);
    },

    stopAdminCrawlJob(id) {
      if (!id) throw new Error("id is required for stopAdminCrawlJob");
      return corePost(`/v1/admin/crawl/jobs/${encodeURIComponent(id)}/stop/`);
    },

    getAdminCrawlRuns(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/v1/admin/crawl/runs/${query ? `?${query}` : ""}`);
    },

    getAdminCrawlAuditLogs(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/v1/admin/crawl/audit-logs/${query ? `?${query}` : ""}`);
    },
  };
}
