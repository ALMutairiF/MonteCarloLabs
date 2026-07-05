/**
 * statistics.js
 * -----------------------------------------------------------------------
 * Responsibility: CALCULATIONS ONLY.
 * Pure statistical functions operating on arrays of numbers. Does not
 * know anything about trades, simulations, files, or the DOM.
 * -----------------------------------------------------------------------
 */

const Statistics = (() => {

  /**
   * Arithmetic mean of an array of numbers.
   * @param {number[]} values
   * @returns {number}
   */
  function mean(values) {
    if (!values.length) return 0;
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
  }

  /**
   * Median of an array of numbers (sorts a copy internally).
   * @param {number[]} values
   * @returns {number}
   */
  function median(values) {
    return percentile(values, 50);
  }

  /**
   * Sample standard deviation (n-1 denominator).
   * @param {number[]} values
   * @returns {number}
   */
  function standardDeviation(values) {
    if (values.length < 2) return 0;
    const m = mean(values);
    let sumSquares = 0;
    for (let i = 0; i < values.length; i++) {
      const diff = values[i] - m;
      sumSquares += diff * diff;
    }
    return Math.sqrt(sumSquares / (values.length - 1));
  }

  /**
   * Minimum value in an array.
   * @param {number[]} values
   * @returns {number}
   */
  function min(values) {
    if (!values.length) return 0;
    let m = values[0];
    for (let i = 1; i < values.length; i++) if (values[i] < m) m = values[i];
    return m;
  }

  /**
   * Maximum value in an array.
   * @param {number[]} values
   * @returns {number}
   */
  function max(values) {
    if (!values.length) return 0;
    let m = values[0];
    for (let i = 1; i < values.length; i++) if (values[i] > m) m = values[i];
    return m;
  }

  /**
   * Linear-interpolated percentile of an array of numbers (the same
   * method Excel's PERCENTILE.INC uses).
   * @param {number[]} values
   * @param {number} p - percentile between 0 and 100
   * @returns {number}
   */
  function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length === 1) return sorted[0];

    const rank = (p / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);
    if (lowerIndex === upperIndex) return sorted[lowerIndex];

    const weight = rank - lowerIndex;
    return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
  }

  /**
   * Fraction (0-1) of values strictly greater than the given threshold.
   * @param {number[]} values
   * @param {number} threshold
   * @returns {number}
   */
  function probabilityAbove(values, threshold) {
    if (!values.length) return 0;
    let count = 0;
    for (let i = 0; i < values.length; i++) if (values[i] > threshold) count++;
    return count / values.length;
  }

  /**
   * Compute the full descriptive-statistics summary used throughout the
   * results dashboard for an array of return percentages.
   * @param {number[]} returns
   * @returns {Object}
   */
  function summarize(returns) {
    return {
      count: returns.length,
      average: mean(returns),
      median: median(returns),
      stdDev: standardDeviation(returns),
      min: min(returns),
      max: max(returns),
      probabilityOfProfit: probabilityAbove(returns, 0) * 100,
      probabilityAbove5: probabilityAbove(returns, 5) * 100,
      probabilityAbove10: probabilityAbove(returns, 10) * 100,
      probabilityAbove20: probabilityAbove(returns, 20) * 100,
      percentiles: {
        p5: percentile(returns, 5),
        p25: percentile(returns, 25),
        p50: percentile(returns, 50),
        p75: percentile(returns, 75),
        p95: percentile(returns, 95)
      }
    };
  }

  /**
   * Build histogram bins for an array of return percentages.
   * @param {number[]} returns
   * @param {number} [binCount=20]
   * @returns {{labels: string[], counts: number[], edges: number[]}}
   */
  function buildHistogram(returns, binCount = 20) {
    if (!returns.length) return { labels: [], counts: [], edges: [] };

    const lo = min(returns);
    const hi = max(returns);
    const range = hi - lo;
    const binWidth = range === 0 ? 1 : range / binCount;

    const edges = [];
    for (let i = 0; i <= binCount; i++) edges.push(lo + i * binWidth);

    const counts = new Array(binCount).fill(0);
    for (const value of returns) {
      let idx = range === 0 ? 0 : Math.floor((value - lo) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    }

    const labels = [];
    for (let i = 0; i < binCount; i++) {
      labels.push(`${edges[i].toFixed(1)}% to ${edges[i + 1].toFixed(1)}%`);
    }

    return { labels, counts, edges };
  }

  return {
    mean,
    median,
    standardDeviation,
    min,
    max,
    percentile,
    probabilityAbove,
    summarize,
    buildHistogram
  };
})();
