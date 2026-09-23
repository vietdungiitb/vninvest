/**
 * broker.js — B1.3: adapter cấu hình broker đa-nhà (dnse/ssi/tcbs).
 *
 * Endpoints mới (store UserBrokerConfig, BE user_workspace/views_broker.py).
 * workspace.js giữ các method DNSE trading cũ (sync/order/OTP) — chỉ trỏ sang đây
 * cho phần config; dnse.js giữ backfill + identity credential lane.
 */
export function createBrokerClient({ coreGet, corePost, coreDelete }) {
  const path = (provider) => `/broker/${encodeURIComponent(provider)}/config/`;
  return {
    getBrokerProviders() {
      return coreGet("/broker/providers/");
    },

    getBrokerSchema(provider) {
      return coreGet(`/broker/config-schema/${encodeURIComponent(provider)}/`);
    },

    getBrokerConfig(provider) {
      return coreGet(path(provider));
    },

    saveBrokerConfig(provider, data) {
      return corePost(path(provider), data);
    },

    deleteBrokerConfig(provider) {
      return coreDelete(path(provider));
    },

    testBrokerConnection(provider) {
      return corePost(`/broker/${encodeURIComponent(provider)}/test-connection/`, {});
    },

    getBrokerJob(jobId) {
      return coreGet(`/broker/jobs/${encodeURIComponent(jobId)}/`);
    },
  };
}
