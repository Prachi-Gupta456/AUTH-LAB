'use client';

import { useEffect, useRef } from 'react';

export default function QrScanner({ onResult, onError }) {
  // Refs so the camera effect never restarts when the parent re-renders
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  onResultRef.current = onResult;
  onErrorRef.current = onError;

  useEffect(() => {
    let scanner;
    let cancelled = false;
    let lastHit = 0;

    (async () => {
      // Loaded here (not at the top) because the library touches `window`/camera APIs
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;

      scanner = new Html5Qrcode('qr-reader');
      try {
        await scanner.start(
          { facingMode: 'environment' }, // back camera on phones
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            // The camera sees the same QR 10 times a second: ignore repeats for 2s
            if (Date.now() - lastHit < 2000) return;
            lastHit = Date.now();
            onResultRef.current(text);
          },
          () => {} // "no QR in this frame" fires constantly, ignore it
        );
      } catch {
        onErrorRef.current?.('Camera not available. Allow camera access, or paste the code below.');
      }
    })();

    return () => {
      cancelled = true;
      // Always release the camera, otherwise the webcam light stays on
      if (scanner) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, []);

  return <div id="qr-reader" className="overflow-hidden rounded-xl bg-black" />;
}