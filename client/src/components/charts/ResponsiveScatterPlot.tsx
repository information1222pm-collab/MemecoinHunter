import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell } from 'recharts';
import { formatChartCurrency, formatChartPercentage, generateColorPalette } from '@/lib/chart-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { memo } from 'react';

interface ResponsiveScatterPlotProps {
  data: Array<any>;
  xKey: string;
  yKey: string;
  zKey?: string;
  height?: number;
  showGrid?: boolean;
  formatXType?: 'currency' | 'percentage' | 'number';
  formatYType?: 'currency' | 'percentage' | 'number';
  color?: string;
  colors?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  testId?: string;
}

export const ResponsiveScatterPlot = memo(function ResponsiveScatterPlot({
  data,
  xKey,
  yKey,
  zKey,
  height = 300,
  showGrid = true,
  formatXType = 'number',
  formatYType = 'number',
  color = 'hsl(262, 73%, 65%)',
  colors,
  xAxisLabel,
  yAxisLabel,
  testId = "scatter-plot",
}: ResponsiveScatterPlotProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? Math.min(height, 250) : height;

  const chartColors = colors || generateColorPalette(data.length);

  const formatAxis = (value: number, type: 'currency' | 'percentage' | 'number') => {
    switch (type) {
      case 'currency':
        return formatChartCurrency(value);
      case 'percentage':
        return formatChartPercentage(value);
      default:
        if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toLocaleString();
    }
  };

  const formatTooltipValue = (value: number, type: 'currency' | 'percentage' | 'number') => {
    switch (type) {
      case 'currency':
        return formatChartCurrency(value);
      case 'percentage':
        return formatChartPercentage(value);
      default:
        return value.toLocaleString();
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        {data.name && <p className="text-sm font-medium mb-2">{data.name}</p>}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{xAxisLabel || xKey}:</span>
            <span className="font-medium">{formatTooltipValue(data[xKey], formatXType)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{yAxisLabel || yKey}:</span>
            <span className="font-medium">{formatTooltipValue(data[yKey], formatYType)}</span>
          </div>
          {zKey && data[zKey] && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{zKey}:</span>
              <span className="font-medium">{data[zKey].toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calculate bubble sizes if zKey is provided
  const minZ = zKey ? Math.min(...data.map(d => d[zKey] || 0)) : 0;
  const maxZ = zKey ? Math.max(...data.map(d => d[zKey] || 0)) : 0;
  const zRange: [number, number] = zKey ? [minZ, maxZ] : [100, 100];

  return (
    <div data-testid={testId}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ScatterChart margin={{ top: 10, right: isMobile ? 10 : 30, left: isMobile ? 10 : 40, bottom: isMobile ? 40 : 30 }}>
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
          )}
          <XAxis 
            type="number"
            dataKey={xKey}
            name={xAxisLabel || xKey}
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            tickFormatter={(value) => formatAxis(value, formatXType)}
            label={!isMobile && xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -10 } : undefined}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={yAxisLabel || yKey}
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            tickFormatter={(value) => formatAxis(value, formatYType)}
            label={!isMobile && yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
          />
          {zKey && (
            <ZAxis 
              type="number" 
              dataKey={zKey} 
              range={[isMobile ? 50 : 100, isMobile ? 400 : 800]} 
              domain={zRange}
            />
          )}
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter
            data={data}
            fill={color}
          >
            {colors && data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
});
