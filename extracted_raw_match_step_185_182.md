Created At: 2026-05-22T03:32:33Z
Completed At: 2026-05-22T03:32:36Z

				The command completed successfully.
				Output:
				<truncated 1 lines>
Found 'vnstockcharts' in module_tree_full.md!
`, `topCount`, `val`, `values`, `visibleBars`, `whaleScore`, `x`, `y`

### `frontend/src/components/vnstockcharts/csv.d.ts`

- Top-level variables:
  - `content`

### `frontend/src/components/vnstockcharts/d3-format.d.ts`

- Functions:
  - `format`, `timeFormat`

### `frontend/src/components/vnstockcharts/demo/__tests__/chartRange.test.ts`

- Functions:
  - `buildBars`
- Top-level variables:
  - `data`

### `frontend/src/components/vnstockcharts/demo/__tests__/demoData.test.ts`

- Functions:
  - `makeResponse`
- Top-level variables:
  - `bars`, `currentBars`, `fetchMock`, `firstPage`, `merged`, `olderBars`, `secondPage`

### `frontend/src/components/vnstockcharts/demo/__tests__/heikinAshi.test.ts`

- Functions:
  - `makeBar`
- Top-level variables:
  - `bars`, `expectedSecondOpen`, `firstClose`, `input`, `result`, `secondClose`, `snapshot`

### `frontend/src/components/vnstockcharts/demo/__tests__/historyFetchQueue.test.ts`

- Top-level variables:
  - `job`, `q`

### `frontend/src/components/vnstockcharts/demo/__tests__/historySchedulerPolicy.test.ts`

- No parseable top-level symbols found

### `frontend/src/components/vnstockcharts/demo/__tests__/historyWindowPlanner.test.ts`

- Top-level variables:
  - `data`, `loaded`, `next`, `previous`, `result`, `seg`, `target`, `viewport`, `window`

### `frontend/src/components/vnstockcharts/demo/__tests__/i18n.test.tsx`

- Functions:
  - `DemoI18nProbe`
- Top-level variables:
  - `DemoI18nBoundary`, `act`, `container`, `createRoot`, `originalConsoleError`, `probe`, `reactActEnvironment`, `root`, `setLanguageForTest`, `useDemoI18n`

### `frontend/src/components/vnstockcharts/demo/__
<truncated 468 bytes>
nd/src/components/vnstockcharts/demo/__tests__/PATTokenModal.test.tsx`
<truncated 4228 bytes>
(encoding='utf-8')\n\ntranscript_path = r\"C:\\Users\\Pham Viet Dung\\.gemini\\antigravity\\brain\\66c8619d-730d-40b4-af81-035b594ac189\\.system_generated\\logs\\transcript.jsonl\"\n\nprint(\"Scanning transcript.jsonl recursively for any MODEL responses containing 'vnstockcharts' or 'smart money flow' or 'vietdungiitb'...\")\nmatches = []\n\nwith open(transcript_path, 'r', encoding='utf-8', errors='ignore') as f:\n    for i, line in enumerate(f):\n        if \"vnstockcharts\" in line.lower() or \"vietdungiitb\" in line.lower() or \"smart money flow\" in line.lower() or \"klinecharts\" in line.lower():\n            try:\n                data = json.loads(line)\n                step_idx = data.get(\"step_index\")\n                source = data.get(\"source\")\n                type_ = data.get(\"type\")\n                \n                # Check for content, thinking, or nested fields in tool_calls\n                def check_content(obj):\n                    if isinstance(obj, str):\n                        if \"giới thiệu tổng quan\" in obj.lower() or \"vnstockcharts\" in obj.lower() or \"smart money flow\" in obj.lower():\n                            return obj\n                    elif isinstance(obj, dict):\n                        for k, v in obj.items():\n                            res = check_content(v)\n                            if res:\n                                return res\n                    elif isinstance(obj, list):\n                        for item in obj:\n                            res = check_content(item)\n                            if res:\n                                return res\n                    return None\n                \n                matched_text = check_content(data)\n                if matched_text:\n                    matches.append((i, step_idx, source, type_, matched_text))\n            except Exception:\n                pass\n\nprint(f\"\\nFound {len(matches)} matches
<truncated 466 bytes>

============================================================

