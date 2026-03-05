import React, { useState, useRef, useCallback } from 'react';
import { ColorTheme } from './types';
import LightCanvas from './components/LightCanvas';
import Controls from './components/Controls';

const App: React.FC = () => {
  const [theme, setTheme] = useState<ColorTheme>('rainbow');
  const [autoMode, setAutoMode] = useState(false);
  const [lightCount, setLightCount] = useState(0);
  const clearFnRef = useRef<(() => void) | null>(null);

  const handleClear = useCallback(() => {
    if (clearFnRef.current) clearFnRef.current();
  }, []);

  return (
    <>
      <LightCanvas
        theme={theme}
        autoMode={autoMode}
        onLightCountChange={setLightCount}
        clearRef={clearFnRef}
      />
      <Controls
        theme={theme}
        onThemeChange={setTheme}
        autoMode={autoMode}
        onAutoToggle={() => setAutoMode((prev) => !prev)}
        onClear={handleClear}
        lightCount={lightCount}
      />
    </>
  );
};

export default App;
