import { useEffect, useMemo, useState } from 'react';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';

const SCORING_POLICY_VERSION = 'ai-advisor-scoring-v1';

const SCORING_POLICY_REGISTRY = {
  conservative: {
    rsiTrim: 70,
    rsiBuild: 35,
    weightMax: 20,
    maDistMax: 5,
    buildThreshold: 3.5,
    trimThreshold: -3.5,
    rsiScore: 3,
    ma20Score: 1.5,
    whaleScore: 2,
    overweightPenalty: 4,
  },
  balanced: {
    rsiTrim: 65,
    rsiBuild: 45,
    weightMax: 15,
    maDistMax: 8,
    buildThreshold: 3.5,
    trimThreshold: -3.5,
    rsiScore: 3,
    ma20Score: 1.5,
    whaleScore: 2,
    overweightPenalty: 4,
  },
};

function resolveScoringPolicy(strategy) {
  return SCORING_POLICY_REGISTRY[strategy] || SCORING_POLICY_REGISTRY.balanced;
}

// Default config similar to StockDetail's _getDefaultPromptConfig
const DEFAULT_AI_CONFIG = {
  sources: {
    whale:       { enabled: true,  lookback: 180 },
    dark_flow:   { enabled: true,  lookback: 90 },
    technical:   { enabled: true,  lookback: 30, indicators: ['rsi', 'ma20', 'vols'] },
    news:        { enabled: true,  lookback: 14 },
  },
  scoring_policy_version: SCORING_POLICY_VERSION,
};

export default function useAIAdvisor({ holdings, watchlist, technicals, alerts, strategy = 'conservative', enabled = true }) {
  const [aiConfig, setAiConfig] = useState(DEFAULT_AI_CONFIG);

  useEffect(() => {
    let cancelled = false;

    async function loadAiConfig() {
      try {
        const response = await coreApiAdapter.getAICommandCenterConfig();
        if (cancelled) return;
        const promptConfig = response?.ai_prompt_config || response?.prompt_config || {};
        setAiConfig({
          ...DEFAULT_AI_CONFIG,
          ...(promptConfig || {}),
        });
      } catch {
        if (!cancelled) {
          setAiConfig(DEFAULT_AI_CONFIG);
        }
      }
    }

    loadAiConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const strategyParams = useMemo(() => {
    return resolveScoringPolicy(strategy);
  }, [strategy]);

  const recommendations = useMemo(() => {
    if (!enabled || !technicals) return [];

    const holdingMap = Object.create(null);
    const allSymbolsSet = new Set();
    (holdings || []).forEach((holding) => {
      const symbol = String(holding?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      holdingMap[symbol] = holding;
      allSymbolsSet.add(symbol);
    });

    (watchlist || []).forEach((item) => {
      const symbol = String(item?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      allSymbolsSet.add(symbol);
    });

    const techs = Object.create(null);
    (technicals || []).forEach((technical) => {
      const symbol = String(technical?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      techs[symbol] = technical;
    });

    const whaleAlertCounts = Object.create(null);
    (alerts || []).forEach((alert) => {
      const symbol = String(alert?.symbol || '').trim().toUpperCase();
      if (!symbol) return;
      whaleAlertCounts[symbol] = (whaleAlertCounts[symbol] || 0) + 1;
    });

    const totalValue = (holdings || []).reduce((sum, item) => sum + (item.marketValue || item.market_value || 0), 0);
    const sourceCfg = aiConfig.sources;

    return Array.from(allSymbolsSet).map(symbol => {
      const h = holdingMap[symbol];
      const tech = techs[symbol] || {};
      const rsi = tech.rsi_14;
      const ma20Dist = tech.ma20_dist_pct;
      const mVal = h ? (h.marketValue || h.market_value || 0) : 0;
      const weight = (h && mVal > 0 && totalValue > 0) ? (mVal / totalValue * 100) : 0;
      const whaleCount = whaleAlertCounts[symbol] || 0;

      let score = 0; 
      let reasons = [];
      let logics = [];

      // 1. Technical Analysis
      if (sourceCfg.technical?.enabled) {
        const indicators = sourceCfg.technical.indicators || [];
        
        if (indicators.includes('rsi') && rsi != null) {
          if (rsi > strategyParams.rsiTrim) {
            score -= strategyParams.rsiScore;
            reasons.push(`RSI quá nóng (${rsi.toFixed(0)})`);
            logics.push("Vùng quá mua (Overbought) rủi ro điều chỉnh.");
          } else if (rsi < strategyParams.rsiBuild) {
            score += strategyParams.rsiScore;
            reasons.push(`Vùng giá rẻ (RSI ${rsi.toFixed(0)})`);
            logics.push("Vùng quá bán (Oversold) tiềm năng hồi phục.");
          }
        }

        if (indicators.includes('ma20') && ma20Dist != null) {
          if (ma20Dist > strategyParams.maDistMax) {
            score -= strategyParams.ma20Score;
            reasons.push(`Cách xa MA20 (${ma20Dist.toFixed(1)}%)`);
            logics.push("Giá đang hưng phấn quá mức so với trung bình.");
          } else if (ma20Dist < -strategyParams.maDistMax) {
            score += strategyParams.ma20Score;
            reasons.push(`Chiết khấu tốt so với MA20`);
            logics.push("Giá đã điều chỉnh sâu về vùng hỗ trợ kỹ thuật.");
          }
        }
      }

      // 2. Whale Flow
      if (sourceCfg.whale?.enabled && whaleCount > 0) {
        score += (whaleCount * strategyParams.whaleScore);
        reasons.push(`Phát hiện ${whaleCount} lệnh Cá mập`);
        logics.push("Dòng tiền thông minh đang hoạt động mạnh.");
      }

      // 3. Portfolio Management (Only for holdings)
      if (h && weight > strategyParams.weightMax) {
        score -= strategyParams.overweightPenalty;
        reasons.push(`Tỷ trọng quá cao (${weight.toFixed(1)}%)`);
        logics.push("Quản trị rủi ro: Giảm mức độ tập trung tài sản.");
      }

      let action = 'HOLD';
      if (score >= strategyParams.buildThreshold) action = 'BUILD';
      else if (score <= strategyParams.trimThreshold) action = 'TRIM';

      // Special case: If not in holdings, only report BUILD
      if (!h && action === 'TRIM') action = 'HOLD';

      return {
        symbol,
        action,
        reason: reasons.join(' & '),
        algoLogic: logics.join(' '),
        weight,
        rsi,
        tech,
        score,
        isNewOpportunity: !h && action === 'BUILD'
      };
    }).filter(r => r.action !== 'HOLD')
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 4);
  }, [enabled, holdings, watchlist, technicals, aiConfig, strategyParams, alerts]);

  return {
    recommendations,
    aiConfig
  };
}
