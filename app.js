/**
 * app.js
 * -----------------------------------------------------------------------
 * Responsibility: WIRING THE UI TOGETHER ONLY.
 * Handles DOM events, orchestrates calls into DataLoader, MonteCarloEngine,
 * Statistics, ChartManager, and ReportGenerator, and renders results into
 * the page. Contains no parsing, statistics, or simulation logic itself.
 * -----------------------------------------------------------------------
 */

(() => {
  'use strict';

  /** In-memory application state. Cleared on page refresh, as required. */
  const state = {
    rows: null,           // normalized historical rows from the loaded file
    datasetName: '',
    simulations: null,    // raw simulation results from MonteCarloEngine
    allReturns: null,     // flattened array of every trade's return %
    summary: null,         // Statistics.summarize() output
    histogram: null,       // Statistics.buildHistogram() output
    selectedSimulation: null,
    settingsUsed: null
  };

  // ------------------------------------------------------------------
  // DOM references
  // ------------------------------------------------------------------
  const el = {
    fileInput: document.getElementById('fileInput'),
    dropzone: document.getElementById('dropzone'),
    fileMeta: document.getElementById('fileMeta'),
    loadWarnings: document.getElementById('loadWarnings'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),

    tradesPerSimulation: document.getElementById('tradesPerSimulation'),
    holdDays: document.getElementById('holdDays'),
    simulationCount: document.getElementById('simulationCount'),
    buyMethod: document.getElementById('buyMethod'),
    allowDuplicates: document.getElementById('allowDuplicates'),
    runButton: document.getElementById('runButton'),
    progressWrap: document.getElementById('progressWrap'),
    progressBar: document.getElementById('progressBar'),
    progressLabel: document.getElementById('progressLabel'),

    emptyState: document.getElementById('emptyState'),
    resultsArea: document.getElementById('resultsArea'),
    errorBanner: document.getElementById('errorBanner'),

    kpiAverage: document.getElementById('kpiAverage'),
    kpiMedian: document.getElementById('kpiMedian'),
    kpiStdDev: document.getElementById('kpiStdDev'),
    kpiMin: document.getElementById('kpiMin'),
    kpiMax: document.getElementById('kpiMax'),
    kpiProbProfit: document.getElementById('kpiProbProfit'),
    kpiProb5: document.getElementById('kpiProb5'),
    kpiProb10: document.getElementById('kpiProb10'),
    kpiProb20: document.getElementById('kpiProb20'),

    percentileGrid: document.getElementById('percentileGrid'),
    histogramCanvas: document.getElementById('histogramCanvas'),
    pieCanvas: document.getElementById('pieCanvas'),

    simulationTableBody: document.getElementById('simulationTableBody'),
    tradeTableBody: document.getElementById('tradeTableBody'),
    tradeDetailsTitle: document.getElementById('tradeDetailsTitle'),
    tradeDetailsSubtitle: document.getElementById('tradeDetailsSubtitle'),

    researchNotes: document.getElementById('researchNotes'),
    downloadHtmlBtn: document.getElementById('downloadHtmlBtn'),
    downloadTxtBtn: document.getElementById('downloadTxtBtn'),
    reportPreview: document.getElementById('reportPreview')
  };

  // ------------------------------------------------------------------
  // File import wiring
  // ------------------------------------------------------------------

  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.classList.add('dragover');
  });

  el.dropzone.addEventListener('dragleave', () => {
    el.dropzone.classList.remove('dragover');
  });

  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  /**
   * Load and validate a user-provided file, updating UI state accordingly.
   * @param {File} file
   */
  async function handleFile(file) {
    clearError();
    setStatus('loading', `Reading ${file.name}\u2026`);
    el.fileMeta.classList.add('hidden');
    el.loadWarnings.classList.add('hidden');
    el.runButton.disabled = true;

    try {
      const { rows, warnings } = await DataLoader.loadFile(file);
      state.rows = rows;
      state.datasetName = file.name;

      const firstDate = Utils.formatDate(rows[0].date);
      const lastDate = Utils.formatDate(rows[rows.length - 1].date);

      el.fileMeta.innerHTML =
        `<strong>${Utils.escapeHtml(file.name)}</strong><br>` +
        `${rows.length.toLocaleString()} rows &middot; ${firstDate} &rarr; ${lastDate}`;
      el.fileMeta.classList.remove('hidden');

      if (warnings.length > 0) {
        el.loadWarnings.innerHTML = `<strong>Notes:</strong><ul>${warnings
          .map(w => `<li>${Utils.escapeHtml(w)}</li>`)
          .join('')}</ul>`;
        el.loadWarnings.classList.remove('hidden');
      }

      setStatus('ready', `${rows.length.toLocaleString()} rows loaded`);
      el.runButton.disabled = false;
    } catch (err) {
      state.rows = null;
      el.runButton.disabled = true;
      setStatus('error', 'Failed to load dataset');
      showError(err instanceof DataLoader.LoaderError ? err.message : 'An unexpected error occurred while reading the file.');
    }
  }

  function setStatus(kind, text) {
    el.statusText.textContent = text;
    el.statusDot.classList.remove('status-ready', 'status-error');
    if (kind === 'ready') el.statusDot.classList.add('status-ready');
    if (kind === 'error') el.statusDot.classList.add('status-error');
  }

  // ------------------------------------------------------------------
  // Simulation run wiring
  // ------------------------------------------------------------------

  el.runButton.addEventListener('click', runSimulation);

  async function runSimulation() {
    clearError();

    if (!state.rows) {
      showError('Please import a dataset before running a simulation.');
      return;
    }

    const settings = readSettingsFromForm();
    const settingsError = validateSettings(settings);
    if (settingsError) {
      showError(settingsError);
      return;
    }

    el.runButton.disabled = true;
    el.progressWrap.classList.remove('hidden');
    setProgress(0);

    try {
      const simulations = await MonteCarloEngine.run({
        rows: state.rows,
        tradesPerSimulation: settings.tradesPerSimulation,
        holdDays: settings.holdDays,
        simulationCount: settings.simulationCount,
        buyMethod: settings.buyMethod,
        allowDuplicateEntryDates: settings.allowDuplicateEntryDates,
        onProgress: setProgress
      });

      state.simulations = simulations;
      state.settingsUsed = settings;
      state.allReturns = flattenReturns(simulations);
      state.summary = Statistics.summarize(state.allReturns);
      state.histogram = Statistics.buildHistogram(
        simulations.map(s => s.averageReturn),
        20
      );
      state.selectedSimulation = null;

      renderResults();
    } catch (err) {
      showError(err.message || 'An unexpected error occurred while running the simulation.');
    } finally {
      el.runButton.disabled = false;
      el.progressWrap.classList.add('hidden');
    }
  }

  function readSettingsFromForm() {
    return {
      tradesPerSimulation: parseInt(el.tradesPerSimulation.value, 10),
      holdDays: parseInt(el.holdDays.value, 10),
      simulationCount: parseInt(el.simulationCount.value, 10),
      buyMethod: el.buyMethod.value,
      allowDuplicateEntryDates: el.allowDuplicates.checked
    };
  }

  function validateSettings(settings) {
    if (!Number.isInteger(settings.tradesPerSimulation) || settings.tradesPerSimulation < 1) {
      return 'Trades per Simulation must be a positive whole number.';
    }
    if (!Number.isInteger(settings.holdDays) || settings.holdDays < 1) {
      return 'Hold Days must be a positive whole number.';
    }
    if (!Number.isInteger(settings.simulationCount) || settings.simulationCount < 1) {
      return 'Monte Carlo Simulations must be a positive whole number.';
    }
    if (settings.simulationCount > 100000) {
      return 'Monte Carlo Simulations is capped at 100,000 to keep the browser responsive.';
    }
    return null;
  }

  function setProgress(pct) {
    el.progressBar.style.width = `${pct}%`;
    el.progressLabel.textContent = `${pct}%`;
  }

  /**
   * Flatten every trade's return percentage across all simulations into a
   * single array for overall (trade-level) statistics.
   * @param {Array<Object>} simulations
   * @returns {number[]}
   */
  function flattenReturns(simulations) {
    const returns = [];
    for (const sim of simulations) {
      for (const trade of sim.trades) {
        returns.push(trade.returnPct);
      }
    }
    return returns;
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  function renderResults() {
    el.emptyState.classList.add('hidden');
    el.resultsArea.classList.remove('hidden');

    renderKpis();
    renderPercentiles();
    renderCharts();
    renderSimulationTable();
    renderTradeTable(null);
    renderReportPreview();
  }

  function renderKpis() {
    const s = state.summary;
    setKpi(el.kpiAverage, Utils.formatPercent(s.average), s.average);
    el.kpiMedian.textContent = Utils.formatPercent(s.median);
    el.kpiStdDev.textContent = Utils.formatNumber(s.stdDev);
    setKpi(el.kpiMin, Utils.formatPercent(s.min), s.min);
    setKpi(el.kpiMax, Utils.formatPercent(s.max), s.max);

    el.kpiProbProfit.textContent = `${Utils.formatNumber(s.probabilityOfProfit)}%`;
    el.kpiProb5.textContent = `${Utils.formatNumber(s.probabilityAbove5)}%`;
    el.kpiProb10.textContent = `${Utils.formatNumber(s.probabilityAbove10)}%`;
    el.kpiProb20.textContent = `${Utils.formatNumber(s.probabilityAbove20)}%`;
  }

  function setKpi(node, text, value) {
    node.textContent = text;
    node.classList.remove('positive', 'negative');
    if (value > 0) node.classList.add('positive');
    if (value < 0) node.classList.add('negative');
  }

  function renderPercentiles() {
    const p = state.summary.percentiles;
    const items = [
      { label: '5th Percentile', value: p.p5, desc: '95% of simulations finished above this value.' },
      { label: '25th Percentile', value: p.p25, desc: '75% of simulations finished above this value.' },
      { label: '50th Percentile (Median)', value: p.p50, desc: 'Half of simulations finished above this value.' },
      { label: '75th Percentile', value: p.p75, desc: '25% of simulations finished above this value.' },
      { label: '95th Percentile', value: p.p95, desc: 'Only 5% of simulations finished above this value.' }
    ];

    el.percentileGrid.innerHTML = items.map(item => `
      <div class="percentile-item">
        <span class="p-label">${item.label}</span>
        <span class="p-value">${Utils.formatPercent(item.value)}</span>
        <span class="p-desc">${item.desc}</span>
      </div>
    `).join('');
  }

  function renderCharts() {
    ChartManager.renderHistogram(el.histogramCanvas, state.histogram, state.simulations.length);
    ChartManager.renderPieChart(el.pieCanvas, state.histogram);
  }

  function renderSimulationTable() {
    const rowsHtml = state.simulations.map(sim => {
      const returnClass = sim.averageReturn > 0 ? 'value-positive' : (sim.averageReturn < 0 ? 'value-negative' : '');
      return `
        <tr class="row-clickable" data-sim-index="${sim.simulationNumber - 1}">
          <td>${sim.simulationNumber}</td>
          <td class="${returnClass}">${Utils.formatPercent(sim.averageReturn)}</td>
          <td>${sim.wins}</td>
          <td>${sim.losses}</td>
        </tr>
      `;
    }).join('');

    el.simulationTableBody.innerHTML = rowsHtml;

    el.simulationTableBody.querySelectorAll('tr[data-sim-index]').forEach(row => {
      row.addEventListener('click', () => {
        const index = parseInt(row.getAttribute('data-sim-index'), 10);
        selectSimulation(index);
      });
    });
  }

  function selectSimulation(index) {
    state.selectedSimulation = index;

    el.simulationTableBody.querySelectorAll('tr[data-sim-index]').forEach(row => {
      row.classList.toggle('row-selected', parseInt(row.getAttribute('data-sim-index'), 10) === index);
    });

    renderTradeTable(state.simulations[index]);
  }

  function renderTradeTable(simulation) {
    if (!simulation) {
      el.tradeDetailsTitle.textContent = 'Trade Details';
      el.tradeDetailsSubtitle.textContent = 'Select a simulation above';
      el.tradeTableBody.innerHTML = '';
      return;
    }

    el.tradeDetailsTitle.textContent = `Trade Details — Simulation #${simulation.simulationNumber}`;
    el.tradeDetailsSubtitle.textContent = `${simulation.trades.length} trades \u00b7 ${simulation.wins} wins \u00b7 ${simulation.losses} losses`;

    el.tradeTableBody.innerHTML = simulation.trades.map(trade => {
      const returnClass = trade.returnPct > 0 ? 'value-positive' : (trade.returnPct < 0 ? 'value-negative' : '');
      const pillClass = trade.isWin ? 'win' : 'loss';
      const pillText = trade.isWin ? 'Win' : 'Loss';
      return `
        <tr>
          <td>${trade.tradeNumber}</td>
          <td>${Utils.formatDate(trade.entryDate)}</td>
          <td>${Utils.formatDate(trade.exitDate)}</td>
          <td>${Utils.formatPrice(trade.buyPrice)}</td>
          <td>${Utils.formatPrice(trade.sellPrice)}</td>
          <td class="${returnClass}">${Utils.formatPercent(trade.returnPct)}</td>
          <td><span class="result-pill ${pillClass}">${pillText}</span></td>
        </tr>
      `;
    }).join('');
  }

  // ------------------------------------------------------------------
  // Report wiring
  // ------------------------------------------------------------------

  function buildReportParams() {
    return {
      settings: state.settingsUsed,
      summary: state.summary,
      notes: el.researchNotes.value,
      datasetName: state.datasetName,
      datasetRowCount: state.rows.length
    };
  }

  function renderReportPreview() {
    const text = ReportGenerator.buildTextReport(buildReportParams());
    el.reportPreview.textContent = text;
  }

  el.researchNotes.addEventListener('input', () => {
    if (state.summary) renderReportPreview();
  });

  el.downloadHtmlBtn.addEventListener('click', () => {
    if (!state.summary) return;
    const html = ReportGenerator.buildHtmlReport(buildReportParams());
    Utils.downloadTextFile('MonteCarloLabs-Report.html', html, 'text/html');
  });

  el.downloadTxtBtn.addEventListener('click', () => {
    if (!state.summary) return;
    const text = ReportGenerator.buildTextReport(buildReportParams());
    Utils.downloadTextFile('MonteCarloLabs-Report.txt', text, 'text/plain');
  });

  // ------------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------------

  function showError(message) {
    el.errorBanner.textContent = message;
    el.errorBanner.classList.remove('hidden');
  }

  function clearError() {
    el.errorBanner.textContent = '';
    el.errorBanner.classList.add('hidden');
  }

})();
