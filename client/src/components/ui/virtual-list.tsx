import { useRef, useState, useEffect, useCallback } from "react";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  containerHeight?: number;
  overscan?: number;
  className?: string;
  emptyMessage?: string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight = 600,
  overscan = 3,
  className = "",
  emptyMessage = "No items to display",
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  // Calculate visible items
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
  
  // Add overscan for smoother scrolling
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length, visibleEnd + overscan);
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  // Reset scroll when items change significantly
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);
  
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for dynamic height virtual scrolling
export function useDynamicVirtualList<T>({
  items,
  estimatedItemHeight = 80,
  containerHeight = 600,
  overscan = 3,
}: {
  items: T[];
  estimatedItemHeight?: number;
  containerHeight?: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [measurements, setMeasurements] = useState<Map<number, number>>(new Map());
  const measuredHeights = useRef<Map<number, number>>(new Map());
  
  const measureItem = useCallback((index: number, height: number) => {
    if (measuredHeights.current.get(index) !== height) {
      measuredHeights.current.set(index, height);
      setMeasurements(new Map(measuredHeights.current));
    }
  }, []);
  
  const getItemOffset = useCallback((index: number): number => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += measuredHeights.current.get(i) || estimatedItemHeight;
    }
    return offset;
  }, [estimatedItemHeight]);
  
  const getItemHeight = useCallback((index: number): number => {
    return measuredHeights.current.get(index) || estimatedItemHeight;
  }, [estimatedItemHeight]);
  
  // Calculate visible range
  let accumulatedHeight = 0;
  let startIndex = 0;
  let endIndex = items.length;
  
  for (let i = 0; i < items.length; i++) {
    const itemHeight = getItemHeight(i);
    
    if (accumulatedHeight < scrollTop - overscan * estimatedItemHeight) {
      startIndex = i;
    }
    
    if (accumulatedHeight > scrollTop + containerHeight + overscan * estimatedItemHeight) {
      endIndex = i;
      break;
    }
    
    accumulatedHeight += itemHeight;
  }
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.reduce((acc, _, i) => acc + getItemHeight(i), 0);
  
  return {
    scrollTop,
    setScrollTop,
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    getItemOffset,
    getItemHeight,
    measureItem,
  };
}