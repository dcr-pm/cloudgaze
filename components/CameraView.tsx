import React, { useRef, useEffect, useCallback } from 'react';
import { CameraIcon } from './IconComponents';

interface CameraViewProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const enableCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } // Prefer back camera
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing environment camera:", err);
        // Fallback to any available camera if environment facing fails
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (fallbackErr) {
            console.error("Error accessing any camera:", fallbackErr);
            alert("Could not access camera. Please check your browser permissions and try again.");
            onCancel();
        }
      }
    };

    enableCamera();

    return () => {
      // Cleanup: stop all tracks on the stream when the component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(imageDataUrl);
      }
    }
  }, [onCapture]);

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center p-4">
      <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg shadow-lg border-4 border-white/50"></video>
      <canvas ref={canvasRef} className="hidden"></canvas>
      <div className="absolute bottom-8 flex space-x-4">
        <button
          onClick={handleCapture}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold p-4 rounded-full shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Capture photo"
        >
          <CameraIcon className="h-8 w-8" />
        </button>
         <button
          onClick={onCancel}
          className="bg-slate-500 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-full shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CameraView;