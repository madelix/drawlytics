const EVIDENCE_WEIGHTS = {
  SAMPLE_SIZE: 40,
  PERFORMANCE_GAP: 30,
  LEADER_STABILITY: 30,
};

function clamp(value, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function calculateSampleSizeScore(sampleSize) {
  return clamp((sampleSize / 100) * 100);
}

function calculatePerformanceGapScore(percentageDifference) {
  if (!Number.isFinite(percentageDifference)) {
    return 0;
  }

  return clamp((Math.abs(percentageDifference) / 25) * 100);
}

function calculateLeaderStabilityScore(leaderChangesLast20) {
  if (!Number.isFinite(leaderChangesLast20)) {
    return 0;
  }

  return clamp(100 - leaderChangesLast20 * 10);
}

export function calculateEvidenceScore({
  leaderSampleSize,
  percentageDifference,
  leaderChangesLast20,
}) {
  const components = {
    sample_size: calculateSampleSizeScore(leaderSampleSize),
    performance_gap: calculatePerformanceGapScore(percentageDifference),
    leader_stability: calculateLeaderStabilityScore(leaderChangesLast20),
  };

  const score =
    (components.sample_size * EVIDENCE_WEIGHTS.SAMPLE_SIZE +
      components.performance_gap * EVIDENCE_WEIGHTS.PERFORMANCE_GAP +
      components.leader_stability * EVIDENCE_WEIGHTS.LEADER_STABILITY) /
    100;

  const roundedScore = Math.round(score);

  const level =
    roundedScore >= 75
      ? 'High'
      : roundedScore >= 50
        ? 'Moderate'
        : roundedScore >= 25
          ? 'Building'
          : 'Low';

  return {
    score: roundedScore,
    level,
    status: 'provisional',
    components: {
      sample_size: Math.round(components.sample_size),
      performance_gap: Math.round(components.performance_gap),
      leader_stability: Math.round(components.leader_stability),
    },
  };
}

function createSeededRandom(seed = 123456789) {
  let state = seed >>> 0;

  return function random() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function calculateMean(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculatePercentile(sortedValues, percentile) {
  if (!sortedValues.length) {
    return null;
  }

  const index = (sortedValues.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = index - lowerIndex;

  return (
    sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight
  );
}

export function calculateBootstrapConfidence({
  modelHits,
  pureRandomHits,
  iterations = 5000,
}) {
  if (
    !Array.isArray(modelHits) ||
    !Array.isArray(pureRandomHits) ||
    modelHits.length < 2 ||
    pureRandomHits.length < 2
  ) {
    return {
      status: 'insufficient_data',
      iterations: 0,
      confidence: null,
      observed_difference: null,
      confidence_interval: {
        low: null,
        high: null,
      },
    };
  }

  const random = createSeededRandom(
    modelHits.length * 1000003 + pureRandomHits.length,
  );

  const differences = [];
  let modelAheadCount = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sampledModelHits = [];
    const sampledRandomHits = [];

    for (let index = 0; index < modelHits.length; index += 1) {
      const sampledIndex = Math.floor(random() * modelHits.length);
      sampledModelHits.push(modelHits[sampledIndex]);
    }

    for (let index = 0; index < pureRandomHits.length; index += 1) {
      const sampledIndex = Math.floor(random() * pureRandomHits.length);
      sampledRandomHits.push(pureRandomHits[sampledIndex]);
    }

    const difference =
      calculateMean(sampledModelHits) - calculateMean(sampledRandomHits);

    differences.push(difference);

    if (difference > 0) {
      modelAheadCount += 1;
    }
  }

  differences.sort((a, b) => a - b);

  return {
    status: 'calculated',
    iterations,
    confidence: (modelAheadCount / iterations) * 100,
    observed_difference:
      calculateMean(modelHits) - calculateMean(pureRandomHits),
    confidence_interval: {
      low: calculatePercentile(differences, 0.025),
      high: calculatePercentile(differences, 0.975),
    },
  };
}
