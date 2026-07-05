/**
 * report.js
 * -----------------------------------------------------------------------
 * Responsibility: REPORTS ONLY.
 * Builds a human-readable research report (as an HTML string and as a
 * plain-text string) from the simulation settings, summary statistics,
 * and user notes. Does not run simulations or touch charts.
 * -----------------------------------------------------------------------
 */

const ReportGenerator = (() => {

  /**
   * Produce a written interpretation paragraph based on the summary
   * statistics, using plain language aimed at a research audience.
   * @param {Object} summary
   * @param {Object} settings
   * @returns {string}
   */
  function buildInterpretation(summary, settings) {
    const lines = [];

    lines.push(
      `Across ${summary.count.toLocaleString()} simulated trades (${settings.simulationCount.toLocaleString()} simulations of ${settings.tradesPerSimulation} trades each), the average historical return was ${Utils.formatPercent(summary.average)} over a ${settings.holdDays}-day holding period.`
    );

    if (summary.average > 0) {
      lines.push(`On average, this historical pattern produced a positive outcome, though individual results varied considerably (standard deviation of ${Utils.formatNumber(summary.stdDev)} percentage points).`);
    } else {
      lines.push(`On average, this historical pattern did not produce a positive outcome, and individual results varied considerably (standard deviation of ${Utils.formatNumber(summary.stdDev)} percentage points).`);
    }

    lines.push(
      `${Utils.formatNumber(summary.probabilityOfProfit)}% of simulated trades were profitable. ${Utils.formatNumber(summary.probabilityAbove5)}% exceeded a +5% return, ${Utils.formatNumber(summary.probabilityAbove10)}% exceeded +10%, and ${Utils.formatNumber(summary.probabilityAbove20)}% exceeded +20%.`
    );

    lines.push(
      `The 5th percentile return was ${Utils.formatPercent(summary.percentiles.p5)}, meaning 95% of simulated trades finished above this value. The 95th percentile return was ${Utils.formatPercent(summary.percentiles.p95)}, meaning only 5% of simulated trades finished above this value.`
    );

    lines.push(
      'This analysis describes historical statistical tendencies only. It is not a prediction of future performance and should not be interpreted as investment advice.'
    );

    return lines.join(' ');
  }

  /**
   * Build the full report as an HTML document string.
   * @param {Object} params
   * @param {Object} params.settings - simulation settings used
   * @param {Object} params.summary - Statistics.summarize() output
   * @param {string} params.notes - user research notes
   * @param {string} params.datasetName - name of the imported file
   * @param {number} params.datasetRowCount
   * @returns {string}
   */
  function buildHtmlReport(params) {
    const { settings, summary, notes, datasetName, datasetRowCount } = params;
    const generatedAt = new Date().toLocaleString();
    const interpretation = buildInterpretation(summary, settings);
    const buyMethodLabel = {
      randomOpenClose: 'Random price between Open and Close',
      open: 'Open price',
      close: 'Close price'
    }[settings.buyMethod] || settings.buyMethod;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MonteCarloLabs Research Report</title>
<style>
  body { font-family: 'IBM Plex Sans', Arial, sans-serif; color: #101828; max-width: 860px; margin: 40px auto; padding: 0 20px; line-height: 1.55; }
  h1 { color: #1857C4; margin-bottom: 4px; }
  h2 { color: #1857C4; border-bottom: 2px solid #E4E9F2; padding-bottom: 6px; margin-top: 36px; }
  .meta { color: #64748B; font-size: 14px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #E4E9F2; font-size: 14px; }
  th { background: #F5F7FA; color: #42506B; }
  .notes { white-space: pre-wrap; background: #F5F7FA; border-radius: 8px; padding: 16px; font-size: 14px; }
  .disclaimer { font-size: 12px; color: #64748B; margin-top: 40px; border-top: 1px solid #E4E9F2; padding-top: 16px; }
  .badge { display: inline-block; background: #E9F0FF; color: #1857C4; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
  <h1>MonteCarloLabs Research Report</h1>
  <div class="meta">Generated ${Utils.escapeHtml(generatedAt)} &middot; <span class="badge">Historical Analysis</span></div>

  <h2>Dataset</h2>
  <table>
    <tr><th>File</th><td>${Utils.escapeHtml(datasetName)}</td></tr>
    <tr><th>Historical Rows Used</th><td>${datasetRowCount.toLocaleString()}</td></tr>
  </table>

  <h2>Simulation Settings</h2>
  <table>
    <tr><th>Trades per Simulation</th><td>${settings.tradesPerSimulation}</td></tr>
    <tr><th>Hold Days</th><td>${settings.holdDays}</td></tr>
    <tr><th>Monte Carlo Simulations</th><td>${settings.simulationCount.toLocaleString()}</td></tr>
    <tr><th>Buy Method</th><td>${Utils.escapeHtml(buyMethodLabel)}</td></tr>
    <tr><th>Allow Duplicate Entry Dates</th><td>${settings.allowDuplicateEntryDates ? 'Yes' : 'No'}</td></tr>
  </table>

  <h2>Summary Statistics</h2>
  <table>
    <tr><th>Total Trades Simulated</th><td>${summary.count.toLocaleString()}</td></tr>
    <tr><th>Average Return</th><td>${Utils.formatPercent(summary.average)}</td></tr>
    <tr><th>Median Return</th><td>${Utils.formatPercent(summary.median)}</td></tr>
    <tr><th>Standard Deviation</th><td>${Utils.formatNumber(summary.stdDev)}</td></tr>
    <tr><th>Minimum Return</th><td>${Utils.formatPercent(summary.min)}</td></tr>
    <tr><th>Maximum Return</th><td>${Utils.formatPercent(summary.max)}</td></tr>
    <tr><th>Probability of Profit</th><td>${Utils.formatNumber(summary.probabilityOfProfit)}%</td></tr>
    <tr><th>Probability &gt; 5%</th><td>${Utils.formatNumber(summary.probabilityAbove5)}%</td></tr>
    <tr><th>Probability &gt; 10%</th><td>${Utils.formatNumber(summary.probabilityAbove10)}%</td></tr>
    <tr><th>Probability &gt; 20%</th><td>${Utils.formatNumber(summary.probabilityAbove20)}%</td></tr>
  </table>

  <h2>Percentiles</h2>
  <table>
    <tr><th>Percentile</th><th>Return</th><th>Interpretation</th></tr>
    <tr><td>5th</td><td>${Utils.formatPercent(summary.percentiles.p5)}</td><td>95% of simulations finished above this value.</td></tr>
    <tr><td>25th</td><td>${Utils.formatPercent(summary.percentiles.p25)}</td><td>75% of simulations finished above this value.</td></tr>
    <tr><td>50th (Median)</td><td>${Utils.formatPercent(summary.percentiles.p50)}</td><td>Half of simulations finished above this value.</td></tr>
    <tr><td>75th</td><td>${Utils.formatPercent(summary.percentiles.p75)}</td><td>25% of simulations finished above this value.</td></tr>
    <tr><td>95th</td><td>${Utils.formatPercent(summary.percentiles.p95)}</td><td>Only 5% of simulations finished above this value.</td></tr>
  </table>

  <h2>Interpretation</h2>
  <p>${Utils.escapeHtml(interpretation)}</p>

  <h2>Research Notes</h2>
  <div class="notes">${notes ? Utils.escapeHtml(notes) : '(No notes were recorded for this session.)'}</div>

  <div class="disclaimer">
    MonteCarloLabs evaluates historical statistical characteristics only. Nothing in this report constitutes financial advice
    or a prediction of future performance. Past performance is not indicative of future results.
  </div>
</body>
</html>`;
  }

  /**
   * Build the full report as a plain-text string.
   * @param {Object} params - same shape as buildHtmlReport
   * @returns {string}
   */
  function buildTextReport(params) {
    const { settings, summary, notes, datasetName, datasetRowCount } = params;
    const generatedAt = new Date().toLocaleString();
    const interpretation = buildInterpretation(summary, settings);
    const buyMethodLabel = {
      randomOpenClose: 'Random price between Open and Close',
      open: 'Open price',
      close: 'Close price'
    }[settings.buyMethod] || settings.buyMethod;

    const divider = '='.repeat(60);

    return [
      divider,
      'MONTECARLOLABS RESEARCH REPORT',
      `Generated: ${generatedAt}`,
      divider,
      '',
      'DATASET',
      '-------',
      `File: ${datasetName}`,
      `Historical Rows Used: ${datasetRowCount}`,
      '',
      'SIMULATION SETTINGS',
      '--------------------',
      `Trades per Simulation: ${settings.tradesPerSimulation}`,
      `Hold Days: ${settings.holdDays}`,
      `Monte Carlo Simulations: ${settings.simulationCount}`,
      `Buy Method: ${buyMethodLabel}`,
      `Allow Duplicate Entry Dates: ${settings.allowDuplicateEntryDates ? 'Yes' : 'No'}`,
      '',
      'SUMMARY STATISTICS',
      '-------------------',
      `Total Trades Simulated: ${summary.count}`,
      `Average Return: ${Utils.formatPercent(summary.average)}`,
      `Median Return: ${Utils.formatPercent(summary.median)}`,
      `Standard Deviation: ${Utils.formatNumber(summary.stdDev)}`,
      `Minimum Return: ${Utils.formatPercent(summary.min)}`,
      `Maximum Return: ${Utils.formatPercent(summary.max)}`,
      `Probability of Profit: ${Utils.formatNumber(summary.probabilityOfProfit)}%`,
      `Probability > 5%: ${Utils.formatNumber(summary.probabilityAbove5)}%`,
      `Probability > 10%: ${Utils.formatNumber(summary.probabilityAbove10)}%`,
      `Probability > 20%: ${Utils.formatNumber(summary.probabilityAbove20)}%`,
      '',
      'PERCENTILES',
      '------------',
      `5th percentile: ${Utils.formatPercent(summary.percentiles.p5)} (95% of simulations finished above this value)`,
      `25th percentile: ${Utils.formatPercent(summary.percentiles.p25)} (75% of simulations finished above this value)`,
      `50th percentile (Median): ${Utils.formatPercent(summary.percentiles.p50)} (half of simulations finished above this value)`,
      `75th percentile: ${Utils.formatPercent(summary.percentiles.p75)} (25% of simulations finished above this value)`,
      `95th percentile: ${Utils.formatPercent(summary.percentiles.p95)} (only 5% of simulations finished above this value)`,
      '',
      'INTERPRETATION',
      '---------------',
      interpretation,
      '',
      'RESEARCH NOTES',
      '---------------',
      notes && notes.trim() ? notes : '(No notes were recorded for this session.)',
      '',
      divider,
      'MonteCarloLabs evaluates historical statistical characteristics only.',
      'This is not financial advice and not a prediction of future performance.',
      divider
    ].join('\n');
  }

  return {
    buildHtmlReport,
    buildTextReport,
    buildInterpretation
  };
})();
