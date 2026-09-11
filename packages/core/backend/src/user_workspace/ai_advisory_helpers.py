"""AI Advisory helper — tính ai_score_0_100 từ tín hiệu kỹ thuật (confluence).

File được build từ đầu (không tồn tại trong codebase cũ). Quy tắc deterministic,
không dùng ML. Nếu tính toán lỗi hoặc thiếu tín hiệu cốt lõi → trả None
(run view phải fallback, không crash scan).
"""
from typing import Dict, Any, Optional


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def compute_ai_advisory(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Tính điểm AI 0-100 và hành động từ các tín hiệu kỹ thuật của một mã.

    Trả về dict {ai_score_0_100, strategy_action, risk_level, synthesis_text}
    hoặc None nếu không đủ dữ liệu / lỗi.
    """
    try:
        rsi = row.get("rsi_14")
        macd = row.get("macd_hist")
        mom = row.get("momentum_20d_pct")
        rvol = row.get("volume_rvol")
        pct_sma20 = row.get("price_vs_sma20_pct")
        whale_net = row.get("whale_net_value")
        whale_int = row.get("whale_intensity")

        # Thiếu toàn bộ tín hiệu cốt lõi → không chấm điểm
        if rsi is None and macd is None and mom is None:
            return None

        parts = []
        if rsi is not None:
            # RSI 30 -> 70 (bullish), 70 -> 30 (bearish), 50 -> 50 (trung tính)
            parts.append(("rsi", 100 - float(rsi), 0.30))
        if macd is not None:
            parts.append(("macd", 50 + _clamp(float(macd) * 20, -50, 50), 0.25))
        if mom is not None:
            parts.append(("momentum", 50 + _clamp(float(mom) * 2, -50, 50), 0.20))
        if pct_sma20 is not None:
            parts.append(("trend", 50 + _clamp(float(pct_sma20) * 1.5, -50, 50), 0.15))
        if rvol is not None:
            parts.append(("volume", 50 + _clamp((float(rvol) - 1) * 20, -50, 50), 0.10))

        total_w = sum(w for _, _, w in parts)
        if total_w == 0:
            return None

        score = sum(s * w for _, s, w in parts) / total_w

        # Whale confluence — bonus nhẹ, không đổi weight chính
        if whale_int is not None and whale_net is not None:
            if float(whale_net) > 0:
                score = _clamp(score + 3, 0, 100)
            elif float(whale_net) < 0:
                score = _clamp(score - 3, 0, 100)

        score = round(_clamp(score, 0, 100), 1)

        if score >= 70:
            action = "BUY"
        elif score <= 30:
            action = "SELL"
        elif score <= 45:
            action = "STAND_ASIDE"
        else:
            action = "HOLD"

        if score >= 75 or score <= 25:
            risk = "low"
        elif score >= 60 or score <= 40:
            risk = "medium"
        else:
            risk = "high"

        signals = []
        if rsi is not None:
            if rsi < 30:
                signals.append("RSI quá bán")
            elif rsi > 70:
                signals.append("RSI quá mua")
        if macd is not None and macd > 0:
            signals.append("MACD tăng")
        if mom is not None and mom > 0:
            signals.append("momentum dương")
        if pct_sma20 is not None and pct_sma20 > 0:
            signals.append("giá trên SMA20")
        if whale_net is not None and whale_net > 0:
            signals.append("cá voi mua ròng")

        synthesis = "; ".join(signals) if signals else "Không có tín hiệu nổi bật"
        synthesis = f"{synthesis} → {action}"

        return {
            "ai_score_0_100": score,
            "strategy_action": action,
            "risk_level": risk,
            "synthesis_text": synthesis,
        }
    except Exception:
        return None
