import { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  symbol: string;
  color: string;
  size: number;
}

export function CryptoBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Crypto symbols
    const cryptoSymbols = ['₿', 'Ξ', '◊', '$', '⬡', '⟠'];
    
    // Colors with transparency
    const colors = [
      'rgba(0, 255, 136, 0.15)',   // Crypto green
      'rgba(255, 215, 0, 0.15)',   // Gold
      'rgba(255, 107, 53, 0.15)',  // Orange
    ];

    // Initialize particles
    const particleCount = isMobile ? 20 : 35;
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      symbol: cryptoSymbols[Math.floor(Math.random() * cryptoSymbols.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      size: isMobile ? 12 : 16,
    }));

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // Keep within bounds
        particle.x = Math.max(0, Math.min(canvas.width, particle.x));
        particle.y = Math.max(0, Math.min(canvas.height, particle.y));

        // Draw connections to nearby particles
        particlesRef.current.forEach((otherParticle, j) => {
          if (i === j) return;

          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Draw line if particles are close enough
          const maxDistance = isMobile ? 120 : 150;
          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.08;
            ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`; // Purple color with dynamic opacity
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
          }
        });

        // Draw particle symbol
        ctx.font = `${particle.size}px Arial`;
        ctx.fillStyle = particle.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(particle.symbol, particle.x, particle.y);

        // Add subtle glow effect
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 8;
        ctx.fillText(particle.symbol, particle.x, particle.y);
        ctx.shadowBlur = 0;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isMobile]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="crypto-background"
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: -1,
        opacity: 0.8,
      }}
    />
  );
}
