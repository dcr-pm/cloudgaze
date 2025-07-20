import React from 'react';
import { AnalysisResult } from '../types';
import { SparklesIcon, ArrowPathIcon } from './IconComponents';

interface ResultsDisplayProps {
  image: string;
  analysis: AnalysisResult;
  onReset: () => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ image, analysis, onReset }) => {
  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col items-center">
            <h2 className="text-2xl font-bold text-slate-700 mb-4 text-center">Your Cloud Photo</h2>
            <img src={image} alt="Captured cloud" className="rounded-xl shadow-lg w-full object-contain border-4 border-white/50" />
        </div>
        <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-slate-700 mb-4 text-center flex items-center justify-center gap-2">
                <SparklesIcon className="w-7 h-7 text-blue-500"/>
                What I See...
            </h2>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-md p-4 space-y-4 overflow-y-auto max-h-[65vh]">
              {analysis.length > 0 ? (
                analysis.map((item, index) => (
                  <div key={index} className="bg-sky-50 p-4 rounded-lg border border-sky-200 transition-all duration-300 hover:shadow-md hover:border-blue-300">
                    <h3 className="text-xl font-semibold text-sky-800">{item.shape}</h3>
                    <p className="text-slate-600 mt-1">{item.description}</p>
                  </div>
                ))
              ) : (
                <div className="text-center p-8 h-full flex flex-col justify-center items-center">
                  <p className="text-slate-600 text-lg">The AI couldn't find any specific shapes in this image. The sky is a blank canvas—try another shot!</p>
                </div>
              )}
            </div>
        </div>
      </div>
      <div className="text-center mt-6">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <ArrowPathIcon className="w-5 h-5"/>
          Try Another Photo
        </button>
      </div>
    </div>
  );
};

export default ResultsDisplay;