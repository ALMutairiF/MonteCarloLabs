/**
 * loader.js
 * -----------------------------------------------------------------------
 * Responsibility: LOADING DATA ONLY.
 * Reads .xlsx / .xls / .csv files, detects columns and delimiters,
 * normalizes rows into { date, open, high, low, close, volume, changePercent }
 * and returns them sorted chronologically (oldest -> newest).
 *
 * Does not run simulations, compute statistics, or touch the DOM beyond
 * reading the File object handed to it.
 * -----------------------------------------------------------------------
 */

const DataLoader = (() => {

  /** Column name candidates mapped to internal field names. */
  const COLUMN_ALIASES = {
    date: ['date'],
    open: ['open'],
    high: ['high'],
    low: ['low'],
    close: ['close', 'price', 'last', 'lastprice', 'closingprice', 'adjclose', 'adjustedclose'],
    volume: ['vol', 'volume', 'vol.'],
    changePercent: ['changepct', 'change', 'chgpct', 'changepercent']
  };

  /**
   * Entry point: load and parse a File object.
   * @param {File} file
   * @returns {Promise<{rows: Array<Object>, warnings: string[]}>}
   */
  async function loadFile(file) {
    const extension = getExtension(file.name);
    let matrix; // Array of arrays (raw grid), first row = headers

    if (extension === 'csv' || extension === 'txt') {
      matrix = await parseCsvFile(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      matrix = await parseExcelFile(file);
    } else {
      throw new LoaderError(
        `Unsupported file type ".${extension}". Please upload a .csv, .xls, or .xlsx file.`
      );
    }

    if (!matrix || matrix.length < 2) {
      throw new LoaderError('The file appears to be empty or has no data rows.');
    }

    return buildRowsFromMatrix(matrix);
  }

  /** Custom error type so app.js can distinguish user-facing load errors. */
  class LoaderError extends Error {
    constructor(message) {
      super(message);
      this.name = 'LoaderError';
    }
  }

  function getExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  /**
   * Parse a CSV/TXT file into a raw grid of strings, auto-detecting the
   * delimiter from the header line.
   * @param {File} file
   * @returns {Promise<string[][]>}
   */
  function parseCsvFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new LoaderError('Could not read the file from disk.'));
      reader.onload = () => {
        try {
          const text = String(reader.result).replace(/^\uFEFF/, ''); // strip BOM
          const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
          if (lines.length === 0) {
            resolve([]);
            return;
          }
          const delimiter = Utils.detectDelimiter(lines[0]);
          const grid = lines.map(line => splitCsvLine(line, delimiter));
          resolve(grid);
        } catch (err) {
          reject(new LoaderError('Failed to parse the CSV file. It may be malformed.'));
        }
      };
      reader.readAsText(file);
    });
  }

  /**
   * Split a single CSV line respecting quoted fields that may contain the
   * delimiter character.
   * @param {string} line
   * @param {string} delimiter
   * @returns {string[]}
   */
  function splitCsvLine(line, delimiter) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map(f => f.trim());
  }

  /**
   * Parse an .xlsx/.xls file using SheetJS into a raw grid.
   * @param {File} file
   * @returns {Promise<Array<Array<*>>>}
   */
  function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new LoaderError('Could not read the file from disk.'));
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
          resolve(grid);
        } catch (err) {
          reject(new LoaderError('Failed to parse the Excel file. It may be corrupted or in an unsupported format.'));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Given a raw grid (header row + data rows), identify columns, parse
   * values, and produce normalized, chronologically sorted row objects.
   * @param {Array<Array<*>>} matrix
   * @returns {{rows: Array<Object>, warnings: string[]}}
   */
  function buildRowsFromMatrix(matrix) {
    const warnings = [];
    const headerRow = matrix[0];
    const columnMap = detectColumns(headerRow);

    if (columnMap.date === -1) {
      throw new LoaderError('Could not find a "Date" column in the file. Please check the file headers.');
    }
    if (columnMap.close === -1) {
      throw new LoaderError('Could not find a closing price column (Close / Price / Last) in the file.');
    }

    const dataRows = matrix.slice(1);

    // First pass: parse dates (may be ambiguous) and numeric fields.
    const parsedDates = [];
    const intermediate = [];

    for (const rawRow of dataRows) {
      if (!rawRow || rawRow.every(cell => cell === '' || cell === null || cell === undefined)) {
        continue; // skip blank rows
      }
      const dateVal = Utils.parseFlexibleDate(rawRow[columnMap.date]);
      parsedDates.push(dateVal);

      const openVal = columnMap.open !== -1 ? Utils.parseFlexibleNumber(rawRow[columnMap.open]) : null;
      const highVal = columnMap.high !== -1 ? Utils.parseFlexibleNumber(rawRow[columnMap.high]) : null;
      const lowVal = columnMap.low !== -1 ? Utils.parseFlexibleNumber(rawRow[columnMap.low]) : null;
      const closeVal = Utils.parseFlexibleNumber(rawRow[columnMap.close]);
      const volumeVal = columnMap.volume !== -1 ? Utils.parseFlexibleNumber(rawRow[columnMap.volume]) : null;
      const changeVal = columnMap.changePercent !== -1 ? Utils.parseFlexibleNumber(rawRow[columnMap.changePercent]) : null;

      intermediate.push({
        open: openVal,
        high: highVal,
        low: lowVal,
        close: closeVal,
        volume: volumeVal,
        changePercent: changeVal
      });
    }

    const resolvedDates = Utils.resolveAmbiguousDateColumn(parsedDates);

    let rows = [];
    let invalidDateCount = 0;
    let invalidPriceCount = 0;

    for (let i = 0; i < intermediate.length; i++) {
      const date = resolvedDates[i];
      const item = intermediate[i];

      if (!date) {
        invalidDateCount++;
        continue;
      }
      if (item.close === null || item.close === undefined) {
        invalidPriceCount++;
        continue;
      }

      // Fall back to close price when open/high/low are unavailable so
      // downstream simulation logic always has usable numbers.
      const open = item.open !== null ? item.open : item.close;
      const high = item.high !== null ? item.high : Math.max(open, item.close);
      const low = item.low !== null ? item.low : Math.min(open, item.close);

      rows.push({
        date,
        open,
        high,
        low,
        close: item.close,
        volume: item.volume !== null ? item.volume : 0,
        changePercent: item.changePercent !== null ? item.changePercent : 0
      });
    }

    if (invalidDateCount > 0) {
      warnings.push(`${invalidDateCount} row(s) were skipped due to unparseable dates.`);
    }
    if (invalidPriceCount > 0) {
      warnings.push(`${invalidPriceCount} row(s) were skipped due to missing or invalid closing prices.`);
    }

    if (rows.length < 30) {
      throw new LoaderError(
        `Dataset too small: only ${rows.length} valid row(s) found. At least 30 rows of historical data are required to run meaningful simulations.`
      );
    }

    // Detect direction and reverse to oldest -> newest if needed.
    const isDescending = rows.length > 1 && rows[0].date.getTime() > rows[rows.length - 1].date.getTime();
    if (isDescending) {
      rows.reverse();
      warnings.push('Data was detected in newest-to-oldest order and was automatically reversed.');
    }

    // De-duplicate identical dates, keeping the first occurrence, and make
    // sure the series is strictly increasing in date order.
    const deduped = [];
    let lastTime = -Infinity;
    let duplicateCount = 0;
    for (const row of rows) {
      const t = row.date.getTime();
      if (t === lastTime) {
        duplicateCount++;
        continue;
      }
      deduped.push(row);
      lastTime = t;
    }
    if (duplicateCount > 0) {
      warnings.push(`${duplicateCount} duplicate date row(s) were removed.`);
    }

    return { rows: deduped, warnings };
  }

  /**
   * Map each internal field name to a column index in the header row.
   * @param {Array<*>} headerRow
   * @returns {Object<string, number>}
   */
  function detectColumns(headerRow) {
    const normalizedHeaders = headerRow.map(h => Utils.normalizeHeader(h));
    const columnMap = {};

    for (const field of Object.keys(COLUMN_ALIASES)) {
      columnMap[field] = -1;
      const aliases = COLUMN_ALIASES[field].map(Utils.normalizeHeader);
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (aliases.includes(normalizedHeaders[i])) {
          columnMap[field] = i;
          break;
        }
      }
    }

    return columnMap;
  }

  return {
    loadFile,
    LoaderError
  };
})();
