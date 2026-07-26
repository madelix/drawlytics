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

---

## Confirmed roadmap

### Critical correctness

- [ ] Support multiple UK Lotto draws on the same calendar date.
- [ ] Stop using draw date as a unique draw identity.
- [ ] Display every official UK Lotto result in Draw History.
- [ ] Check eligible predictions against both same-date draws.
- [ ] Recalculate any analytics affected by omitted draw records.

### Foundation cleanup

- [ ] Centralise model metadata.
- [ ] Centralise model colours.
- [ ] Extract model personality logic from the Performance page.
- [ ] Remove duplicated model descriptions from Strategy Builder.
- [ ] Standardise evidence, confidence and sample-maturity terminology.
- [ ] Create reusable metric and evidence display components.
- [ ] Audit responsive behaviour across every main page.

### Model Registry and profiles

- [x] Registry API.
- [x] Registry page.
- [x] Individual model routes.
- [x] Static model profiles.
- [x] Live model performance.
- [x] Model-specific evidence.
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
- [ ] Separate genuine ML implementations from heuristic simulations.
- [ ] Introduce actual retraining only where technically justified.

### Accounts and user dashboard

- [ ] User authentication.
- [ ] User-specific predictions.
- [ ] User-specific played status.
- [ ] User-specific saved strategies.
- [ ] User-specific experiments.
- [ ] Personal dashboard.
- [ ] Personal performance history.
- [ ] Subscription or usage-tier preparation.
- [ ] Privacy and data-deletion controls.
- [ ] Migrate existing anonymous data safely.

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
- [ ] Inspect the UK Lotto table for same-date rows.
- [ ] Audit database uniqueness constraints.
- [ ] Introduce a stable draw identifier or sequence.
- [ ] Correct the Draw History API and page.
- [ ] Correct prediction result checking.
- [ ] Correct historical analysis calculations.
- [ ] Recalculate affected model-performance statistics.
- [ ] Add regression tests covering two draws on one date.
