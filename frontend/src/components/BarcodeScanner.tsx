import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, _err, controls) => {
        controlsRef.current = controls;
        if (result) {
          const text = result.getText();
          controls.stop();
          onScan(text);
        }
      })
      .catch(() => {
        setError('Camera access denied. Please allow camera access in your browser settings and try again.');
      });

    return () => {
      controlsRef.current?.stop();
    };
  }, [onScan]);

  const handleClose = () => {
    controlsRef.current?.stop();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/70">
        <h2 className="text-white font-semibold">Scan ISBN Barcode</h2>
        <button
          onClick={handleClose}
          className="text-white bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none hover:bg-white/30"
        >
          ✕
        </button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <p className="text-4xl mb-4">📷</p>
            <p className="text-white mb-2 font-medium">Camera not available</p>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <button
              onClick={handleClose}
              className="bg-white text-black px-6 py-2 rounded-lg font-medium"
            >
              Go back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="border-2 border-yellow-400 w-72 h-36 rounded-lg shadow-lg" />
            <p className="text-white text-sm mt-4 bg-black/60 rounded-lg px-3 py-1.5">
              Point at the barcode on the back of the book
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
