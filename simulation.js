/**
 * simulation.js
 * -----------------------------------------------------------------------
 * Responsibility: SIMULATION ONLY.
 * Implements the Monte Carlo engine: picks random entry days, computes
 * entry/exit prices, and produces trade + simulation records. Contains
 * no statistics aggregation (see statistics.js) and no DOM/chart code.
 * -----------------------------------------------------------------------
 */

const MonteCarloEngine = (() => {

  const BUY_METHOD = {
    RANDOM_OPEN_CLOSE: 'randomOpenClose',
    OPEN: 'open',
    CLOSE: 'close'
  };

  /**
   * Run the full Monte Carlo experiment asynchronously in chunks so the
   * browser main thread is never blocked for too long, even at 100,000
   * simulations.
   *
   * @param {Object} options
   * @param {Array<Object>} options.rows - normalized historical rows (chronological)
   * @param {number} options.tradesPerSimulation
   * @param {number} options.holdDays
   * @param {number} options.simulationCount
   * @param {string} options.buyMethod - one of BUY_METHOD values
   * @param {boolean} options.allowDuplicateEntryDates
   * @param {function(number):void} [options.onProgress] - called with 0-100
   * @returns {Promise<Array<Object>>} array of simulation result objects
   */
  async function run(options) {
    const {
      rows,
      tradesPerSimulation,
      holdDays,
      simulationCount,
      buyMethod,
      allowDuplicateEntryDates,
      onProgress
    } = options;

    validateInputs(rows, tradesPerSimulation, holdDays, simulationCount);

    // The last valid entry index is one where index + holdDays still
    // exists in the dataset.
    const lastValidEntryIndex = rows.length - 1 - holdDays;
    const validEntryCount = lastValidEntryIndex + 1;

    if (validEntryCount < 1) {
      throw new Error(
        `Hold Days (${holdDays}) is too large for the dataset (${rows.length} rows). Reduce Hold Days or provide more data.`
      );
    }
    if (!allowDuplicateEntryDates && tradesPerSimulation > validEntryCount) {
      throw new Error(
        `Trades per Simulation (${tradesPerSimulation}) exceeds the number of available unique entry days (${validEntryCount}) for the chosen Hold Days. Enable duplicate entry dates or reduce Trades per Simulation.`
      );
    }

    const results = new Array(simulationCount);

    const CHUNK_SIZE = 200; // simulations processed before yielding to the browser
    let processed = 0;

    for (let simIndex = 0; simIndex < simulationCount; simIndex++) {
      results[simIndex] = runSingleSimulation(
        simIndex,
        rows,
        tradesPerSimulation,
        holdDays,
        validEntryCount,
        buyMethod,
        allowDuplicateEntryDates
      );

      processed++;
      if (processed % CHUNK_SIZE === 0) {
        if (onProgress) onProgress(Math.round((processed / simulationCount) * 100));
        await Utils.yieldToBrowser();
      }
    }

    if (onProgress) onProgress(100);
    return results;
  }

  /**
   * Run a single simulation consisting of N trades.
   * @returns {Object} simulation result with nested trade list
   */
  function runSingleSimulation(simIndex, rows, tradesPerSimulation, holdDays, validEntryCount, buyMethod, allowDuplicates) {
    const trades = new Array(tradesPerSimulation);
    const usedIndices = allowDuplicates ? null : new Set();

    for (let t = 0; t < tradesPerSimulation; t++) {
      const entryIndex = pickEntryIndex(validEntryCount, usedIndices);
      const entryRow = rows[entryIndex];
      const exitRow = rows[entryIndex + holdDays];

      const buyPrice = computeBuyPrice(entryRow, buyMethod);
      const sellPrice = exitRow.close;
      const returnPct = ((sellPrice - buyPrice) / buyPrice) * 100;

      trades[t] = {
        tradeNumber: t + 1,
        entryDate: entryRow.date,
        exitDate: exitRow.date,
        buyPrice,
        sellPrice,
        returnPct,
        isWin: returnPct > 0
      };
    }

    let wins = 0;
    let sumReturn = 0;
    for (let i = 0; i < trades.length; i++) {
      if (trades[i].isWin) wins++;
      sumReturn += trades[i].returnPct;
    }

    return {
      simulationNumber: simIndex + 1,
      trades,
      averageReturn: sumReturn / trades.length,
      wins,
      losses: trades.length - wins
    };
  }

  /**
   * Pick a random valid entry index, respecting the "allow duplicate
   * entry dates" setting for indices already used within this simulation.
   * @param {number} validEntryCount
   * @param {Set<number>|null} usedIndices
   * @returns {number}
   */
  function pickEntryIndex(validEntryCount, usedIndices) {
    if (!usedIndices) {
      return Utils.randomInt(0, validEntryCount - 1);
    }
    // Sampling without replacement: retry until an unused index is found.
    // Bounded by validEntryCount so this always terminates given the
    // pre-flight validation performed in run().
    let idx;
    do {
      idx = Utils.randomInt(0, validEntryCount - 1);
    } while (usedIndices.has(idx));
    usedIndices.add(idx);
    return idx;
  }

  /**
   * Compute the simulated buy price for a given entry row and buy method.
   * @param {Object} row
   * @param {string} buyMethod
   * @returns {number}
   */
  function computeBuyPrice(row, buyMethod) {
    switch (buyMethod) {
      case BUY_METHOD.OPEN:
        return row.open;
      case BUY_METHOD.CLOSE:
        return row.close;
      case BUY_METHOD.RANDOM_OPEN_CLOSE:
      default: {
        const lo = Math.min(row.open, row.close);
        const hi = Math.max(row.open, row.close);
        return Utils.randomBetween(lo, hi);
      }
    }
  }

  function validateInputs(rows, tradesPerSimulation, holdDays, simulationCount) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('No historical data loaded. Please import a dataset first.');
    }
    if (!Number.isInteger(tradesPerSimulation) || tradesPerSimulation < 1) {
      throw new Error('Trades per Simulation must be a positive whole number.');
    }
    if (!Number.isInteger(holdDays) || holdDays < 1) {
      throw new Error('Hold Days must be a positive whole number.');
    }
    if (!Number.isInteger(simulationCount) || simulationCount < 1) {
      throw new Error('Monte Carlo Simulations must be a positive whole number.');
    }
  }

  return {
    run,
    BUY_METHOD
  };
})();
