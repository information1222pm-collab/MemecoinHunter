import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { memo } from 'react';

interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  isEmpty?: boolean;
  className?: string;
  height?: number;
  testId?: string;
  actions?: React.ReactNode;
}

export const ChartContainer = memo(function ChartContainer({
  title,
  children,
  isLoading = false,
  error = null,
  emptyMessage = "No data available",
  isEmpty = false,
  className = "",
  height = 300,
  testId,
  actions,
}: ChartContainerProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? Math.min(height, 250) : height;

  return (
    <Card className={className} data-testid={testId}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg">{title}</CardTitle>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div 
          style={{ height: `${chartHeight}px` }} 
          className="w-full flex items-center justify-center"
        >
          {isLoading ? (
            <div className="w-full h-full flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-full w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : isEmpty ? (
            <div className="text-center text-muted-foreground">
              <p className="text-sm">{emptyMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>
      </CardContent>
    </Card>
  );
});
