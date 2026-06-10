import { jest } from '@jest/globals';
import { createCommercialClient } from "../commercial.js";

describe("commercial adapter", () => {
  it("should call coreGet and corePost correctly", async () => {
    const coreGet = jest.fn().mockResolvedValue({ success: true });
    const corePost = jest.fn().mockResolvedValue({ pay_url: "http://example.com" });
    
    const client = createCommercialClient({ coreGet, corePost });
    
    await client.getBillingSubscription();
    expect(coreGet).toHaveBeenCalledWith("/billing/subscription");
    
    await client.getBillingQuota();
    expect(coreGet).toHaveBeenCalledWith("/billing/quota");
    
    await client.getBillingInvoices({ page: 2 });
    expect(coreGet).toHaveBeenCalledWith("/billing/invoices?page=2");
    
    await client.createPayment({ amount: 100000, plan: "VIP_1M" });
    expect(corePost).toHaveBeenCalledWith("/payments/create/", { amount: 100000, plan: "VIP_1M" });
    
    await client.getPaymentStatus("txn123");
    expect(coreGet).toHaveBeenCalledWith("/payments/status/txn123/");
  });
});
