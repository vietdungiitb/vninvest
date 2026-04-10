# Sprint 34 API & Data Contract

Status: FROZEN FOR IMPLEMENTATION
Sprint: 34
Scope: A1 + A2 + B1

## 1) Contract goals

1. Deterministic identity for whale/dark-flow related aggregate events.
2. Stable cursor semantics across redis_stream, intraday_tick_db, vnstock fallback.
3. Backward-compatible response shape for existing FE consumers where feasible.

## 2) Aggregate feed response contract (v2 semantics)

### 2.1 Top-level fields

Required:
1. results: array
2. has_more: boolean
3. next_cursor: string|null
4. source: string
5. filters: object
6. entitlements: object

Optional but recommended:
1. weights_version: string
2. fetched_at: string (ISO8601)

### 2.2 Event-level fields

Required:
1. event_id: string
2. symbol: string (uppercase)
3. ts: string (ISO8601)
4. matched_value: number
5. side: string
6. threshold: number
7. threshold_source: string (user_default|symbol_override)
8. source: string

Optional:
1. severity: string
2. event_score: number
3. display_score: number
4. size_class: string

## 3) Deterministic identity rules

1. event_id must be stable for the same logical event across repeated reads.
2. event_id must not depend on per-request synthetic counters.
3. event_id composition should include stable dimensions only:
- source layer key
- symbol
- occurred timestamp
- side
- matched_value bucket or raw numeric representation as defined by implementation

## 4) Cursor semantics

1. next_cursor is null when has_more=false.
2. next_cursor is non-null when has_more=true.
3. Cursor replay within short window must preserve deterministic ordering.
4. Invalid cursor payload must return validation error, not silent fallback.

## 5) Sorting and tie-break policy

1. Primary sort keys:
- ts (desc) OR matched_value (desc) depending on requested sort
2. Secondary tie-break must be deterministic and source-agnostic.
3. No synthetic row id tie-break generated per request.

## 6) Source parity requirements

1. Contract keys must be present regardless of source.
2. Missing source-specific values should degrade gracefully using defined defaults.
3. Parity matrix must be maintained in QA evidence.

## 7) Backward compatibility policy

1. Existing FE fields should remain available unless deprecation approved.
2. New fields can be additive.
3. Any breaking field change requires explicit migration note and FE alignment.

## 8) Validation matrix (minimum)

1. 5-page traversal (ts sort): no duplicate/missing.
2. 5-page traversal (matched_value sort): no duplicate/missing.
3. cursor replay test: stable ordering.
4. invalid cursor test: explicit error.
5. source switch test (stream -> db fallback): contract parity maintained.

## 9) Acceptance criteria

1. A2 gate passes contract/paging regression.
2. QA sign-off confirms parity matrix.
3. FE confirms no parser break on staging.
