/**
 * licenseTrustAnchor — trust anchor cho key license offline cua vnsaas.
 *
 * Engine (`@vninvestcharts/engine-core`) loc tac gia ky theo `kid` truoc khi
 * verify (`dist/index.js`, `activePublicKeys.filter(jwk => jwk.kid === wantedKid)`
 * → rong thi `return null`). Stock engine chi biet 3 kid nhung
 * (`prod-2026-10-17`, `e2e-2026-10-31`, `prod-2026-11-09`), trong khi vnsaas ky
 * bang kid `primary` ⇒ verify LUON null neu khong inject.
 *
 * JWK duoi day la PUBLIC (vnsaas share cong khai, nhung vao bundle la chu y) —
 * KHONG phai secret. Go 1 lan luc boot (idempotent) truoc khi widget verify key.
 */
import { addLicensePublicKey } from "@vninvestcharts/engine-core";

const PRIMARY_JWK = {
	kty: "EC",
	crv: "P-256",
	x: "gRQWjWfaOo3tqix3WV0-MI6hEUCOre-86ClPbaXYgvw",
	y: "kxgXaOlVtBUbDkAFVfDGg5TYxMt1eGmXHko81ABJCBY",
	kid: "primary",
};

let injected = false;

/** Nap JWK `primary` vao engine. Goi nhieu lan cung chi nap 1 lan. */
export function ensureLicenseTrustAnchor() {
	if (injected) return;
	injected = true;
	addLicensePublicKey(PRIMARY_JWK);
}
