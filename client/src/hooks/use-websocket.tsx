import { useEffect, useState, useRef, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  data?: any;
}

// Singleton WebSocket connection manager for connection pooling
class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private listeners = new Set<(message: WebSocketMessage) => void>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;
  
  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }
  
  async connect(): Promise<void> {
    // If already connecting, wait for that connection
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    // If already connected, return immediately
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    
    this.connectionPromise = this.doConnect();
    return this.connectionPromise;
  }
  
  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log("WebSocket connected");
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.connectionPromise = null;
          
          // Start ping interval to keep connection alive
          this.startPingInterval();
          
          // Subscribe to supported real-time updates
          this.send({ type: 'subscribe_scanner' });
          this.send({ type: 'subscribe_prices' });
          
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            // Notify all listeners
            this.listeners.forEach(listener => listener(message));
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };
        
        this.ws.onclose = () => {
          console.log("WebSocket disconnected");
          this.stopPingInterval();
          this.connectionPromise = null;
          this.scheduleReconnect();
        };
        
        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.connectionPromise = null;
          reject(new Error("WebSocket connection error"));
        };
      } catch (err) {
        console.error("Failed to connect WebSocket:", err);
        this.connectionPromise = null;
        reject(err);
        this.scheduleReconnect();
      }
    });
  }
  
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }
    
    // Exponential backoff with jitter
    const jitter = Math.random() * 1000;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts) + jitter, this.maxReconnectDelay);
    
    console.log(`Scheduling reconnect in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  private startPingInterval() {
    this.stopPingInterval();
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }
  
  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected, queuing message");
      // Queue message for when connection is restored
      this.connect().then(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(message));
        }
      });
    }
  }
  
  subscribe(listener: (message: WebSocketMessage) => void) {
    this.listeners.add(listener);
    // Connect if not already connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
  }
  
  unsubscribe(listener: (message: WebSocketMessage) => void) {
    this.listeners.delete(listener);
  }
  
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manager = useRef<WebSocketManager>(WebSocketManager.getInstance());

  const messageHandler = useCallback((message: WebSocketMessage) => {
    setLastMessage(message);
  }, []);

  const connect = useCallback(async () => {
    try {
      await manager.current.connect();
      setIsConnected(manager.current.isConnected);
      setError(null);
    } catch (err) {
      console.error("Failed to connect WebSocket:", err);
      setError("Failed to establish WebSocket connection");
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    manager.current.send(message);
  }, []);

  const disconnect = useCallback(() => {
    manager.current.disconnect();
    setIsConnected(false);
  }, []);

  const emitCustomEvent = useCallback((message: WebSocketMessage) => {
    // Emit event locally for testing purposes without sending to server
    setLastMessage(message);
  }, []);

  useEffect(() => {
    // Subscribe to messages
    manager.current.subscribe(messageHandler);
    
    // Connect and update connection status
    connect();
    
    // Check connection status periodically
    const statusInterval = setInterval(() => {
      setIsConnected(manager.current.isConnected);
    }, 1000);

    return () => {
      manager.current.unsubscribe(messageHandler);
      clearInterval(statusInterval);
    };
  }, [messageHandler, connect]);

  return {
    isConnected,
    lastMessage,
    error,
    sendMessage,
    reconnect: connect,
    emitCustomEvent,
  };
}
