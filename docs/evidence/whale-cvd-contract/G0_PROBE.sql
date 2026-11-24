\echo === G0-1: IntradayTick price unit + UNKNOWN ratio (last 7 days) ===
SELECT source,
       count(*) AS n,
       min(price) AS min_price,
       round(avg(price), 2) AS avg_price,
       max(price) AS max_price,
       sum(CASE WHEN upper(side) = 'UNKNOWN' THEN 1 ELSE 0 END) AS unknown_n
FROM market_data_intraday_tick
WHERE timestamp >= now() - interval '7 days'
GROUP BY source
ORDER BY n DESC;

\echo === G0-2: WhaleAlertCanonical writer prefixes ===
SELECT CASE
         WHEN a.source_ref LIKE 'whale_tick:%' THEN 'whale_tick'
         WHEN a.source_ref LIKE 'tick_session:%' THEN 'tick_session'
         WHEN a.source_ref LIKE 'order_flow:%' THEN 'order_flow'
         WHEN a.source_ref IS NULL OR a.source_ref = '' THEN 'empty'
         ELSE 'other'
       END AS prefix,
       count(*) AS n,
       min(w.executed_at) AS min_executed_at,
       max(w.executed_at) AS max_executed_at,
       count(*) FILTER (WHERE w.matched_value >= 5000000000) AS clamp_5b_n
FROM signal_intelligence_whalealertcanonical w
JOIN signal_intelligence_unifiedalert a ON a.id = w.alert_id
GROUP BY 1
ORDER BY n DESC;

\echo === G0-3: per-symbol/session matched_value by prefix (CVD double-count check) ===
SELECT w.symbol, w.session_date,
       sum(w.matched_value) FILTER (WHERE a.source_ref LIKE 'whale_tick:%') AS per_tick_vnd,
       sum(w.matched_value) FILTER (WHERE a.source_ref LIKE 'tick_session:%' OR a.source_ref LIKE 'order_flow:%') AS aggregate_vnd,
       count(*) AS rows_total
FROM signal_intelligence_whalealertcanonical w
JOIN signal_intelligence_unifiedalert a ON a.id = w.alert_id
WHERE w.session_date >= current_date - 3
GROUP BY w.symbol, w.session_date
HAVING count(*) > 0
ORDER BY aggregate_vnd DESC, per_tick_vnd DESC
LIMIT 12;
