export function createDnseClient({ coreGet, corePost, coreDelete }) {
  return {
    getDNSEDataCredential() {
      return coreGet("/api/core/v1/dnse-credential/");
    },

    saveDNSEDataCredential(data) {
      return corePost("/api/core/v1/dnse-credential/", data);
    },

    deleteDNSEDataCredential() {
      return coreDelete("/api/core/v1/dnse-credential/");
    },

    triggerSystemBackfill(data) {
      return corePost("/data-ingest/backfill/system/", data);
    },

    triggerUserBackfill(data) {
      return corePost("/data-ingest/backfill/user/", data);
    },

    getDnseBackfillJobs() {
      if (typeof window === 'undefined' || !window.localStorage) {
        return Promise.resolve({ jobs: [] });
      }
      try {
        const jobsStr = window.localStorage.getItem('dnse_backfill_jobs');
        const jobs = jobsStr ? JSON.parse(jobsStr) : [];
        return Promise.resolve({ jobs });
      } catch (e) {
        return Promise.resolve({ jobs: [] });
      }
    },

    triggerDnseBackfill(data) {
      const jobId = 'dnse-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const newJob = {
        id: jobId,
        status: 'running',
        symbol: data.symbol || 'ALL',
        date: data.date_from ? `${data.date_from} to ${data.date_to || data.date_from}` : 'N/A',
        progress: 0,
        started_at: new Date().toISOString(),
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const jobsStr = window.localStorage.getItem('dnse_backfill_jobs');
          const jobs = jobsStr ? JSON.parse(jobsStr) : [];
          jobs.unshift(newJob);
          if (jobs.length > 50) {
            jobs.length = 50;
          }
          window.localStorage.setItem('dnse_backfill_jobs', JSON.stringify(jobs));
        } catch (e) {
          console.error("Failed to save DNSE backfill job to localStorage", e);
        }
      }

      const fromDate = data.date_from || "";
      const toDate = data.date_to || fromDate;
      const payload = {
        datasets: ["tape_intraday"],
        symbols_group: "custom",
        symbol: data.symbol || "",
        from_date: fromDate,
        to_date: toDate,
        mode: "missing_only",
        dry_run: false,
      };

      return corePost("/data-ingest/backfill/system/", payload)
        .then((response) => {
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              const jobsStr = window.localStorage.getItem('dnse_backfill_jobs');
              const jobs = jobsStr ? JSON.parse(jobsStr) : [];
              const jobIdx = jobs.findIndex(j => j.id === jobId);
              if (jobIdx !== -1) {
                jobs[jobIdx].status = 'completed';
                jobs[jobIdx].progress = 100;
                jobs[jobIdx].completed_at = new Date().toISOString();
                jobs[jobIdx].response = response;
                window.localStorage.setItem('dnse_backfill_jobs', JSON.stringify(jobs));
              }
            } catch (e) {
              console.error("Failed to update DNSE backfill job in localStorage", e);
            }
          }
          return response;
        })
        .catch((error) => {
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              const jobsStr = window.localStorage.getItem('dnse_backfill_jobs');
              const jobs = jobsStr ? JSON.parse(jobsStr) : [];
              const jobIdx = jobs.findIndex(j => j.id === jobId);
              if (jobIdx !== -1) {
                jobs[jobIdx].status = 'failed';
                jobs[jobIdx].progress = 0;
                jobs[jobIdx].error = error.message || String(error);
                jobs[jobIdx].completed_at = new Date().toISOString();
                window.localStorage.setItem('dnse_backfill_jobs', JSON.stringify(jobs));
              }
            } catch (e) {
              console.error("Failed to update DNSE backfill job in localStorage", e);
            }
          }
          throw error;
        });
    },
  };
}

