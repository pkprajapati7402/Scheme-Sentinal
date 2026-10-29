export interface MetricScore {
  exactMatches: number;
  totalComparisons: number;
  accuracy: number;
}

export function computeExactMatch(predicted: any, expected: any): boolean {
  if (expected === null || expected === undefined) {
    return predicted === null || predicted === undefined;
  }
  return String(predicted).trim() === String(expected).trim();
}

export function computeListF1(predictedList: string[] = [], expectedList: string[] = []): { precision: number; recall: number; f1: number } {
  const predSet = new Set(predictedList.map((s) => s.toLowerCase().trim()));
  const expSet = new Set(expectedList.map((s) => s.toLowerCase().trim()));

  if (expSet.size === 0 && predSet.size === 0) {
    return { precision: 1.0, recall: 1.0, f1: 1.0 };
  }
  if (expSet.size === 0 || predSet.size === 0) {
    return { precision: 0.0, recall: 0.0, f1: 0.0 };
  }

  let truePositives = 0;
  for (const item of predSet) {
    if (expSet.has(item)) {
      truePositives++;
    }
  }

  const precision = truePositives / predSet.size;
  const recall = truePositives / expSet.size;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision, recall, f1 };
}

