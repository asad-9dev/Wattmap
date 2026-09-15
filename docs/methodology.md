# Methodology

The authoritative, reader-facing version is the in-app `/methodology` page (`app/methodology/page.tsx`). This file maps each concept to the code and tests that implement it.

| Concept | Formula / rule | Code | Tests |
| --- | --- | --- | --- |
| EUI | total site energy (GJ) ÷ floor area (m²); null unless energy ≥ 0 and area > 0 | `lib/analytics/metrics.ts` `energyUseIntensity` | `tests/unit/metrics.test.ts` |
| Energy-equivalent kWh | EUI × 277.78 (1 GJ = 1000/3.6 kWh), labelled ekWh | `toKwhEquivalent` | same |
| GHG / electricity / gas intensity | quantity ÷ floor area; gas only from reported GJ | `ghgIntensity`, `electricityIntensity`, `naturalGasIntensity` | same |
| Peer selection | same year, operation category, school level; floor area 0.67–1.5× (+ hours ±25%), relaxed to 0.5–2×, 0.33–3×, any; first stage with ≥ 20 peers, else most specific with ≥ 10 | `lib/analytics/peers.ts` `selectPeers`, `PEER_STAGES` | `tests/unit/peers.test.ts` |
| Plausibility bounds | EUI outside 0.05–5 GJ/m² or GHG > 500 kg CO₂e/m² → `implausible_intensity` (from the observed distribution: median EUI ≈ 0.6, p99.9 ≈ 5) | `scripts/ingest/run.py` `quality_flags` | `tests/ingest/test_pipeline.py` |
| Peer exclusions | records flagged implausible, negative energy, duplicate, non-positive area, zero total with consumption, unrecognized unit | `lib/analytics/rebuild.ts` `EXCLUDED_FROM_PEERS` | `tests/unit/rebuild.test.ts` |
| Totals | provincial and board sums leave out `implausible_intensity` records and report how many were excluded | `lib/db/queries/overview.ts` `plausibleRecord` | `tests/integration/queries.test.ts` |
| Percentile | 100 × (below + ½ equal) ÷ n; higher = more energy per m² | `lib/analytics/stats.ts` `percentileRank` | `tests/unit/stats.test.ts` |
| Quantiles | linear interpolation (type 7) | `quantile` | same |
| Trend | OLS slope of EUI on year ÷ mean EUI, over the latest 3–5 valid non-pandemic years | `lib/analytics/score.ts` `recentTrend` | `tests/unit/score.test.ts` |
| Trend factor | clamp((trend % + 10) ÷ 20, 0, 1) | `trendFactor` | same |
| Opportunity Score | round(100 × (0.8 P + 0.2 trend_factor)); P alone without a trend; suppressed with < 10 peers or blocking flags | `opportunityScore` | same |
| Score confidence | points: peers ≥ 20 (+2) else +1; trend (+2); match ≥ 0.95 (+1); missing fields (−1); ≥ 5 High, ≥ 3 Medium, else Low | `opportunityScore` | same |
| Energy gap | max(0, EUI − peer median) × floor area | `energyGapToPeerMedian` | `tests/unit/metrics.test.ts` |
| Robust z | 0.6745 (x − median) ÷ MAD; MAD = 0 → (x − median) ÷ (1.2533 × mean AD); identical peers → 0 or null | `robustZ` | `tests/unit/stats.test.ts` |
| Anomaly labels | z < 2 typical, < 3.5 elevated, ≥ 3.5 unusually high; ≥ 10 peers | `lib/analytics/anomaly.ts` | `tests/unit/score.test.ts` |
| Year-over-year | consecutive years only; > 30% flagged; pandemic years marked | `yearOverYearChanges` | same |
| School-year combination | facilities matched to one school are summed per year; any missing part makes the sum unknown | `combineEntityYears`, `lib/analytics/series.ts` | `tests/unit/rebuild.test.ts`, `series.test.ts` |
| Data confidence | limiting → Limited; caution → Medium; otherwise High; reasons always listed | `lib/analytics/confidence.ts` | `tests/unit/confidence.test.ts` |

## Raw vs normalized

Benchmarks, trends, and scores use raw site energy, the only measure available every year. Weather-normalized site energy (2021+, where reported) is shown as a separate chart series. The 2011–2020 normalized workbook (eWh/HDD/ft²) is not used; see `docs/data-dictionary.md`.

## Pandemic years

2020 and 2021 are shaded on charts, excluded from trend fits, and flagged `pandemic_affected_period`. Pre-2021 files do not state their reporting period, so the boundary of the disruption is uncertain and this is stated on the methodology page.
