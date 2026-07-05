# MonteCarloLabs

**MonteCarloLabs** is a fully client-side, browser-based research tool for evaluating the **historical statistical characteristics** of a stock using Monte Carlo simulation.

> MonteCarloLabs does not predict future prices. It resamples your imported historical data thousands of times to reveal the statistical tendencies of a given holding-period strategy — average return, volatility, win probability, and percentile outcomes.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Supported File Formats](#supported-file-formats)
  - [CSV Example](#csv-example)
  - [Excel Example](#excel-example)
- [How the Simulation Works](#how-the-simulation-works)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

- 100% client-side — no backend, no database, no data leaves your browser
- Import `.csv`, `.xls`, and `.xlsx` historical price files
- Automatic column detection (`Date`, `Open`, `Close`, `Price`, `Last`, etc.)
- Automatic delimiter detection (`,` or `;`)
- Automatic date-format detection (ISO, US, European, Excel serial dates)
- Automatic chronological sorting (reverses newest→oldest files automatically)
- Configurable Monte Carlo engine: trades per simulation, hold days, simulation count, buy method, duplicate-entry-date handling
- Handles up to 100,000 simulations without freezing the browser (chunked, non-blocking execution)
- Full statistical summary: average, median, standard deviation, min, max, probability of profit, probability of exceeding +5% / +10% / +20%
- Percentile breakdown (5th / 25th / 50th / 75th / 95th) with plain-language interpretation
- Histogram and pie chart visualizations of the return distribution
- Drill-down tables: simulation summary → individual trade details
- Freeform research notes area
- One-click report export as `.html` or `.txt`

---

## Installation

MonteCarloLabs requires no build step, no package manager, and no server.

1. Download or clone the `MonteCarloLabs/` folder.
2. Open `index.html` directly in a modern browser (Chrome, Firefox, Edge, or Safari).

That's it — the app runs entirely from the local file system, loading Chart.js and SheetJS from a CDN at runtime.

> **Note:** An internet connection is required on first load to fetch the Chart.js and SheetJS libraries and the Google Fonts used in the interface. All data processing itself happens locally in your browser.

---

## Usage

1. **Import Data** — Drag and drop, or click to browse for, a `.csv`, `.xls`, or `.xlsx` file containing historical daily price data.
2. **Configure Simulation Settings**:
   - **Trades per Simulation** — how many trades make up one simulation run.
   - **Hold Days** — how many trading days each simulated trade is held before exiting.
   - **Monte Carlo Simulations** — how many independent simulations to run (up to 100,000).
   - **Buy Method** — whether the simulated entry price is a random value between the day's Open and Close, the Open price, or the Close price.
   - **Allow duplicate entry dates** — whether the same historical day can be selected as an entry point more than once within a single simulation.
3. Click **Run Simulation**. A progress bar shows live progress for large simulation counts.
4. Review the **KPI strip**, **percentiles**, **histogram**, and **pie chart**.
5. Click any row in the **Simulation Summary** table to inspect that simulation's individual **Trade Details**.
6. Add observations in **Research Notes** (notes persist until the page is refreshed).
7. Click **Save as HTML** or **Save as TXT** to export a complete research report.

---

## Supported File Formats

MonteCarloLabs automatically detects:

- File type: `.csv`, `.xls`, `.xlsx`
- Delimiter: comma (`,`) or semicolon (`;`)
- Column names (case-insensitive): `Date`, `Open`, `High`, `Low`, `Close`/`Price`/`Last`/`Closing Price`, `Volume`/`Vol.`, `Change %`
- Date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, `DD.MM.YYYY`, Excel serial dates, and `"04 Jul 2026"`-style formats
- Row order: automatically reverses newest→oldest data into chronological order

### CSV Example

A standard historical price export:

```csv
Date,Open,High,Low,Close,Volume
2024-01-02,182.15,184.20,181.50,183.75,58412300
2024-01-03,183.60,185.10,182.90,184.42,49220100
2024-01-04,184.30,186.00,183.80,185.91,51033700
```

An Investing.com-style export is also supported directly:

```csv
Date,Price,Open,High,Low,Vol.,Change %
"Jan 04, 2024",185.91,184.30,186.00,183.80,"51.03M","0.81%"
"Jan 03, 2024",184.42,183.60,185.10,182.90,"49.22M","0.36%"
"Jan 02, 2024",183.75,182.15,184.20,181.50,"58.41M","-0.12%"
```

### Excel Example

An `.xlsx` file with the following header row and daily rows works out of the box:

| Date       | Open   | Close  |
|------------|--------|--------|
| 2024-01-02 | 182.15 | 183.75 |
| 2024-01-03 | 183.60 | 184.42 |
| 2024-01-04 | 184.30 | 185.91 |

Excel serial date numbers in the `Date` column are also parsed correctly.

---

## How the Simulation Works

For each of the *N* Monte Carlo simulations:

1. For each of the configured **Trades per Simulation**:
   - A random historical day is chosen as the **entry day** (respecting the duplicate-entry-date setting).
   - The **buy price** is computed per the selected Buy Method (random point between Open/Close, Open, or Close).
   - The **exit day** is the entry day plus the configured **Hold Days**.
   - The **sell price** is that day's Close price.
   - **Return %** is calculated as `(sellPrice - buyPrice) / buyPrice * 100`.
2. The simulation's average return, win count, and loss count are recorded.

Across all simulations, MonteCarloLabs aggregates every individual trade's return into an overall statistical summary (mean, median, standard deviation, min, max, and probability thresholds), and bins each simulation's *average* return into a histogram / pie chart for distribution visualization.

---

## Project Structure

```
MonteCarloLabs/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          # UI wiring only
│   ├── loader.js       # File loading & parsing only
│   ├── simulation.js   # Monte Carlo engine only
│   ├── statistics.js   # Statistical calculations only
│   ├── charts.js       # Chart.js rendering only
│   ├── report.js       # Report generation only
│   └── utils.js        # Generic helper functions only
└── README.md
```

---

## Screenshots

> _placeholder: dashboard-overview.png — full dashboard with KPI strip, percentiles, and charts_

> _placeholder: trade-details.png — simulation summary table with trade drill-down_

> _placeholder: report-export.png — generated HTML research report_

---

## Roadmap

- [ ] Multi-symbol comparison mode (side-by-side simulations)
- [ ] Configurable histogram bin count from the UI
- [ ] Support for intraday (minute/hour) datasets
- [ ] Save/load simulation presets to a local file
- [ ] Optional stop-loss / take-profit exit rules within a simulation
- [ ] Dark mode theme

---

## License

MIT License. MonteCarloLabs is provided for educational and historical research purposes only. It does not constitute financial advice, and past statistical tendencies are not indicative of future performance.
