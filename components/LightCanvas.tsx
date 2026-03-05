import React, { useRef, useEffect, useCallback } from 'react';
import { Light, ColorTheme } from '../types';

function getHueForTheme(theme: ColorTheme): number {
  switch (theme) {
    case 'rainbow':
      return Math.random() * 360;
    case 'warm':
      return Math.random() * 60 + 10; // reds, oranges, yellows
    case 'cool':
      return Math.random() * 120 + 180; // blues, cyans, purples
    case 'neon':
      return [0, 120, 180, 280, 320][Math.floor(Math.random() * 5)];
    case 'pastel':
      return Math.random() * 360;
  }
}

function getSatLightForTheme(theme: ColorTheme): [number, number] {
  switch (theme) {
    case 'pastel':
      return [60 + Math.random() * 20, 70 + Math.random() * 15];
    case 'neon':
      return [100, 55 + Math.random() * 10];
    default:
      return [80 + Math.random() * 20, 55 + Math.random() * 15];
  }
}

function createLight(x: number, y: number, theme: ColorTheme, id: number): Light {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 0.7;
  const [saturation, lightness] = getSatLightForTheme(theme);
  const maxLife = 300 + Math.random() * 400;

  return {
    id,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 15 + Math.random() * 35,
    hue: getHueForTheme(theme),
    saturation,
    lightness,
    opacity: 0,
    pulseSpeed: 0.02 + Math.random() * 0.03,
    pulsePhase: Math.random() * Math.PI * 2,
    life: 0,
    maxLife,
  };
}

interface LightCanvasProps {
  theme: ColorTheme;
  autoMode: boolean;
  onLightCountChange: (count: number) => void;
  clearRef: React.MutableRefObject<(() => void) | null>;
}

const LightCanvas: React.FC<LightCanvasProps> = ({ theme, autoMode, onLightCountChange, clearRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightsRef = useRef<Light[]>([]);
  const nextIdRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const autoTimerRef = useRef<number>(0);
  const lastCountRef = useRef(0);

  // Register clear function
  useEffect(() => {
    clearRef.current = () => {
      lightsRef.current = [];
      onLightCountChange(0);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(10, 10, 15, 1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
  }, [clearRef, onLightCountChange]);

  const spawnLight = useCallback((x: number, y: number) => {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const offsetX = x + (Math.random() - 0.5) * 40;
      const offsetY = y + (Math.random() - 0.5) * 40;
      lightsRef.current.push(createLight(offsetX, offsetY, theme, nextIdRef.current++));
    }
  }, [theme]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    spawnLight(e.clientX - rect.left, e.clientY - rect.top);
  }, [spawnLight]);

  const handleTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      spawnLight(touch.clientX - rect.left, touch.clientY - rect.top);
    }
  }, [spawnLight]);

  // Auto-spawn mode
  useEffect(() => {
    if (autoMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      autoTimerRef.current = window.setInterval(() => {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        spawnLight(x, y);
      }, 600);
    }
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [autoMode, spawnLight]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      // Fade trail effect
      ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const lights = lightsRef.current;

      for (let i = lights.length - 1; i >= 0; i--) {
        const light = lights[i];
        light.life++;

        // Fade in / fade out
        const fadeIn = Math.min(light.life / 30, 1);
        const fadeOut = Math.max(1 - (light.life - light.maxLife + 60) / 60, 0);
        light.opacity = fadeIn * (light.life > light.maxLife - 60 ? fadeOut : 1);

        // Remove dead lights
        if (light.life > light.maxLife) {
          lights.splice(i, 1);
          continue;
        }

        // Pulse
        const pulse = Math.sin(light.pulsePhase + light.life * light.pulseSpeed);
        const currentRadius = light.radius * (0.8 + pulse * 0.2);

        // Drift
        light.x += light.vx;
        light.y += light.vy;

        // Gentle gravity toward center
        light.vx += (canvas.width / 2 - light.x) * 0.00005;
        light.vy += (canvas.height / 2 - light.y) * 0.00005;

        // Draw glow
        const gradient = ctx.createRadialGradient(
          light.x, light.y, 0,
          light.x, light.y, currentRadius * 2.5
        );
        const color = `hsla(${light.hue}, ${light.saturation}%, ${light.lightness}%,`;
        gradient.addColorStop(0, `${color} ${light.opacity * 0.9})`);
        gradient.addColorStop(0.3, `${color} ${light.opacity * 0.4})`);
        gradient.addColorStop(0.7, `${color} ${light.opacity * 0.1})`);
        gradient.addColorStop(1, `${color} 0)`);

        ctx.beginPath();
        ctx.arc(light.x, light.y, currentRadius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Bright core
        const coreGrad = ctx.createRadialGradient(
          light.x, light.y, 0,
          light.x, light.y, currentRadius * 0.5
        );
        coreGrad.addColorStop(0, `hsla(${light.hue}, 100%, 90%, ${light.opacity * 0.8})`);
        coreGrad.addColorStop(1, `hsla(${light.hue}, ${light.saturation}%, ${light.lightness}%, 0)`);

        ctx.beginPath();
        ctx.arc(light.x, light.y, currentRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
      }

      // Report light count (throttled)
      if (lights.length !== lastCountRef.current) {
        lastCountRef.current = lights.length;
        onLightCountChange(lights.length);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full cursor-crosshair"
      onClick={handleClick}
      onTouchStart={handleTouch}
    />
  );
};

export default LightCanvas;
