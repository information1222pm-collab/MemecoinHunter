/**
 * Safe number parsing utilities to prevent NaN propagation
 * Handles edge cases like "NaN" strings, null, undefined, and invalid values
 */

/**
 * Safely parse a value to a number, with fallback for invalid values
 * @param value - The value to parse (can be string, number, null, undefined)
 * @param fallback - The fallback value if parsing fails (default: 0)
 * @returns A valid number, never NaN
 */
export function safeParseFloat(value: string | number | null | undefined, fallback: number = 0): number {
  // Handle null, undefined, or empty string
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  // Handle "NaN" string explicitly
  if (typeof value === 'string' && value.toLowerCase() === 'nan') {
    return fallback;
  }

  // Parse the value
  const parsed = typeof value === 'number' ? value : parseFloat(value);

  // Check if the result is NaN or infinite
  if (isNaN(parsed) || !isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

/**
 * Safely format a number to fixed decimal places, handling NaN
 * @param value - The value to format
 * @param decimals - Number of decimal places (default: 2)
 * @param fallback - Fallback string if value is invalid (default: "0.00")
 * @returns Formatted string
 */
export function safeToFixed(value: number | string | null | undefined, decimals: number = 2, fallback: string = '0.00'): string {
  const num = safeParseFloat(value, 0);
  
  if (!isFinite(num)) {
    return fallback;
  }

  return num.toFixed(decimals);
}

/**
 * Safely divide two numbers, preventing division by zero
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @param fallback - Fallback value if division fails (default: 0)
 * @returns Result of division or fallback
 */
export function safeDivide(
  numerator: number | string | null | undefined,
  denominator: number | string | null | undefined,
  fallback: number = 0
): number {
  const num = safeParseFloat(numerator, 0);
  const denom = safeParseFloat(denominator, 0);

  if (denom === 0 || !isFinite(num) || !isFinite(denom)) {
    return fallback;
  }

  const result = num / denom;
  return isFinite(result) ? result : fallback;
}

/**
 * Ensure a value is a valid number for database storage
 * @param value - The value to validate
 * @param fallback - Fallback value (default: "0")
 * @returns String representation safe for database
 */
export function safeDbNumber(value: number | string | null | undefined, fallback: string = '0'): string {
  const num = safeParseFloat(value, parseFloat(fallback));
  
  if (!isFinite(num)) {
    return fallback;
  }

  return num.toString();
}

/**
 * Check if a value is NaN or infinite
 * @param value - The value to check
 * @returns true if invalid, false if valid
 */
export function isInvalidNumber(value: any): boolean {
  if (value === null || value === undefined) return true;
  
  if (typeof value === 'string' && value.toLowerCase() === 'nan') return true;
  
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) || !isFinite(num);
}
