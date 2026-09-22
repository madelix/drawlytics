# Drawlytics Blueprint

## Product purpose

Drawlytics is a lottery analytics and strategy-testing platform.

Its purpose is not to claim that lottery outcomes can be reliably predicted.
It allows users to:

- explore historical lottery data,
- generate predictions using different strategies,
- compare model performance,
- test whether apparent advantages survive statistical scrutiny,
- understand how each model works,
- track saved and played predictions honestly over time.

---

## Core product principles

### Strategy testing, not prediction claims

Drawlytics should present its models as experimental strategies whose results
are measured against real draws and a Pure Random baseline.

### Statistical honesty

The platform must distinguish between:

- an observed advantage,
- a reliable sample,
- statistical support,
- and a genuinely validated result.

### One source of truth

Model names, descriptions, categories, colours, implementation status and
personality logic should not be duplicated across pages.

### Global analytics and personal data are separate

Drawlytics must distinguish between platform-level benchmark data and
user-owned prediction data.

Global analytics include:

- Model Registry evidence,
- Model Profiles,
- Performance,
- Honesty,
- model rankings and comparisons.

These must ultimately be calculated from a canonical Drawlytics-controlled
benchmark dataset so that every user sees the same platform-level evidence.

Personal data includes:

- My Predictions,
- played status,
- saved prediction history,
- future My Performance,
- future user-specific experiments and strategies.

Personal prediction activity must not change Drawlytics' global claims about
which models perform best or whether a model has demonstrated evidence beyond
Pure Random.

This separation is now enforced for the core global benchmark path.

Canonical benchmark predictions are explicitly marked with
`benchmark_eligible = true`, while new normal user-generated predictions remain
personal and are excluded from canonical benchmark evidence.

The benchmark is generated independently of whether a user chooses to save or
play a prediction. Drawlytics can therefore continue testing strategies and
models automatically without personal prediction activity affecting
platform-level evidence.

The initial legacy benchmark seed still requires a historical audit, and the
remaining Honesty and Model Profile evidence queries must be verified as
benchmark-only.

### Clear page ownership

Each page should answer a distinct user question and avoid reproducing another
page's full functionality.

---

## Current page ownership

### Draws

**Question:** What were the official historical draw results?

Owns:

- historical draw records,
- lottery filtering,
- pagination,
- official main and special numbers.

Must not own:

- frequency analysis,
- model rankings,
- prediction management.

### Analysis

**Question:** Which numbers are historically hot, cold or frequent?

Owns:

- frequency distributions,
- hot and cold numbers,
- historical analysis windows,
- number-frequency charts.

Must not own:

- gap rankings,
- prediction generation,
- model performance.

### Gaps

**Question:** Which numbers have been absent for the longest?

Owns:

- overdue numbers,
- last-seen information,
- gap rankings,
- gap charts.

Must not own:

- general frequency analysis,
- model evidence.

### Strategy

**Question:** How can I generate and save strategy-based predictions?

Owns:

- lottery selection,
- model and strategy selection,
- line allocation,
- multi-strategy generation,
- suggested strategy mix,
- saving predictions.

Must not own:

- full model documentation,
- rankings,
- statistical validation.

### Models

**Question:** What models exist, and how does each one work?

Owns:

- model registry,
- individual model profiles,
- purpose and implementation explanation,
- learning status,
- strengths and limitations,
- model-specific evidence,
- version and experiment history.

Must not own:

- a second league table,
- broad multi-model comparison,
- strategy generation.

### Performance

**Question:** Which models are currently performing best?

Owns:

- league table,
- average-hit rankings,
- upside and jackpot potential,
- consistency,
- baseline performance,
- safe, balanced and aggressive ranking modes,
- model trends,
- performance history,
- portfolio recommendations,
- model personality classification.

Must not own:

- long model documentation,
- global statistical-honesty conclusions.

### Honesty

**Question:** Is the apparent model advantage genuinely supported by evidence?

Owns:

- current evidence leader,
- overall trust score,
- evidence maturity,
- Pure Random comparison,
- bootstrap analysis,
- confidence intervals,
- leader stability,
- evidence findings,
- transparent methodology.

Must not own:

- model implementation documentation,
- prediction generation,
- another general league table.

### My Predictions

**Question:** What predictions have I saved or played, and how did they perform?

Owns:

- saved predictions,
- draw grouping,
- result checking,
- played status,
- hit highlighting,
- deleting and selecting predictions,
- usage limits.

Must not own:

- model comparison,
- historical-number analysis.

---

## Existing major systems

### Prediction Engine

Generates predictions for supported lotteries and strategies.

### Prediction Tracker

Stores predictions, their target draws, source, status and checked results.

### Performance Engine

Calculates model averages, consistency, upside, baseline wins and trends.

### Evidence Engine

Calculates evidence scores from sample size, performance gap, stability and
bootstrap results.

### Bootstrap Engine

Resamples model and Pure Random results to estimate support and confidence
intervals.

### Finding Engine

Produces plain-language observations about sample size, baseline performance,
stability and statistical evidence.

### Model Registry

Provides canonical model identity, descriptions, status, implementation type,
strengths and limitations.

### Canonical Benchmark Runner

Automatically generates controlled benchmark predictions independently of
personal user activity.

Canonical benchmark predictions use dedicated benchmark provenance and
`benchmark_eligible = true`.

The benchmark runner is idempotent, so repeated runs do not create duplicate
benchmark evidence for the same strategy and target draw.

### Benchmark Lifecycle

Runs automatically on Railway and manages the ongoing benchmark process.

It:

- generates canonical benchmark predictions for supported lotteries,
- checks benchmark predictions only when an official result exists,
- keeps benchmark evidence separate from personal predictions,
- uses only historical draws before the target draw when generating predictions,
- allows long-term model and strategy evidence to accumulate without users
  having to save predictions manually.

### XGBoost v2 ML Benchmark Runner

Runs the first genuinely trained Drawlytics machine-learning model
prospectively for EuroMillions.

XGBoost v2:

- trains only on draws before the target draw,
- uses chronological, no-lookahead data,
- has the distinct model identity `xgboost_v2`,
- remains separate from `Legacy XGBoost (Heuristic)`,
- saves canonical predictions with `source = benchmark_ml_runner`,
- saves predictions with `benchmark_eligible = true`,
- is evaluated by the existing benchmark result-checking lifecycle.

---

## Confirmed roadmap

### Critical correctness

- [x] Support multiple UK Lotto draws on the same calendar date.
- [x] Update UK Lotto prediction checking so one ticket is evaluated against both official draws on the same date.
- [x] Stop using draw date as a unique draw identity.
- [x] Display every official UK Lotto result in Draw History.
- [x] Check eligible predictions against both same-date draws.
- [x] Recalculate any analytics affected by omitted draw records.
- [ ] Display both UK Lotto draw results together when viewing a prediction.

### Foundation cleanup (completed)

- [x] Centralise model colours.
- [x] Remove duplicated model descriptions from Strategy Builder.
- [x] Strategy Builder consumes the canonical Model Registry.

### Foundation cleanup (remaining)

- [x] Centralise model display names and key normalisation.
- [ ] Centralise remaining model metadata.
- [x] Extract model personality logic from the Performance page.
- [x] Standardise evidence, confidence and sample-maturity terminology.
- [ ] Create reusable metric and evidence display components.
- [ ] Audit responsive behaviour across every main page.

### Model Registry and profiles

- [x] Registry API.
- [x] Registry page.
- [x] Individual model routes.
- [x] Static model profiles.
- [x] Live model performance.
- [x] Model-specific evidence.
- [x] Registry API adopted by Strategy Builder.
- [ ] Canonical model personality.
- [ ] Known biases and failure modes.
- [ ] Version history.
- [ ] Experiment/change log.
- [ ] Planned improvements.
- [ ] Links into the full Performance history view.
- [ ] Audit every model description against its actual implementation.

### Model Performance

- [x] Model League Table.
- [x] Multiple ranking modes.
- [x] Performance history.
- [x] Pure Random comparison.
- [x] Consistency and upside metrics.
- [x] Jackpot-potential metric.
- [x] Safe, balanced and aggressive strategy modes.
- [x] Suggested strategy portfolio.
- [x] Model personality categories.
- [ ] Move derived analytics into reusable backend services.
- [ ] Replace browser-local rank comparisons with persisted historical data.
- [ ] Improve long-term performance-vs-random reporting.
- [ ] Build the Benchmark Observatory / Model League around canonical benchmark evidence.
- [ ] Show benchmark sample size prominently for every model and strategy.
- [ ] Show prospective-only performance separately from legacy historical evidence.
- [ ] Distinguish Strategies, Trained Models, Meta/Portfolio systems and Controls.
- [ ] Add within-lottery Pure Random comparisons and observed-vs-expected reporting.
- [ ] Show recent versus long-term benchmark performance.
- [ ] Surface high-hit and high-upside result frequency.
- [ ] Make benchmark evidence explorable without relying on My Predictions.
- [ ] Keep XGBoost v2 evidence completely separate from Legacy XGBoost (Heuristic).

### Model Honesty

- [x] Evidence score.
- [x] Bootstrap support.
- [x] Confidence interval.
- [x] Pure Random comparison.
- [x] Statistical interpretation.
- [x] Evidence findings.
- [ ] Full methodology explanation.
- [ ] Evidence-quality ranking across models.
- [ ] Long-term honesty dashboard.
- [ ] Persist evidence history for trend analysis.
- [ ] Define requirements for moving from provisional to validated.

### Strategy testing

- [x] Single-strategy generation.
- [x] Multi-strategy generation.
- [x] Generate all AI-labelled models.
- [x] Suggested strategy mix.
- [ ] Named strategy experiments.
- [ ] Save experiment configuration.
- [ ] Compare experiment results.
- [ ] Re-run an experiment using the same settings.
- [x] Separate genuine ML implementations from heuristic simulations.
- [x] Introduce the first genuinely trained model: XGBoost v2 for EuroMillions.
- [x] Retire the legacy XGBoost heuristic from future benchmark generation while preserving its historical evidence.
- [ ] Audit remaining AI-labelled models and strategies against their actual implementations.
- [ ] Fix strategies that currently fall through to random generation rather than implementing their advertised logic.
- [ ] Add additional genuinely trained models only where technically justified.

### Global benchmark and personal prediction separation

- [x] Define the canonical Drawlytics benchmark dataset.
- [x] Add explicit `benchmark_eligible` classification.
- [x] Separate new canonical benchmark predictions from user-owned predictions.
- [x] Ensure core global Performance queries use only canonical benchmark data.
- [x] Ensure benchmark leaderboard history uses only canonical benchmark data.
- [x] Prevent new user-generated predictions from becoming benchmark evidence.
- [x] Preserve personal prediction results for future My Performance analytics.
- [x] Add an automated canonical benchmark runner.
- [x] Add an automated benchmark checking lifecycle.
- [x] Make benchmark generation idempotent.
- [x] Prevent benchmark checking before an exact-date official result exists.
- [x] Use only historical draws before the target draw when generating benchmark predictions.
- [x] Deploy XGBoost v2 as a separate prospective canonical ML benchmark.
- [ ] Complete the audit of Honesty so all global evidence is benchmark-only.
- [ ] Complete the audit of Model Profile evidence so all global evidence is benchmark-only.
- [ ] Audit and classify/freeze the initial legacy benchmark seed.
- [ ] Add tests proving personal predictions cannot alter global analytics.
- [ ] Add database-level uniqueness protection for canonical benchmark identities where appropriate.
- [ ] Remove temporary internal benchmark/ML routes once they are no longer required.

### Accounts, privacy and personal data

- [x] User authentication with Clerk.
- [x] Internal Drawlytics user identity.
- [x] User-specific prediction ownership.
- [x] User-specific prediction history.
- [x] User-specific played status.
- [x] Authenticated prediction generation and saving.
- [x] Hide My Predictions navigation from signed-out visitors.
- [x] Protect direct access to the My Predictions route.
- [x] Migrate the original prediction history to the production Drawlytics account.
- [x] Remove the temporary lifetime saved-prediction limit for beta.
- [ ] User-specific saved strategies.
- [ ] User-specific experiments.
- [ ] Personal dashboard.
- [ ] Personal performance history.
- [ ] Subscription or usage-tier preparation.
- [ ] Privacy and data-deletion controls.
- [ ] Support multiple external authentication identities for one Drawlytics user where required.

### Product and UX

- [ ] Landing-page product explanation.
- [ ] Clear explanation that Drawlytics tests strategies rather than promising
      winning predictions.
- [ ] Consistent empty, loading and error states.
- [ ] Accessibility review.
- [ ] Mobile navigation review.
- [ ] Shared design components.
- [ ] Glossary for statistical terminology.
- [ ] Contextual links between Analysis, Strategy, Models, Performance and
      Honesty.

### Engineering

- [ ] Add automated tests for model-key normalisation.
- [ ] Add tests for evidence calculations.
- [ ] Add tests for bootstrap interpretation.
- [ ] Add tests for performance rankings.
- [ ] Add API response validation.
- [ ] Reduce large page components.
- [ ] Move repeated inline styles into reusable components or CSS.
- [ ] Document database tables and ownership.
- [ ] Add migration and backup procedures.
- [ ] Establish production monitoring and error reporting.
- [ ] Add automated tests for model-key and display-name normalisation.
- [ ] Reconcile Drizzle migration history with the current production database schema.
- [ ] Centralise reusable benchmark and performance SQL and remove remaining duplicated performance queries.
- [ ] Add automated tests for benchmark idempotency.
- [ ] Add automated tests proving benchmark generation cannot use target or future draw data.
- [ ] Add automated tests proving personal predictions cannot affect global benchmark analytics.
- [ ] Add production monitoring for failed benchmark lifecycle and ML cron runs.
- [ ] Define canonical model categories: Strategy, Trained Model, Meta/Portfolio and Control.

## Marketing & Website

- [ ] Redesign the landing page to reflect Drawlytics as a lottery analytics platform rather than a prediction app.
- [ ] Replace the "Live API Preview" with richer product showcases and screenshots.
- [ ] Showcase key features:
  - [ ] Number Analysis
  - [ ] Model Performance
  - [ ] Strategy Builder
  - [ ] Draw History
  - [ ] Model Profiles
- [ ] Add "Why Drawlytics?" section focused on transparency and evidence.
- [ ] Add statistics section (models, historical draws, lotteries supported, etc.).
- [ ] Improve CTA flow beyond "Join Beta".
- [ ] Review SEO copy, metadata and structured content after redesign.

## UK Lotto

- [x] Support multiple UK Lotto draws on the same calendar date.
- [x] Backfill missing second draws (10 Jun 2026 – 22 Jul 2026).
- [x] Evaluate a single UK Lotto prediction against both official draws.
- [ ] Group same-date UK Lotto results into a single card in the Draws page.

---

## Deferred ideas

These remain valid possibilities but should not be built until existing systems
have been checked for overlap:

- historical leader-duration analytics,
- model evolution timeline,
- deeper experiment notebook,
- public model methodology pages,
- user-created strategy sharing,
- notifications for checked predictions,
- exportable performance reports,
- additional supported lotteries.

---

## Decision log

Record important product decisions here so they are not lost in chat.

### 2026-07 — Model Performance owns comparison

The Model Performance page is the canonical location for league tables,
rankings, model comparison, history and strategy recommendations.

### 2026-07 — Model Profiles own explanation

Individual model profiles explain one model's implementation, purpose,
limitations, evidence, evolution and planned improvements.

### 2026-07 — Honesty owns statistical validation

The Honesty page provides the overall conclusion about whether any Drawlytics
model has demonstrated credible performance beyond Pure Random.

### 2026-08 — Canonical model identity

Drawlytics uses canonical model keys and shared display-name normalisation rather
than page-specific model naming.

Model identity should be defined centrally and consumed by Strategy, Models,
Performance and future model-related systems.

### 2026-08 — Global benchmark is separate from personal predictions

Drawlytics distinguishes between platform-level model evidence and
user-owned prediction activity.

Performance, Honesty, Model Profile evidence and global model rankings must
ultimately use a canonical Drawlytics-controlled benchmark dataset.

Predictions generated and saved by individual users belong to their personal
prediction history and must not alter Drawlytics' global claims about model
performance or statistical evidence.

The current implementation does not yet fully enforce this boundary because
global analytics can still consume user-generated prediction results. Separating
these datasets is therefore a beta-readiness requirement.

Personal prediction results should be retained so they can support future
user-specific analytics such as My Performance without contaminating the
global benchmark.

### 2026-09 — Canonical benchmark runs independently of personal activity

Users do not need to save or play predictions in order for Drawlytics to test
a strategy or model.

The canonical benchmark automatically generates controlled predictions,
records them separately from personal activity and checks them after official
results become available.

Personal use of Make Magic therefore has no bearing on whether Drawlytics
continues collecting model evidence.

The canonical benchmark is the source for answering the long-term question:

**Are any Drawlytics strategies or models actually performing beyond random
chance?**

### 2026-09 — XGBoost v2 is the first genuinely trained ML benchmark model

`xgboost_v2` is the first genuinely trained machine-learning model deployed
into the prospective Drawlytics benchmark.

It is intentionally distinct from the historical model now labelled
**Legacy XGBoost (Heuristic)**. Historical legacy evidence is preserved but
must never be merged into XGBoost v2 evidence.

Historical chronological walk-forward validation found that XGBoost v2
main-number performance was approximately at random, while Lucky Star
performance showed an observed uplift over both date-adjusted random
expectation and a simple all-history hot-star baseline.

These historical results are exploratory rather than proof of future
predictability. Prospective benchmark evidence is the stronger test.

The first prospective canonical XGBoost v2 prediction was generated for the
EuroMillions draw on **22 September 2026**:

- model: `xgboost_v2`
- prediction ID: `2978`
- main numbers: `11, 17, 19, 29, 50`
- Lucky Stars: `2, 6`
- historical draws before target: `1979`
- source: `benchmark_ml_runner`
- benchmark eligible: `true`

This prediction and all future prospective benchmark results must remain
untouched after generation regardless of outcome.

### 2026-09 — Benchmark Observatory is the next product phase

The next major product task is to make canonical benchmark evidence easy to
inspect without relying on My Predictions.

The Performance / Model League experience should allow users to follow every
controlled strategy and model automatically and understand:

- how many prospective predictions have been tested,
- average main-number and special-number hits,
- high-hit and high-upside result frequency,
- performance versus an appropriate Pure Random baseline,
- recent versus long-term performance,
- sample maturity,
- and whether an apparent advantage survives statistical scrutiny.

The interface must clearly distinguish:

- **Strategies** — rule-based approaches such as hot/cold, overdue,
  statistical, Markov and Bayesian approaches;
- **Trained Models** — genuine fitted ML systems such as XGBoost v2;
- **Meta / Portfolio systems** — Strategy Mix, Ensemble and future
  meta-learners;
- **Control** — Pure Random.

Prospective evidence must be distinguishable from legacy historical evidence,
and sample size must remain visible so small-sample results are not presented
as established performance.

## Critical data-correctness issues

### UK Lotto multiple draws on the same date

UK Lotto can now produce two distinct draw results associated with the same
calendar date. A single played set of numbers may therefore need to be
evaluated against both eligible draws.

The current Drawlytics implementation was designed around the assumption that
one lottery has only one draw result per date. This assumption is no longer
safe.

#### Current known problem

The Draw History page currently displays only one UK Lotto result row when two
draws share the same date.

This is statistically incorrect because:

- one valid draw result is hidden or overwritten,
- frequency calculations may omit a draw,
- gap calculations may use incomplete history,
- model-performance samples may be understated,
- predictions may be checked against only one of the two eligible results,
- grouping predictions by date alone cannot identify the correct draw,
- averages, rankings, bootstrap results and evidence scores may be affected.

#### Required data-model change

Draws must be identified by a unique draw identity rather than by calendar date
alone.

The final design should support fields such as:

- `draw_id`,
- `draw_date`,
- `draw_sequence` or `draw_number`,
- `draw_time` when available,
- `lottery`,
- an official external draw identifier when available.

A uniqueness rule should use the official draw identity or a composite such as:

`lottery + draw_date + draw_sequence`

It must not rely on:

`lottery + draw_date`

#### Required prediction change

A prediction must record which draw or set of eligible draws it applies to.

For UK Lotto entries that participate in both same-date draws, Drawlytics must:

- retain both official results,
- evaluate the prediction against both draws,
- show the result from each draw separately,
- clearly define how model-performance statistics count the two evaluations,
- avoid accidentally treating one purchased line as two independently
  generated predictions.

#### Required frontend changes

- Draw History must show both same-date UK Lotto draw records.
- Same-date draws must have visible distinguishing labels.
- My Predictions must show both result evaluations where applicable.
- Result checking must not use date as the sole lookup key.
- Performance and Honesty pages must count all valid draw evaluations.
- Analysis and Gaps must include both official draw records.

#### Required audit

The following areas must be audited for date-only assumptions:

- database schema and unique constraints,
- UK Lotto import process,
- draw API responses,
- Draw History rendering keys,
- prediction target fields,
- result-checking queries,
- `drawMap` and other frontend lookup maps,
- prediction grouping,
- frequency calculations,
- gap calculations,
- model-performance aggregation,
- bootstrap samples,
- evidence scoring.

#### Status

- [ ] Verify the official naming and identifiers for the two draws.
- [x] Inspect the UK Lotto table for same-date rows.
- [x] Audit database uniqueness constraints.
- [x] Introduce a stable draw identifier or sequence.
- [x] Correct the Draw History API and page.
- [x] Correct prediction result checking.
- [x] Correct historical analysis calculations.
- [x] Recalculate affected model-performance statistics.
- [ ] Add regression tests covering two draws on one date.
