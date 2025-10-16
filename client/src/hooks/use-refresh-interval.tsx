import { createContext, useContext, useState, useEffect } from "react";

interface RefreshIntervalContextType {
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
}

const RefreshIntervalContext = createContext<RefreshIntervalContextType | undefined>(undefined);

export function RefreshIntervalProvider({ children }: { children: React.ReactNode }) {
  const [refreshInterval, setRefreshIntervalState] = useState<number>(() => {
    const stored = localStorage.getItem('refreshInterval');
    return stored ? parseInt(stored, 10) : 30;
  });

  const setRefreshInterval = (interval: number) => {
    setRefreshIntervalState(interval);
    localStorage.setItem('refreshInterval', interval.toString());
  };

  useEffect(() => {
    localStorage.setItem('refreshInterval', refreshInterval.toString());
  }, [refreshInterval]);

  return (
    <RefreshIntervalContext.Provider value={{ refreshInterval, setRefreshInterval }}>
      {children}
    </RefreshIntervalContext.Provider>
  );
}

export function useRefreshInterval() {
  const context = useContext(RefreshIntervalContext);
  if (context === undefined) {
    throw new Error('useRefreshInterval must be used within a RefreshIntervalProvider');
  }
  return context;
}
