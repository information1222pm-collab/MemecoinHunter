import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { formatChartCurrency, formatChartPercentage, generateColorPalette, truncateLabel, getValueColor } from '@/lib/chart-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { memo } from 'react';

interface ResponsiveBarChartProps {
  data: Array<any>;
  xKey: string;
  yKey: string | string[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  formatType?: 'currency' | 'percentage' | 'number';
  colors?: string[];
  horizontal?: boolean;
  stacked?: boolean;
  colorByValue?: boolean;
  testId?: string;
}

export const ResponsiveBarChart = memo(function ResponsiveBarChart({
  data,
  xKey,
  yKey,
  height = 300,
  showLegend = false,
  showGrid = true,
  formatType = 'number',
  colors,
  horizontal = false,
  stacked = false,
  colorByValue = false,
  testId = "bar-chart",
}: ResponsiveBarChartProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? Math.min(height, 250) : height;

  const yKeys = Array.isArray(yKey) ? yKey : [yKey];
  const chartColors = colors || generateColorPalette(yKeys.length);

  const formatAxis = (value: number | string) => {
    if (typeof value === 'string') return truncateLabel(value, isMobile ? 8 : 15);
    
    switch (formatType) {
      case 'currency':
        return formatChartCurrency(value);
      case 'percentage':
        return formatChartPercentage(value);
      default:
        return value.toLocaleString();
    }
  };

  const formatTooltipValue = (value: number) => {
    switch (formatType) {
      case 'currency':
        return formatChartCurrency(value);
      case 'percentage':
        return formatChartPercentage(value);
      default:
        return value.toLocaleString();
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{formatTooltipValue(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const chartMargin = { 
    top: 10, 
    right: isMobile ? 10 : 30, 
    left: isMobile ? 10 : 40, 
    bottom: isMobile ? 60 : 30 
  };

  return (
    <div data-testid={testId}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart 
          data={data} 
          margin={chartMargin}
          layout={horizontal ? "vertical" : "horizontal"}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
          )}
          {horizontal ? (
            <>
              <XAxis 
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={isMobile ? 10 : 12}
                tickFormatter={formatAxis}
              />
              <YAxis 
                dataKey={xKey}
                type="category"
                stroke="hsl(var(--muted-foreground))"
                fontSize={isMobile ? 10 : 12}
                tickFormatter={formatAxis}
                width={isMobile ? 60 : 100}
              />
            </>
          ) : (
            <>
              <XAxis 
                dataKey={xKey}
                stroke="hsl(var(--muted-foreground))"
                fontSize={isMobile ? 10 : 12}
                tickFormatter={formatAxis}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 80 : 30}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={isMobile ? 10 : 12}
                tickFormatter={formatAxis}
              />
            </>
          )}
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }} />}
          {yKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={chartColors[index % chartColors.length]}
              name={key.charAt(0).toUpperCase() + key.slice(1)}
              stackId={stacked ? "stack" : undefined}
              radius={[4, 4, 0, 0]}
            >
              {colorByValue && data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={getValueColor(entry[key])} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
