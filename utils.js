/**
 * utils.js
 * -----------------------------------------------------------------------
 * Generic, side-effect-free helper functions shared across the app.
 * This module must NOT contain any business logic (no simulation rules,
 * no statistics formulas, no DOM wiring). It only provides small,
 * reusable utilities.
 * -----------------------------------------------------------------------
 */

const Utils = (() => {

  /**
   * Convert an Excel serial date number into a JS Date object.
   * Excel's epoch is 1899-12-30 (accounts for the historic Lotus 1-2-3 leap
   * year bug that Excel deliberately preserved).
   * @param {number} serial
   * @returns {Date}
   */
  function excelSerialToDate(serial) {
    const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    return new Date(EXCEL_EPOCH_MS + Math.round(serial) * MS_PER_DAY);
  }

  /**
   * Attempt to parse a date value coming from a spreadsheet or CSV cell.
   * Handles:
   *  - JS Date objects (already parsed by SheetJS)
   *  - Excel serial numbers
   *  - Strings in YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
   * Returns a normalized Date at UTC midnight, or null if parsing fails.
   * @param {*} value
   * @returns {Date|null}
   */
  function parseFlexibleDate(value) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date && !isNaN(value.getTime())) {
      return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    }

    if (typeof value === 'number' && isFinite(value)) {
      // Excel serial dates are typically in this plausible range (1900-2100)
      if (value > 0 && value < 200000) {
        return excelSerialToDate(value);
      }
      return null;
    }

    if (typeof value !== 'string') return null;

    const raw = value.trim();
    if (raw === '') return null;

    // ISO style: YYYY-MM-DD or YYYY/MM/DD
    let m = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) {
      const [, y, mo, d] = m;
      return safeUTCDate(+y, +mo - 1, +d);
    }

    // DD Mon YYYY  e.g. "04 Jul 2026" (Investing.com style)
    m = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
    if (m) {
      const [, d, monName, y] = m;
      const monthIndex = monthNameToIndex(monName);
      if (monthIndex !== -1) return safeUTCDate(+y, monthIndex, +d);
    }

    // Mon DD, YYYY  e.g. "Jul 04, 2026"
    m = raw.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m) {
      const [, monName, d, y] = m;
      const monthIndex = monthNameToIndex(monName);
      if (monthIndex !== -1) return safeUTCDate(+y, monthIndex, +d);
    }

    // Numeric with separators: could be MM/DD/YYYY or DD/MM/YYYY or DD.MM.YYYY
    m = raw.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})$/);
    if (m) {
      const [, a, b, y] = m;
      return { ambiguous: true, a: +a, b: +b, y: +y };
    }

    return null;
  }

  function monthNameToIndex(name) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const idx = months.indexOf(name.slice(0, 3).toLowerCase());
    return idx;
  }

  /**
   * Build a UTC date and validate that the resulting date actually
   * matches the requested day/month/year (guards against e.g. day=31
   * in a 30-day month rolling over into the next month silently).
   */
  function safeUTCDate(year, monthIndex, day) {
    const d = new Date(Date.UTC(year, monthIndex, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) {
      return null;
    }
    return d;
  }

  /**
   * Resolve a column of ambiguous numeric dates (MM/DD/YYYY vs DD/MM/YYYY)
   * by inspecting the whole column at once: if any row has a first number
   * greater than 12, the format must be DD/MM/YYYY across the column.
   * Falls back to MM/DD/YYYY (US) as the default convention.
   * @param {Array} ambiguousDates - array of {ambiguous:true, a, b, y} or Date or null
   * @returns {Array<Date|null>}
   */
  function resolveAmbiguousDateColumn(rawParsedValues) {
    let dayFirst = false;
    for (const val of rawParsedValues) {
      if (val && val.ambiguous && val.a > 12) {
        dayFirst = true;
        break;
      }
    }
    return rawParsedValues.map(val => {
      if (!val) return null;
      if (!val.ambiguous) return val;
      const day = dayFirst ? val.a : val.b;
      const month = dayFirst ? val.b : val.a;
      return safeUTCDate(val.y, month - 1, day);
    });
  }

  /**
   * Detect the delimiter used in a CSV text sample by counting occurrences
   * of common candidates on the header line.
   * @param {string} sampleLine
   * @returns {string}
   */
  function detectDelimiter(sampleLine) {
    const candidates = [',', ';', '\t', '|'];
    let best = ',';
    let bestCount = -1;
    for (const cand of candidates) {
      const count = sampleLine.split(cand).length - 1;
      if (count > bestCount) {
        bestCount = count;
        best = cand;
      }
    }
    return best;
  }

  /**
   * Parse a numeric value that may use different thousand/decimal
   * separators, percentage signs, or currency symbols.
   * e.g. "1,234.56", "1.234,56", "12.5%", "$45.20"
   * @param {*} value
   * @returns {number|null}
   */
  function parseFlexibleNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;

    let str = value.trim();
    if (str === '' || str === '-' || str.toLowerCase() === 'n/a') return null;

    const isPercent = str.includes('%');
    str = str.replace(/[%$€£\s]/g, '');

    // European style: 1.234,56 -> has both separators and comma comes last
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) {
        // comma is decimal separator
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        // dot is decimal separator
        str = str.replace(/,/g, '');
      }
    } else if (lastComma > -1 && lastDot === -1) {
      // Only commas present. Could be thousands (1,234) or decimal (1234,56)
      const parts = str.split(',');
      if (parts[parts.length - 1].length === 3 && parts.length > 1) {
        str = str.replace(/,/g, ''); // thousands separator
      } else {
        str = str.replace(',', '.'); // decimal separator
      }
    }

    const num = parseFloat(str);
    if (isNaN(num)) return null;
    return isPercent ? num : num;
  }

  /**
   * Return a pseudo-random float in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * Return a pseudo-random integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  /**
   * Format a number as currency-like price string.
   * @param {number} value
   * @returns {string}
   */
  function formatPrice(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Format a number as a signed percentage string, e.g. +3.42% / -1.05%
   * @param {number} value
   * @param {number} [decimals=2]
   * @returns {string}
   */
  function formatPercent(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
  }

  /**
   * Format a plain number with fixed decimals, no sign.
   * @param {number} value
   * @param {number} [decimals=2]
   * @returns {string}
   */
  function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return value.toFixed(decimals);
  }

  /**
   * Format a Date object as YYYY-MM-DD for display and export.
   * @param {Date} date
   * @returns {string}
   */
  function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '—';
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Trigger a browser download of a text blob.
   * @param {string} filename
   * @param {string} content
   * @param {string} mimeType
   */
  function downloadTextFile(filename, content, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Escape a string for safe insertion into HTML.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Yield control back to the browser event loop.
   * Used to break up long-running loops so the UI stays responsive.
   * @returns {Promise<void>}
   */
  function yieldToBrowser() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Normalize an arbitrary header string for column-matching purposes:
   * lowercased, trimmed, punctuation removed.
   * @param {string} header
   * @returns {string}
   */
  function normalizeHeader(header) {
    return String(header || '')
      .toLowerCase()
      .trim()
      .replace(/[.\s_-]+/g, '')
      .replace(/%/g, 'pct');
  }

  return {
    excelSerialToDate,
    parseFlexibleDate,
    resolveAmbiguousDateColumn,
    detectDelimiter,
    parseFlexibleNumber,
    randomBetween,
    randomInt,
    formatPrice,
    formatPercent,
    formatNumber,
    formatDate,
    downloadTextFile,
    escapeHtml,
    yieldToBrowser,
    normalizeHeader
  };
})();
