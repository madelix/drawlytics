// server/modelRegistry.js

import { MODEL_REGISTRY as MODEL_METADATA_REGISTRY } from './modelMetadata.js';

const DEFAULT_MODEL_PROFILE = {
  category: 'Experimental strategy',

  learning_status: 'not_learning',

  version: '0.1',

  status: 'experimental',

  summary:
    'This strategy is currently being evaluated through canonical benchmark predictions and checked lottery results.',

  purpose:
    'To test whether its number-selection approach performs differently from a Pure Random baseline.',

  how_it_works:
    'The current implementation applies predefined selection rules to historical draw information. It does not retrain itself from newly checked predictions.',

  strengths: [
    'Produces strategy-specific behaviour.',
    'Can be compared with Pure Random through the canonical benchmark.',
  ],

  limitations: [
    'Current performance may be based on a limited sample.',
    'The strategy is not a genuinely trained machine-learning model.',
    'Lottery draws remain random and no strategy can guarantee improved results.',
  ],
};

const MODEL_PROFILE_OVERRIDES = {
  pure_random: {
    category: 'Baseline control',

    status: 'active',

    summary:
      'Generates combinations without using historical patterns or model-based weighting.',

    purpose:
      'To provide the neutral control against which other Drawlytics strategies and models can be evaluated.',

    how_it_works:
      'Numbers are sampled uniformly from the valid lottery ranges, with duplicates prevented within each prediction.',

    strengths: [
      'Unbiased control for comparison.',
      'Does not fit or react to historical draw patterns.',
      'Simple and transparent.',
    ],

    limitations: [
      'Does not attempt to identify trends or patterns.',
      'Every valid combination remains uncertain.',
    ],
  },

  hot_focused: {
    category: 'Frequency strategy',

    summary:
      'Prioritises numbers that have appeared more frequently in the historical data available before the target draw.',

    purpose:
      'To test whether frequency-weighted selection behaves differently from Pure Random.',

    how_it_works:
      'Historical number frequencies are converted into selection weights, giving more frequently drawn numbers a greater chance of being selected.',

    limitations: [
      'Past frequency does not make a number inherently more likely in the next independent draw.',
      'Performance depends on the historical evidence and weighting rules.',
    ],
  },

  cold_focused: {
    category: 'Frequency strategy',

    summary:
      'Prioritises numbers that have appeared less frequently in the historical data available before the target draw.',

    purpose:
      'To test whether inverse-frequency weighting behaves differently from Pure Random.',

    how_it_works:
      'Historical frequency weights are inverted so less frequently appearing numbers receive greater sampling weight.',

    limitations: [
      'A cold number is not mathematically due to appear.',
      'Performance depends on the historical evidence and weighting rules.',
    ],
  },

  overdue: {
    category: 'Gap strategy',

    summary:
      'Favours numbers that have not appeared for comparatively long periods.',

    purpose:
      'To test whether draw-gap weighting behaves differently from Pure Random.',

    how_it_works:
      'The strategy measures how many draws have elapsed since each number last appeared and gives greater sampling weight to longer gaps.',

    limitations: [
      'A long absence does not increase a number’s mathematical probability.',
      'The strategy must not be interpreted as evidence that an overdue number is due to appear.',
    ],
  },

  balanced_hot_cold: {
    category: 'Hybrid frequency strategy',

    summary:
      'Combines historically more frequent and less frequent numbers within one prediction.',

    purpose:
      'To test whether balancing opposing frequency behaviours differs from focusing on either group alone.',

    how_it_works:
      'The historical number pool is divided into hotter and colder groups, and the prediction samples from both while preserving the required lottery structure.',
  },

  strategy_mix: {
    category: 'Meta / Portfolio system',

    learning_status: 'performance_adaptive',

    status: 'active',

    summary:
      'Builds a prediction portfolio from several Drawlytics strategies using their historical benchmark performance.',

    purpose:
      'To test whether diversification across strategies is more resilient than relying on one method.',

    how_it_works:
      'Drawlytics ranks eligible strategies using benchmark evidence available before the target draw and allocates prediction lines across the selected strategies.',
  },

  ai_xgboost: {
    category: 'Legacy heuristic',

    learning_status: 'not_learning',

    status: 'retired',

    summary:
      'Historical heuristic previously presented as XGBoost. It was not a genuinely trained XGBoost model.',

    purpose:
      'Historical evidence is retained for continuity, but this implementation no longer generates new benchmark predictions.',

    how_it_works:
      'The retired implementation used hand-designed historical weighting rather than fitting an XGBoost model.',

    limitations: [
      'Not genuine XGBoost machine learning.',
      'Retired from future benchmark generation.',
      'Historical results must never be merged with XGBoost v2 evidence.',
    ],
  },

  xgboost_v2: {
    category: 'Trained model',

    learning_status: 'trained',

    version: '2',

    status: 'active',

    summary:
      'A genuinely trained XGBoost model evaluated prospectively through the canonical EuroMillions benchmark.',

    purpose:
      'To test whether fitted machine-learning signals derived strictly from earlier EuroMillions draws perform differently from appropriate random and heuristic baselines.',

    how_it_works:
      'For each target draw, XGBoost v2 trains on historical draws strictly before that target. It builds number-level features such as long-term frequency, recent frequency, draw gaps and momentum, then ranks candidate main numbers and Lucky Stars.',

    strengths: [
      'Uses a genuine fitted machine-learning model.',
      'Uses chronological no-lookahead training data.',
      'Has a separate identity from Legacy XGBoost (Heuristic).',
      'Collects untouched prospective benchmark evidence.',
    ],

    limitations: [
      'Currently implemented only for EuroMillions.',
      'Historical main-number performance was approximately consistent with random expectation.',
      'Historical Lucky Star uplift remains exploratory rather than proof of future predictability.',
      'Lottery draws remain random and the model cannot guarantee improved results.',
    ],
  },

  ai_advanced_analysis: {
    category: 'Legacy strategy',

    status: 'legacy',

    summary:
      'A historical Drawlytics identity whose original implementation has not yet been fully classified.',

    purpose:
      'To preserve historical identity until the legacy implementation and evidence have been audited.',

    how_it_works:
      'The implementation has not yet been sufficiently audited to describe it more specifically without speculation.',

    limitations: [
      'Implementation classification is incomplete.',
      'Should not be described as genuine machine learning unless the historical implementation is verified.',
    ],
  },
};

export const MODEL_REGISTRY = Object.entries(MODEL_METADATA_REGISTRY).map(
  ([model_key, metadata]) => {
    const override = MODEL_PROFILE_OVERRIDES[model_key] ?? {};

    return {
      model_key,

      display_name: metadata.displayName,

      ...DEFAULT_MODEL_PROFILE,

      /*
       * Machine-readable implementation truth from modelMetadata.js.
       */
      model_family: metadata.category,
      implementation_type: metadata.implementation,
      trained: metadata.trained,
      legacy: metadata.legacy,
      retired: metadata.retired ?? false,
      prospective: metadata.prospective ?? false,

      /*
       * A retired metadata identity is retired unless a specific
       * profile override deliberately says otherwise.
       */
      status: metadata.retired ? 'retired' : DEFAULT_MODEL_PROFILE.status,

      ...override,
    };
  },
);

export function getModelProfile(modelKey) {
  return MODEL_REGISTRY.find((model) => model.model_key === modelKey) ?? null;
}
