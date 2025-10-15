import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatChartCurrency, formatChartPercentage, formatChartDate } from '@/lib/chart-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { memo, useMemo } from 'react';

interface ResponsiveAreaChartProps {
  data: Array<any>;
  xKey: string;
  yKey: string | string[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  formatType?: 'currency' | 'percentage' | 'number';
  gradientColors?: string[];
  areaOpacity?: number;
  strokeWidth?: number;
  testId?: string;
}

export const ResponsiveAreaChart = memo(function ResponsiveAreaChart({
  data,
  xKey,
  yKey,
  height = 300,
  showLegend = false,
  showGrid = true,
  formatType = 'number',
  gradientColors = ['hsl(262, 73%, 65%)', 'hsl(200, 100%, 70%)'],
  areaOpacity = 0.3,
  strokeWidth = 2,
  testId = "area-chart",
}: ResponsiveAreaChartProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? Math.min(height, 250) : height;

  const yKeys = Array.isArray(yKey) ? yKey : [yKey];

  const formatYAxis = (value: number) => {
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
        <p className="text-sm font-medium mb-2">
          {typeof label === 'number' ? formatChartDate(label) : label}
        </p>
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

  // Memoize formatted data to prevent re-processing
  const formattedData = useMemo(() => 
    data.map((item) => ({
      ...item,
      displayValue: formatChartValue(item[yKey], formatType),
    })),
    [data, yKey, formatType]
  );

  return (
    <div data-testid={testId}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={formattedData} margin={{ top: 10, right: isMobile ? 10 : 30, left: isMobile ? 0 : 20, bottom: 0 }}>
          <defs>
            {yKeys.map((key, index) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="5%" 
                  stopColor={gradientColors[index % gradientColors.length]} 
                  stopOpacity={areaOpacity + 0.5}
                />
                <stop 
                  offset="95%" 
                  stopColor={gradientColors[index % gradientColors.length]} 
                  stopOpacity={areaOpacity}
                />
              </linearGradient>
            ))}
          </defs>
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
          )}
          <XAxis 
            dataKey={xKey}
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            tickFormatter={(value) => typeof value === 'number' ? formatChartDate(value) : value}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            height={isMobile ? 60 : 30}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            tickFormatter={formatYAxis}
            width={isMobile ? 50 : 80}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }} />}
          {yKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={gradientColors[index % gradientColors.length]}
              strokeWidth={strokeWidth}
              fill={`url(#gradient-${key})`}
              name={key.charAt(0).toUpperCase() + key.slice(1)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});