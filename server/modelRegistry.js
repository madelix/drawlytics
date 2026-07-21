import { MODEL_DISPLAY_NAMES } from './modelMetadata.js';

const DEFAULT_MODEL_PROFILE = {
  category: 'Experimental strategy',
  implementation_type: 'heuristic',
  learning_status: 'not_learning',
  version: '0.1',
  status: 'experimental',
  summary:
    'This strategy is currently being evaluated through saved predictions and checked lottery results.',
  purpose:
    'To test whether its number-selection approach performs differently from a Pure Random baseline.',
  how_it_works:
    'The current implementation applies predefined selection rules to historical draw information. It does not yet retrain itself from newly checked predictions.',
  strengths: [
    'Produces repeatable strategy-specific behaviour.',
    'Can be compared honestly with Pure Random.',
  ],
  limitations: [
    'Current performance may be based on a limited sample.',
    'The strategy is not yet a genuinely self-learning model.',
    'Lottery draws remain random and no strategy can guarantee improved results.',
  ],
};

const MODEL_PROFILE_OVERRIDES = {
  pure_random: {
    category: 'Baseline strategy',
    implementation_type: 'random',
    status: 'active',
    summary:
      'Generates combinations without using historical patterns or model-based weighting.',
    purpose:
      'To provide the neutral baseline against which every other Drawlytics strategy is evaluated.',
    how_it_works:
      'Numbers are sampled randomly from the valid lottery ranges, with duplicates prevented within each prediction.',
    strengths: [
      'Unbiased baseline for comparison.',
      'Does not overfit historical draw patterns.',
      'Simple and transparent.',
    ],
    limitations: [
      'Does not attempt to identify trends or patterns.',
      'Every valid combination remains equally uncertain.',
    ],
  },

  hot_focused: {
    category: 'Frequency strategy',
    summary:
      'Prioritises numbers that have appeared frequently within the historical window used by the generator.',
    purpose:
      'To test whether recently frequent numbers produce different results from random selection.',
    how_it_works:
      'Historical number frequencies are converted into selection weights, giving frequently drawn numbers a greater chance of being selected.',
    limitations: [
      'Past frequency does not make a number inherently more likely in the next independent draw.',
      'Results depend on the historical window and weighting rules.',
    ],
  },

  cold_focused: {
    category: 'Frequency strategy',
    summary:
      'Prioritises numbers that have appeared less frequently within the selected historical window.',
    purpose:
      'To test the common idea that less frequently drawn numbers may offer useful diversification.',
    how_it_works:
      'Numbers with lower historical frequencies receive stronger selection weights than frequently appearing numbers.',
    limitations: [
      'A cold number is not mathematically due to appear.',
      'Results depend on the historical window and weighting rules.',
    ],
  },

  overdue: {
    category: 'Gap strategy',
    summary:
      'Favours numbers that have not appeared for comparatively long periods.',
    purpose:
      'To test whether draw gaps provide any measurable selection advantage.',
    how_it_works:
      'The strategy measures the number of draws since each number last appeared and gives greater weight to longer gaps.',
    limitations: [
      'A long absence does not increase a number’s mathematical probability.',
      'The strategy may reinforce the gambler’s fallacy if presented without context.',
    ],
  },

  balanced_hot_cold: {
    category: 'Hybrid strategy',
    summary:
      'Combines frequently appearing and less frequently appearing numbers within one prediction.',
    purpose:
      'To test whether balancing opposing frequency behaviours is more stable than focusing on either group alone.',
    how_it_works:
      'The generator selects numbers from both hot and cold frequency groups while maintaining the required lottery number count.',
  },

  strategy_mix: {
    category: 'Composite strategy',
    implementation_type: 'ensemble',
    summary:
      'Combines outputs or selection behaviour from several Drawlytics strategies.',
    purpose:
      'To test whether diversification across strategies is more resilient than relying on a single method.',
    how_it_works:
      'Predictions are assembled using multiple strategy families rather than one isolated rule.',
  },
};

export const MODEL_REGISTRY = Object.entries(MODEL_DISPLAY_NAMES).map(
  ([model_key, display_name]) => ({
    model_key,
    display_name,
    ...DEFAULT_MODEL_PROFILE,
    ...(MODEL_PROFILE_OVERRIDES[model_key] ?? {}),
  }),
);

export function getModelProfile(modelKey) {
  return MODEL_REGISTRY.find((model) => model.model_key === modelKey) ?? null;
}
