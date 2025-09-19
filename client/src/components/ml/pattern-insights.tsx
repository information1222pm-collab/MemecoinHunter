import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";

interface Pattern {
  id: string;
  patternType: string;
  confidence: number;
  tokenSymbol: string;
  metadata: any;
}

export function PatternInsights() {
  const { t } = useLanguage();
  
  const { data: patterns } = useQuery<Pattern[]>({
    queryKey: ['/api/patterns/recent'],
    refetchInterval: 60000,
  });

  // Mock patterns for demonstration
  const mockPatterns = [
    {
      type: "bull_flag",
      token: "PEPE",
      confidence: 87,
      description: t("patterns.bullFlag"),
      color: "green",
    },
    {
      type: "double_bottom",
      token: "DOGE",
      confidence: 73,
      description: t("patterns.doubleBottom"),
      color: "yellow",
    },
    {
      type: "volume_spike",
      token: "FLOKI",
      confidence: 92,
      description: t("patterns.volumeSpike"),
      color: "blue",
    },
  ];

  const getPatternColorClass = (color: string) => {
    switch (color) {
      case "green":
        return "bg-green-400/10 border-green-400/20 text-green-400";
      case "yellow":
        return "bg-accent/10 border-accent/20 text-accent";
      case "blue":
        return "bg-primary/10 border-primary/20 text-primary";
      default:
        return "bg-secondary/10 border-border";
    }
  };

  return (
    <Card data-testid="card-pattern-insights">
      <CardHeader>
        <CardTitle>{t("patterns.aiRecognition")}</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {mockPatterns.map((pattern, index) => (
            <div
              key={index}
              className={`p-3 border rounded-lg ${getPatternColorClass(pattern.color)}`}
              data-testid={`pattern-${pattern.type}-${pattern.token}`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div className={`w-2 h-2 rounded-full bg-${pattern.color}-400`} />
                <span className="text-sm font-medium" data-testid={`text-pattern-name-${pattern.token}`}>
                  {pattern.type.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground" data-testid={`text-pattern-description-${pattern.token}`}>
                {pattern.token} {pattern.description}. {t("patterns.confidence")}: {pattern.confidence}%
              </p>
            </div>
          ))}
        </div>
        
        <Button variant="secondary" className="w-full mt-4" data-testid="button-view-all-signals">
          {t("patterns.viewAll")}
        </Button>
      </CardContent>
    </Card>
  );
}
