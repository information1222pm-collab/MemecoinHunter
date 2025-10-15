import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { createHistogramBins, getValueColor } from '@/lib/chart-utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveHistogramProps {
  data: number[];
  binCount?: number;
  height?: number;
  showGrid?: boolean;
  color?: string;
  colorByValue?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  testId?: string;
}

export function ResponsiveHistogram({
  data,
  binCount = 10,
  height = 300,
  showGrid = true,
  color = 'hsl(262, 73%, 65%)',
  colorByValue = false,
  xAxisLabel = "Range",
  yAxisLabel = "Frequency",
  testId = "histogram",
}: ResponsiveHistogramProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? Math.min(height, 250) : height;

  const bins = createHistogramBins(data, binCount);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium mb-2">Range: {data.range}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Count:</span>
            <span className="font-medium">{data.count}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Percentage:</span>
            <span className="font-medium">
              {((data.count / data.length) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div data-testid={testId}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart 
          data={bins} 
          margin={{ top: 10, right: isMobile ? 10 : 30, left: isMobile ? 10 : 20, bottom: isMobile ? 60 : 30 }}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))"
              opacity={0.3}
            />
          )}
          <XAxis 
            dataKey="range"
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 9 : 11}
            angle={isMobile ? -45 : -30}
            textAnchor="end"
            height={isMobile ? 80 : 60}
            label={!isMobile ? { value: xAxisLabel, position: 'insideBottom', offset: -20 } : undefined}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            label={!isMobile ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            fill={color}
            radius={[4, 4, 0, 0]}
          >
            {colorByValue && bins.map((entry, index) => {
              const midpoint = (entry.min + entry.max) / 2;
              return (
                <Cell key={`cell-${index}`} fill={getValueColor(midpoint)} />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
