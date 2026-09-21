# XGBoost v2 — EuroMillions Validation

Status: Frozen experimental model

## Scope

Lottery: EuroMillions  
Model: xgboost_v2  
Evaluation method: chronological walk-forward  
Evaluation draws: 1,953

Each evaluated draw was predicted using only draws that occurred
before the target draw.

## Main Numbers

Total hits: 975  
Average hits per draw: 0.4992  
Random expected hits per draw: 0.5000  
Performance vs random: 0.9985x

Conclusion: main-number performance was effectively random.

## Lucky Stars

Total hits: 754  
Average hits per draw: 0.3861  
Random expected hits per draw: 0.3624  
Performance vs random: 1.0654x

## Hot-Star Baseline

Total hits: 698  
Average hits per draw: 0.3574  
Performance vs random: 0.9863x

XGBoost vs Hot-Star: 1.0802x

## Random Simulation

Simulations: 100,000  
XGBoost observed hits: 754  
Random mean hits: 707.66  
Random standard deviation: 22.76  
Random 95th percentile: 745  
Random 99th percentile: 761  
Random simulations equal to or better than XGBoost: 2,197  
Empirical p-value: 0.02198

## Lucky Star Era Breakdown

### 2004–2011

Draws: 357  
XGBoost hits: 163  
Random expected: 158.67  
Performance vs random: 1.0273x

### 2011–2016

Draws: 562  
XGBoost hits: 221  
Random expected: 204.36  
Performance vs random: 1.0814x

### 2016–present

Draws: 1,034  
XGBoost hits: 370  
Random expected: 344.67  
Performance vs random: 1.0735x

## Interpretation

XGBoost v2 showed no measurable advantage for EuroMillions main
numbers.

The Lucky Star model produced more matches than both the
date-adjusted random expectation and a simple historical Hot-Star
baseline in this historical walk-forward evaluation.

This is evidence of historical out-of-sample performance, not proof
that future EuroMillions draws are predictable.

The model is frozen at this point so that future benchmark results
can provide genuinely unseen prospective evidence.

## Deployment Decision

XGBoost v2 is currently validated for EuroMillions only.

The existing JavaScript heuristic labelled XGBoost should be retired.

XGBoost should not be offered for UK Lotto or Set For Life until
separate real models have been trained and walk-forward validated
for those lotteries.
