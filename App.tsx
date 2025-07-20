import React, { useState, useCallback } from 'react';
import { AppState, AnalysisResult } from './types';
import { analyzeCloudImage } from './services/geminiService';
import { CameraIcon, SparklesIcon, LoadingSpinner } from './components/IconComponents';
import CameraView from './components/CameraView';
import ResultsDisplay from './components/ResultsDisplay';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    setError(null);
    setAppState(AppState.CAMERA_ACTIVE);
  };

  const handleCapture = useCallback(async (imageDataUrl: string) => {
    setAppState(AppState.ANALYZING);
    setCapturedImage(imageDataUrl);
    try {
      const result = await analyzeCloudImage(imageDataUrl);
      setAnalysisResult(result);
      setAppState(AppState.RESULTS_SHOWN);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during analysis.");
      setAppState(AppState.ERROR);
    }
  }, []);

  const handleReset = useCallback(() => {
    setAppState(AppState.IDLE);
    setCapturedImage(null);
    setAnalysisResult(null);
    setError(null);
  }, []);

  const renderContent = () => {
    switch (appState) {
      case AppState.IDLE:
        return (
          <div className="text-center p-4">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800">Cloud Gazer AI</h1>
            <p className="mt-4 text-lg text-slate-600 max-w-xl mx-auto">
              Take a picture of the sky and let our creative AI find and describe the hidden shapes in the clouds.
            </p>
            <button
              onClick={handleStart}
              className="mt-8 inline-flex items-center gap-3 bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-full shadow-lg text-xl transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              <CameraIcon className="w-7 h-7" />
              Find Shapes in Clouds
            </button>
          </div>
        );
      case AppState.CAMERA_ACTIVE:
        return <CameraView onCapture={handleCapture} onCancel={handleReset} />;
      case AppState.ANALYZING:
        return (
          <div className="text-center flex flex-col items-center justify-center p-4">
            <LoadingSpinner className="w-16 h-16 text-blue-500"/>
            <h2 className="mt-6 text-2xl font-semibold text-slate-700 animate-pulse flex items-center gap-3">
                <SparklesIcon className="w-7 h-7" />
                Analyzing your cloud...
            </h2>
            <p className="mt-2 text-slate-500">Our AI is gazing at the sky.</p>
            {capturedImage && <img src={capturedImage} alt="Cloud being analyzed" className="mt-8 rounded-lg shadow-lg max-w-sm w-full opacity-50"/>}
          </div>
        );
      case AppState.RESULTS_SHOWN:
        if (capturedImage && analysisResult) {
          return <ResultsDisplay image={capturedImage} analysis={analysisResult} onReset={handleReset} />;
        }
        // Fallback in case of invalid state
        handleReset();
        return null;
      case AppState.ERROR:
        return (
            <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative max-w-lg mx-auto" role="alert">
                <strong className="font-bold">Oh no! Something went wrong.</strong>
                <span className="block sm:inline ml-2">{error}</span>
                <button
                    onClick={handleReset}
                    className="mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full"
                >
                    Try Again
                </button>
            </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen bg-sky-100 bg-gradient-to-b from-sky-50 to-sky-200 flex items-center justify-center p-4 font-sans antialiased">
      <div className="w-full h-full flex items-center justify-center">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;