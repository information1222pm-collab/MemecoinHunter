import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

export function InstantLoader() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-background via-card to-background">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(0,220,220,0.05),transparent_70%)]" />
        
        {/* Loading Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-border/20 overflow-hidden z-50">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>
        
        <div className="relative h-full flex flex-col">
          <div className="border-b border-border/40 backdrop-blur-sm bg-card/30">
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 animate-pulse" />
              <Skeleton className="h-6 w-32" />
              <div className="ml-auto flex gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="hidden md:block w-64 border-r border-border/40 backdrop-blur-sm bg-card/20 p-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-4 flex-1" style={{ width: `${60 + Math.random() * 30}%` }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-7xl mx-auto space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
                      <Skeleton className="h-4 w-20 mb-3" />
                      <Skeleton className="h-8 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
                      <Skeleton className="h-6 w-48 mb-4" />
                      <div className="space-y-3">
                        <Skeleton className="h-40 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <div className="text-sm font-medium text-muted-foreground">
                Loading MemeCoin Hunter
              </div>
              <div className="text-xs font-mono text-primary/70">
                {Math.round(progress)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PortfolioSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />

        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-10 w-40 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-background/50">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScannerSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-background/50">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 grid grid-cols-5 gap-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
