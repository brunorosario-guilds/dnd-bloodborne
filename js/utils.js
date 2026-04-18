/* ============================================================
   ECOS DO PASSADO — Utilities
   Helper functions for formatting and calculations
   ============================================================ */

const Utils = {
  /**
   * Calculate ability modifier from score
   * @param {number} score - Ability score (1–30)
   * @returns {number} Modifier
   */
  calcModifier(score) {
    return Math.floor((score - 10) / 2);
  },

  /**
   * Format modifier with sign (+/-)
   * @param {number} mod - Modifier value
   * @returns {string} Formatted string (e.g., "+2", "-1", "0")
   */
  formatModifier(mod) {
    if (mod > 0) return `+${mod}`;
    return `${mod}`;
  },

  /**
   * Clamp a number between min and max
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Generate a simple unique ID
   */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  /**
   * Debounce function calls
   */
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /**
   * Download a blob as a file
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
