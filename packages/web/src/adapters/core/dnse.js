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
  };
}
