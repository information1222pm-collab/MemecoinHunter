import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for offline caching and performance
if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registered:', registration.scope);
        
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 3600000);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
