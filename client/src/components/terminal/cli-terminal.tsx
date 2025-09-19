import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/use-language";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TerminalLine {
  type: "input" | "output" | "error";
  content: string;
  timestamp: Date;
}

export function CLITerminal() {
  const { t } = useLanguage();
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      type: "output",
      content: "🔍 Starting memecoin scanner...",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "📡 Connecting to price feeds...",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "✅ Connected to 47 exchanges",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "🎯 Monitoring 3 tokens for high-priority alerts",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "⚠️  PEPE price spike detected: +187.3% in 1h",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "📈 FLOKI volume surge: 450% above average",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "🚨 SHIB showing bearish divergence",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "📊 Pattern analysis completed (73 patterns identified)",
      timestamp: new Date(),
    },
    {
      type: "output",
      content: "💡 ML model confidence: 85% bullish signals",
      timestamp: new Date(),
    },
  ]);
  
  const [currentCommand, setCurrentCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandMutation = useMutation({
    mutationFn: async (command: string) => {
      const response = await apiRequest("POST", "/api/cli/command", { command });
      return await response.text();
    },
    onSuccess: (result, command) => {
      setLines(prev => [
        ...prev,
        {
          type: "input",
          content: `cryptohobby@scanner:~$ ${command}`,
          timestamp: new Date(),
        },
        {
          type: "output",
          content: result,
          timestamp: new Date(),
        }
      ]);
      scrollToBottom();
    },
    onError: (error, command) => {
      setLines(prev => [
        ...prev,
        {
          type: "input",
          content: `cryptohobby@scanner:~$ ${command}`,
          timestamp: new Date(),
        },
        {
          type: "error",
          content: `Error: ${error.message}`,
          timestamp: new Date(),
        }
      ]);
      scrollToBottom();
    },
  });

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  const handleCommand = (command: string) => {
    if (!command.trim()) return;

    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    setCurrentCommand("");
    
    // Handle local commands
    if (command === "clear") {
      setLines([]);
      return;
    }

    if (command === "help") {
      setLines(prev => [
        ...prev,
        {
          type: "input",
          content: `cryptohobby@scanner:~$ ${command}`,
          timestamp: new Date(),
        },
        {
          type: "output",
          content: `Available commands:
- scan: Start token scanning
- status: Show scanner status
- alerts: Show unread alerts
- portfolio: Show portfolio summary
- patterns: Show recent patterns
- clear: Clear terminal
- help: Show this help`,
          timestamp: new Date(),
        }
      ]);
      scrollToBottom();
      return;
    }

    // Send command to server
    commandMutation.mutate(command);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCommand(currentCommand);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand("");
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  const clearTerminal = () => {
    setLines([]);
  };

  const getLineColor = (type: string) => {
    switch (type) {
      case "input":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "output":
        return "text-muted-foreground";
      default:
        return "text-foreground";
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [lines]);

  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <Card data-testid="card-cli-terminal">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CardTitle>{t("terminal.title")}</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={clearTerminal} data-testid="button-clear-terminal">
            {t("terminal.clear")}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 font-mono text-sm bg-black/20 rounded-b-lg">
        <div 
          ref={terminalRef}
          className="h-64 overflow-y-auto space-y-1 mb-4"
          data-testid="terminal-output"
        >
          {lines.map((line, index) => (
            <div
              key={index}
              className={getLineColor(line.type)}
              data-testid={`terminal-line-${line.type}-${index}`}
            >
              {line.content.split('\n').map((text, lineIndex) => (
                <div key={lineIndex}>{text}</div>
              ))}
            </div>
          ))}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-green-400">cryptohobby@scanner:~$</span>
          <Input
            ref={inputRef}
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none focus:ring-0 p-0 font-mono text-foreground"
            placeholder={t("terminal.help")}
            disabled={commandMutation.isPending}
            data-testid="input-terminal-command"
          />
          {commandMutation.isPending && (
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
          )}
          <span className="terminal-cursor">█</span>
        </div>
      </CardContent>
    </Card>
  );
}
