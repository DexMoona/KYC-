export const MIN_LEADING_ZEROS_THRESHOLD = 4;

const SUB_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

export function toSubscript(num: number): string {
  return num.toString().split('').map(d => SUB_DIGITS[parseInt(d, 10)] || d).join('');
}

/**
 * Pure formatting function for leading-zero compression on small prices.
 * Example: 0.00000001 -> 0.0₇1 (7 leading zeros)
 * Example: 0.000103 -> 0.000103 (3 leading zeros < threshold 4)
 * Example: 0.0000103 -> 0.0₄103 (4 leading zeros >= threshold 4)
 */
export function formatCompressedPrice(
  price: number | undefined | null,
  threshold: number = MIN_LEADING_ZEROS_THRESHOLD
): string {
  if (price === undefined || price === null || isNaN(price) || !isFinite(price)) {
    return '0.00';
  }
  if (price === 0) {
    return '0.00';
  }

  const isNegative = price < 0;
  const absPrice = Math.abs(price);

  if (absPrice >= 1) {
    return (isNegative ? '-' : '') + absPrice.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  if (absPrice >= 0.01) {
    return (isNegative ? '-' : '') + absPrice.toFixed(4);
  }

  // Inspect fixed string decimal places to avoid scientific notation
  const s = absPrice.toFixed(20);
  const match = s.match(/^0\.(0+)([1-9]\d*)/);

  if (!match) {
    return (isNegative ? '-' : '') + absPrice.toFixed(6);
  }

  const zeroCount = match[1].length;
  const rawSigDigits = match[2].replace(/0+$/, '');
  const cleanSigDigits = rawSigDigits.slice(0, 4);

  if (zeroCount >= threshold) {
    const subStr = toSubscript(zeroCount);
    return (isNegative ? '-' : '') + `0.0${subStr}${cleanSigDigits}`;
  }

  // Under threshold: display full string
  return (isNegative ? '-' : '') + `0.${'0'.repeat(zeroCount)}${cleanSigDigits}`;
}

export function formatPriceWithSymbol(
  price: number | undefined | null,
  threshold: number = MIN_LEADING_ZEROS_THRESHOLD
): string {
  if (price === undefined || price === null || isNaN(price) || !isFinite(price)) {
    return '$0.00';
  }
  const formatted = formatCompressedPrice(price, threshold);
  if (formatted.startsWith('-')) {
    return '-$' + formatted.slice(1);
  }
  return '$' + formatted;
}
