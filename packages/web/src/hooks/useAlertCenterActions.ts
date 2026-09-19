import { useState, useCallback } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

interface AlertActionItem {
  alert_id?: string | number;
  event_id?: string | number;
  symbol?: string;
  alert_family?: string;
  alert_type?: string;
  [key: string]: unknown;
}

export function useAlertCenterActions(refetch: () => void, lane: string = "main") {
  const [activeAlertId, setActiveAlertId] = useState<string | number>("");
  const [activeDetail, setActiveDetail] = useState<unknown>(null);
  const [activeContext, setActiveContext] = useState<unknown>(null);
  const [actionError, setActionError] = useState("");
  const [busyAlertId, setBusyAlertId] = useState<string | number>("");
  const [optimisticAck, setOptimisticAck] = useState<Record<string, boolean>>({});
  const [optimisticMuted, setOptimisticMuted] = useState<Record<string, boolean>>({});

  const handleLoadDetail = useCallback(async (alert: AlertActionItem) => {
    const id = (alert as any)?.alert_id ?? (alert as any)?.event_id;
    const sym = (alert as any)?.symbol;
    if (!id || !sym) return;
    setActionError("");
    setBusyAlertId(id as string | number);
    try {
      const [detail, context] = await Promise.all([
        coreApiAdapter.getAlertCenterEventDetail(id, { lane }),
        coreApiAdapter.getAlertCenterSymbolContext(sym, { lane }),
      ]);
      setActiveAlertId(id as string | number);
      setActiveDetail(detail || null);
      setActiveContext(context || null);
    } catch (err: unknown) {
      setActionError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
        "Không thể tải chi tiết alert.",
      );
    } finally {
      setBusyAlertId("");
    }
  }, [lane]);

  const handleAcknowledge = useCallback(async (alert: AlertActionItem) => {
    const id = (alert as any)?.alert_id ?? (alert as any)?.event_id;
    if (!id) return;
    const idStr = String(id);
    setActionError("");
    setBusyAlertId(id as string | number);
    setOptimisticAck(prev => ({ ...prev, [idStr]: true }));
    try {
      await coreApiAdapter.acknowledgeAlertCenterEvent(id, { lane });
      refetch();
    } catch (err: unknown) {
      setOptimisticAck(prev => { const n = { ...prev }; delete n[idStr]; return n; });
      setActionError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
        "Không thể xác nhận alert.",
      );
    } finally {
      setBusyAlertId("");
    }
  }, [lane, refetch]);

  const handleMute = useCallback(async (alert: AlertActionItem) => {
    if (!alert?.symbol) return;
    const sym = String(alert.symbol).trim().toUpperCase();
    setActionError("");
    setBusyAlertId(alert.alert_id || alert.symbol);
    setOptimisticMuted(prev => ({ ...prev, [sym]: true }));
    try {
      await coreApiAdapter.muteAlertCenterPreference({
        symbol: alert.symbol,
        alert_family: alert.alert_family || alert.alert_type || "",
        mute_minutes: 30,
      });
      refetch();
    } catch (err: unknown) {
      setOptimisticMuted(prev => { const n = { ...prev }; delete n[sym]; return n; });
      setActionError(
        (err && typeof err === "object" && "message" in err ? (err as Error).message : "") ||
        "Không thể tắt tiếng cảnh báo mã.",
      );
    } finally {
      setBusyAlertId("");
    }
  }, [refetch]);

  const closeDetail = useCallback(() => {
    setActiveDetail(null);
  }, []);

  return {
    activeAlertId, activeDetail, activeContext,
    actionError, busyAlertId, optimisticAck, optimisticMuted,
    handleLoadDetail, handleAcknowledge, handleMute, closeDetail,
  };
}
