import React, { useState, useEffect, useRef } from 'react';

interface SynchronizedTimerProps {
  startTime: number;
  duration: number; // en secondes
  onComplete: () => void;
  playBeep?: () => void; // Added playBeep prop
}

export const SynchronizedTimer: React.FC<SynchronizedTimerProps> = ({ startTime, duration, onComplete, playBeep }) => {
  console.log('SynchronizedTimer: Rendu avec startTime=', startTime, 'duration=', duration);
  const [remaining, setRemaining] = useState(duration);
  const lastBeepSecond = useRef<number | null>(null); // To prevent multiple beeps for the same second

  useEffect(() => {
    console.log('SynchronizedTimer: useEffect exécuté avec startTime=', startTime, 'duration=', duration);
    lastBeepSecond.current = null; // Reset on new timer start

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000; // en secondes
      const newRemaining = Math.max(0, duration - elapsed);
      const roundedRemaining = Math.ceil(newRemaining);

      // Play beep sound for last few seconds
      if (playBeep && roundedRemaining <= 3 && roundedRemaining >= 0 && roundedRemaining !== lastBeepSecond.current) {
        playBeep();
        lastBeepSecond.current = roundedRemaining;
      }

      setRemaining(newRemaining);

      if (newRemaining <= 0.1) { // Utiliser une petite marge pour éviter les problèmes de flottants
        clearInterval(interval);
        onComplete();
      }
    }, 100);

    return () => {
      console.log('SynchronizedTimer: Nettoyage de l\'intervalle');
      clearInterval(interval);
    };
  }, [startTime, duration, playBeep]); // Added playBeep to dependencies

  return (
    <div className="text-6xl font-bold text-center">
      {Math.ceil(remaining)}
    </div>
  );
};
