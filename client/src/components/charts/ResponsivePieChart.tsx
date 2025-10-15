import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { generateColorPalette, formatChartCurrency, formatChartPercentage } from '@/lib/chart-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { memo } from 'react';

interface ResponsivePieChartProps {
  data: Array<{ name: string; value: number; [key: string]: any }>;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  formatType?: 'currency' | 'percentage' | 'number';
  colors?: string[];
  showLabels?: boolean;
  testId?: string;
}

export const ResponsivePieChart = memo(function ResponsivePieChart({
  data,
  height = 300,
  innerRadius = 0,
  outerRadius,
  showLegend = true,
  formatType = 'currency',
  colors,
  showLabels = true,
  testId = "pie-chart",
}: ResponsivePieChartProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? Math.min(height, 250) : height;
  const defaultOuterRadius = isMobile ? 80 : (outerRadius || 120);
  const chartColors = colors || generateColorPalette(data.length);

  const formatValue = (value: number) => {
    switch (formatType) {
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

    const data = payload[0];
    const total = payload[0].payload.total || data.value;
    const percentage = ((data.value / total) * 100).toFixed(2);

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">{data.name}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Value:</span>
            <span className="font-medium">{formatValue(data.value)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Share:</span>
            <span className="font-medium">{percentage}%</span>
          </div>
        </div>
      </div>
    );
  };

  const renderLabel = (entry: any) => {
    if (!showLabels || isMobile) return null;
    
    const percent = ((entry.value / entry.payload.total) * 100).toFixed(0);
    return `${percent}%`;
  };

  // Calculate total for percentage calculations
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithTotal = data.map(item => ({ ...item, total }));

  return (
    <div data-testid={testId}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={dataWithTotal}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={defaultOuterRadius}
            paddingAngle={2}
            dataKey="value"
            label={renderLabel}
            labelLine={!isMobile}
          >
            {dataWithTotal.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={chartColors[index % chartColors.length]}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend 
              verticalAlign={isMobile ? "bottom" : "middle"}
              align={isMobile ? "center" : "right"}
              layout={isMobile ? "horizontal" : "vertical"}
              wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});
