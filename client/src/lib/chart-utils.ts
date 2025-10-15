/**
 * Chart Utilities
 * Helper functions for formatting and transforming data for charts
 */

/**
 * Format a number as currency with proper formatting
 */
export function formatChartCurrency(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  // Format large numbers with K/M/B suffixes for chart labels
  if (absValue >= 1000000000) {
    return `${sign}$${(absValue / 1000000000).toFixed(2)}B`;
  }
  if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
  }
  if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(2)}K`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as percentage with proper formatting
 */
export function formatChartPercentage(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '0.00%';
  
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format a date for chart display
 */
export function formatChartDate(timestamp: Date | string | number): string {
  const date = new Date(timestamp);
  
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  // For recent dates (within 24h), show time
  if (diffInHours < 24) {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // For dates within current year, show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  // For older dates, show full date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Generate a color palette for multi-series charts
 */
export function generateColorPalette(count: number): string[] {
  const baseColors = [
    'hsl(220, 70%, 50%)',   // chart-1: blue
    'hsl(160, 60%, 45%)',   // chart-2: teal
    'hsl(30, 80%, 55%)',    // chart-3: orange
    'hsl(280, 65%, 60%)',   // chart-4: purple
    'hsl(340, 75%, 55%)',   // chart-5: pink
    'hsl(142, 76%, 45%)',   // green
    'hsl(0, 84%, 60%)',     // red
    'hsl(200, 100%, 70%)',  // cyan
  ];
  
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }
  
  // Generate additional colors if needed
  const colors = [...baseColors];
  while (colors.length < count) {
    const hue = (colors.length * 360 / count) % 360;
    colors.push(`hsl(${hue}, 65%, 55%)`);
  }
  
  return colors;
}

/**
 * Transform data to time series format [{timestamp, value}]
 */
export function transformToTimeSeries(
  data: any[],
  timestampKey: string = 'timestamp',
  valueKey: string = 'value'
): Array<{ timestamp: number; value: number; date?: string }> {
  if (!Array.isArray(data)) return [];
  
  return data
    .map(item => {
      const timestamp = new Date(item[timestampKey]).getTime();
      const value = parseFloat(item[valueKey]) || 0;
      
      if (isNaN(timestamp)) return null;
      
      return {
        timestamp,
        value,
        date: formatChartDate(timestamp),
      };
    })
    .filter((item): item is { timestamp: number; value: number; date: string } => item !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Transform data to allocation format [{name, value}]
 */
export function transformToAllocation(
  data: any[],
  nameKey: string = 'name',
  valueKey: string = 'value'
): Array<{ name: string; value: number; percentage?: number }> {
  if (!Array.isArray(data)) return [];
  
  const transformed = data
    .map(item => ({
      name: String(item[nameKey] || 'Unknown'),
      value: parseFloat(item[valueKey]) || 0,
    }))
    .filter(item => item.value > 0);
  
  // Calculate percentages
  const total = transformed.reduce((sum, item) => sum + item.value, 0);
  
  return transformed.map(item => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));
}

/**
 * Create histogram bins from numerical data
 */
export function createHistogramBins(
  data: number[],
  binCount: number = 10
): Array<{ range: string; count: number; min: number; max: number }> {
  if (!Array.isArray(data) || data.length === 0) return [];
  
  const validData = data.filter(val => typeof val === 'number' && !isNaN(val));
  
  if (validData.length === 0) return [];
  
  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const binSize = (max - min) / binCount;
  
  if (binSize === 0) {
    return [{
      range: `${min.toFixed(2)}`,
      count: validData.length,
      min,
      max,
    }];
  }
  
  const bins: Array<{ range: string; count: number; min: number; max: number }> = [];
  
  for (let i = 0; i < binCount; i++) {
    const binMin = min + (i * binSize);
    const binMax = i === binCount - 1 ? max : min + ((i + 1) * binSize);
    
    const count = validData.filter(val => val >= binMin && val <= binMax).length;
    
    bins.push({
      range: `${binMin.toFixed(1)} - ${binMax.toFixed(1)}`,
      count,
      min: binMin,
      max: binMax,
    });
  }
  
  return bins;
}

/**
 * Get color based on value (positive/negative)
 */
export function getValueColor(value: number): string {
  if (value > 0) return 'hsl(142, 76%, 45%)'; // green
  if (value < 0) return 'hsl(0, 84%, 60%)';   // red
  return 'hsl(215, 20%, 65%)';                 // muted gray
}

/**
 * Truncate long labels for chart display
 */
export function truncateLabel(label: string, maxLength: number = 20): string {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate moving average for smoothing time series data
 */
export function calculateMovingAverage(
  data: Array<{ timestamp: number; value: number }>,
  windowSize: number = 7
): Array<{ timestamp: number; value: number; ma: number }> {
  if (!Array.isArray(data) || data.length < windowSize) {
    return data.map(d => ({ ...d, ma: d.value }));
  }
  
  return data.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = data.slice(start, index + 1);
    const ma = window.reduce((sum, p) => sum + p.value, 0) / window.length;
    
    return { ...point, ma };
  });
}
