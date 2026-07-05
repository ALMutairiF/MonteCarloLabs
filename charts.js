/**
 * charts.js
 * -----------------------------------------------------------------------
 * Responsibility: CHARTS ONLY.
 * Wraps Chart.js instances for the histogram and pie chart. Holds no
 * simulation or statistics logic of its own; it only renders data handed
 * to it by app.js.
 * -----------------------------------------------------------------------
 */

const ChartManager = (() => {

  let histogramChart = null;
  let pieChart = null;

  const PALETTE = {
    win: '#16A34A',
    loss: '#DC2626',
    neutral: '#1857C4',
    grid: '#E4E9F2',
    text: '#42506B'
  };

  /**
   * Render (or re-render) the return-distribution histogram.
   * @param {HTMLCanvasElement} canvas
   * @param {{labels: string[], counts: number[]}} histogramData
   * @param {number} totalSimulations
   */
  function renderHistogram(canvas, histogramData, totalSimulations) {
    const { labels, counts } = histogramData;
    const percentages = counts.map(c => (totalSimulations ? (c / totalSimulations) * 100 : 0));
    const colors = labels.map(label => {
      // Color bins red if their range is entirely negative, green if
      // entirely positive, blue if it straddles zero.
      const [lowStr, highStr] = label.replace(/%/g, '').split(' to ');
      const low = parseFloat(lowStr);
      const high = parseFloat(highStr);
      if (high <= 0) return PALETTE.loss;
      if (low >= 0) return PALETTE.win;
      return PALETTE.neutral;
    });

    if (histogramChart) {
      histogramChart.destroy();
    }

    histogramChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Simulations',
          data: counts,
          backgroundColor: colors,
          borderWidth: 0,
          borderRadius: 3,
          percentages
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        scales: {
          x: {
            title: { display: true, text: 'Average Return per Simulation', color: PALETTE.text },
            ticks: { color: PALETTE.text, maxRotation: 60, minRotation: 45, autoSkip: true },
            grid: { color: PALETTE.grid }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Number of Simulations', color: PALETTE.text },
            ticks: { color: PALETTE.text, precision: 0 },
            grid: { color: PALETTE.grid }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Return Range: ${items[0].label}`,
              label: (item) => {
                const pct = item.dataset.percentages[item.dataIndex];
                return [
                  `Number of Simulations: ${item.raw}`,
                  `Percentage of Simulations: ${pct.toFixed(2)}%`
                ];
              }
            }
          }
        }
      }
    });

    return histogramChart;
  }

  /**
   * Render (or re-render) the pie chart using the same bins as the
   * histogram, grouped into Loss / Neutral / Win ranges for readability.
   * @param {HTMLCanvasElement} canvas
   * @param {{labels: string[], counts: number[]}} histogramData
   */
  function renderPieChart(canvas, histogramData) {
    const { labels, counts } = histogramData;

    if (pieChart) {
      pieChart.destroy();
    }

    pieChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: labels.map((label, i) => {
            const [lowStr, highStr] = label.replace(/%/g, '').split(' to ');
            const low = parseFloat(lowStr);
            const high = parseFloat(highStr);
            if (high <= 0) return shadeColor(PALETTE.loss, i);
            if (low >= 0) return shadeColor(PALETTE.win, i);
            return shadeColor(PALETTE.neutral, i);
          }),
          borderColor: '#FFFFFF',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: PALETTE.text,
              boxWidth: 12,
              font: { size: 10 }
            }
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const total = item.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total ? (item.raw / total) * 100 : 0;
                return `${item.label}: ${item.raw} simulations (${pct.toFixed(2)}%)`;
              }
            }
          }
        }
      }
    });

    return pieChart;
  }

  /**
   * Produce a lightly-varied shade of a base hex color so pie slices in
   * the same category remain visually distinguishable.
   * @param {string} hex
   * @param {number} index
   * @returns {string}
   */
  function shadeColor(hex, index) {
    const amount = ((index % 5) - 2) * 8; // -16..+16
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function destroyAll() {
    if (histogramChart) { histogramChart.destroy(); histogramChart = null; }
    if (pieChart) { pieChart.destroy(); pieChart = null; }
  }

  return {
    renderHistogram,
    renderPieChart,
    destroyAll
  };
})();
