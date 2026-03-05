import React from 'react';
import { ColorTheme } from '../types';

interface ControlsProps {
  theme: ColorTheme;
  onThemeChange: (theme: ColorTheme) => void;
  autoMode: boolean;
  onAutoToggle: () => void;
  onClear: () => void;
  lightCount: number;
}

const themes: { value: ColorTheme; label: string; preview: string }[] = [
  { value: 'rainbow', label: 'Rainbow', preview: 'bg-gradient-to-r from-red-400 via-green-400 to-blue-400' },
  { value: 'warm', label: 'Warm', preview: 'bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400' },
  { value: 'cool', label: 'Cool', preview: 'bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-400' },
  { value: 'neon', label: 'Neon', preview: 'bg-gradient-to-r from-pink-500 via-green-400 to-cyan-400' },
  { value: 'pastel', label: 'Pastel', preview: 'bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300' },
];

const Controls: React.FC<ControlsProps> = ({ theme, onThemeChange, autoMode, onAutoToggle, onClear, lightCount }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg border border-white/10">
        <h1 className="text-white/80 font-light text-sm tracking-widest uppercase hidden sm:block mr-2">
          Random Light
        </h1>

        <div className="flex gap-1.5">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => onThemeChange(t.value)}
              title={t.label}
              className={`w-7 h-7 rounded-full ${t.preview} transition-all ${
                theme === t.value
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-black/40 scale-110'
                  : 'opacity-60 hover:opacity-100 hover:scale-105'
              }`}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-white/20" />

        <button
          onClick={onAutoToggle}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            autoMode
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          Auto
        </button>

        <button
          onClick={onClear}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/50 hover:bg-red-500/30 hover:text-red-300 transition-all"
        >
          Clear
        </button>
      </div>

      <p className="text-white/30 text-xs">
        {lightCount === 0 ? 'Tap anywhere to create lights' : `${lightCount} lights`}
      </p>
    </div>
  );
};

export default Controls;
