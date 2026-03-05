export interface Light {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  saturation: number;
  lightness: number;
  opacity: number;
  pulseSpeed: number;
  pulsePhase: number;
  life: number;
  maxLife: number;
}

export type ColorTheme = 'rainbow' | 'warm' | 'cool' | 'neon' | 'pastel';
