import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Check, Clock, Award } from 'lucide-react';

// Définition de l'interface pour les données de chaque jour
interface DayData {
  day: number;
  gm: number; // Gainage Main (secondes)
  gc: number; // Gainage Coude (secondes)
}

// Données du défi
const challengeData: DayData[] = [
  { day: 1, gm: 15, gc: 20 },
  { day: 2, gm: 20, gc: 20 },
  { day: 3, gm: 20, gc: 25 },
  { day: 4, gm: 25, gc: 25 },
  { day: 5, gm: 20, gc: 30 },
  { day: 6, gm: 30, gc: 30 },
  { day: 7, gm: 30, gc: 35 },
  { day: 8, gm: 35, gc: 35 },
  { day: 9, gm: 35, gc: 40 },
  { day: 10, gm: 40, gc: 45 },
  { day: 11, gm: 45, gc: 45 },
  { day: 12, gm: 45, gc: 50 },
  { day: 13, gm: 50, gc: 50 },
  { day: 14, gm: 50, gc: 55 },
  { day: 15, gm: 50, gc: 55 },
  { day: 16, gm: 55, gc: 60 },
  { day: 17, gm: 60, gc: 60 },
  { day: 18, gm: 60, gc: 105 },
  { day: 19, gm: 60, gc: 110 },
  { day: 20, gm: 60, gc: 115 },
  { day: 21, gm: 60, gc: 120 },
  { day: 22, gm: 60, gc: 125 },
  { day: 23, gm: 60, gc: 130 },
  { day: 24, gm: 110, gc: 130 },
  { day: 25, gm: 110, gc: 135 },
  { day: 26, gm: 120, gc: 150 },
  { day: 27, gm: 130, gc: 120 },
  { day: 28, gm: 140, gc: 150 },
  { day: 29, gm: 150, gc: 180 },
  { day: 30, gm: 120, gc: 210 }
];

// Hook custom pour gérer le clic long (long press)
const useLongPress = (
  onLongPress: (event: React.MouseEvent | React.TouchEvent) => void,
  onClick: () => void,
  { delay = 500 }: { delay?: number } = {}
) => {
  const timeout = useRef<NodeJS.Timeout>();
  const longPressTriggered = useRef(false);

  const start = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      // Empêcher le menu contextuel sur mobile qui peut apparaître au relâchement
      if ('touches' in event) {
        const preventContextMenu = (e: Event) => e.preventDefault();
        event.currentTarget.addEventListener('contextmenu', preventContextMenu, { once: true });
      }
      
      longPressTriggered.current = false;
      timeout.current = setTimeout(() => {
        onLongPress(event);
        longPressTriggered.current = true;
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      timeout.current && clearTimeout(timeout.current);
      if (e.type === 'touchend' && longPressTriggered.current) {
        e.preventDefault();
      }
      if (!longPressTriggered.current) {
        onClick();
      }
    },
    [onClick]
  );
  
  const cancel = useCallback(() => {
      timeout.current && clearTimeout(timeout.current);
  }, []);


  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: cancel,
    onTouchEnd: (e: React.TouchEvent) => clear(e),
  };
};


// Interface pour les props du bouton de jour
interface DayButtonProps {
    day: DayData;
    isSelected: boolean;
    isCompleted: boolean;
    onSelect: () => void;
    onToggleComplete: () => void;
}

// Composant pour chaque bouton du calendrier
const DayButton: React.FC<DayButtonProps> = ({ day, isSelected, isCompleted, onSelect, onToggleComplete }) => {
    
    const longPressHandlers = useLongPress(onToggleComplete, onSelect, { delay: 500 });

    return (
        <button
            {...longPressHandlers}
            onContextMenu={(e) => e.preventDefault()} // Empêche le menu contextuel sur ordinateur
            className={`
              rounded-lg border-2 transition-all duration-200 hover:scale-105 p-3 select-none
              ${isSelected 
                ? 'bg-red-600 text-white border-red-600 shadow-lg'
                : isCompleted 
                ? 'bg-green-500 text-white border-green-500 shadow-md'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }
            `}
        >
            <div className="flex flex-col items-center justify-center relative pointer-events-none">
              {isCompleted && (
                <Check className="absolute -top-1 -right-1 w-4 h-4 text-white bg-green-600 rounded-full p-0.5" />
              )}
              <span className="text-sm font-bold mb-1">JOUR {day.day}</span>
              <div className="text-xs space-y-0.5">
                <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'}`}>
                  {day.gm}" GM
                </div>
                <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'}`}>
                  {day.gc}" GC
                </div>
              </div>
            </div>
        </button>
    );
};


type TimerState = 'idle' | 'gm' | 'rest' | 'gc' | 'completed';
type CountdownState = 'countdown-gm' | 'countdown-gc' | null;

function App() {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [countdownState, setCountdownState] = useState<CountdownState>(null);
  const [countdownTime, setCountdownTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const timerRef = useRef<HTMLDivElement>(null);

  // Charger les jours complétés depuis le localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gainage-completed-days');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCompletedDays(new Set(parsed));
        }
      } catch (e) {
        console.error("Failed to parse completed days from localStorage", e);
        setCompletedDays(new Set());
      }
    }
  }, []);

  // Sauvegarder les jours complétés
  useEffect(() => {
    localStorage.setItem('gainage-completed-days', JSON.stringify([...completedDays]));
  }, [completedDays]);

  // Sélectionner automatiquement le prochain jour non complété
  useEffect(() => {
    // Ne rien faire si un jour est déjà sélectionné manuellement ou si le timer est actif
    if (selectedDay || timerState !== 'idle') {
      return;
    }

    const findNextDay = () => {
      // Trouver le premier jour qui n'est pas dans la liste des jours complétés
      const nextDay = challengeData.find(day => !completedDays.has(day.day));
      return nextDay || null;
    };

    const nextDayToSelect = findNextDay();
    if (nextDayToSelect) {
      setSelectedDay(nextDayToSelect);
    }
  }, [completedDays, selectedDay, timerState]);

  // Initialiser le contexte audio
  const initAudioContext = () => {
    if (audioContext) return audioContext;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);
      return ctx;
    } catch (e) {
      console.error("AudioContext is not supported.", e);
      return null;
    }
  };

  // Créer un bip sonore
  const playBeep = () => {
    const ctx = initAudioContext();
    if (!ctx) return;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (error) {
      console.error('Erreur lors de la lecture du bip:', error);
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
  };

  // Gérer le décompte
  useEffect(() => {
    if (!countdownState || countdownTime <= 0) return;

    const interval = setInterval(() => {
      setCountdownTime(prev => prev - 1);
    }, 1000);

    if (countdownTime > 0 && countdownTime <= 3) { 
        playBeep();
    }

    return () => clearInterval(interval);
  }, [countdownState, countdownTime]);

  useEffect(() => {
      if (countdownTime === 0 && countdownState) {
        if (countdownState === 'countdown-gm') {
            setCountdownState(null);
            setTimerState('gm');
            setTimeLeft(selectedDay?.gm || 0);
            setIsRunning(true);
        } else if (countdownState === 'countdown-gc') {
            setCountdownState(null);
            setTimerState('gc');
            setTimeLeft(selectedDay?.gc || 0);
            setIsRunning(true);
        }
      }
  }, [countdownTime, countdownState, selectedDay]);


  // Gérer le timer
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
        if (timeLeft === 0 && isRunning) {
            handleTimerComplete();
        }
        return;
    };

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const handleTimerComplete = () => {
    setIsRunning(false);
    playBeep();
    
    switch (timerState) {
      case 'gm':
        setTimerState('rest');
        setTimeLeft(30);
        setIsRunning(true);
        break;
      case 'rest':
        setTimerState('idle');
        setCountdownState('countdown-gc');
        setCountdownTime(3);
        break;
      case 'gc':
        setTimerState('completed');
        if (selectedDay) {
          setCompletedDays(prev => new Set([...prev, selectedDay.day]));
        }
        break;
    }
  };

  const startWorkout = () => {
    if (!selectedDay) return;
    initAudioContext();
    setCountdownState('countdown-gm');
    setCountdownTime(3);
    setTimeout(() => {
        timerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimerState('idle');
    setCountdownState(null);
    setCountdownTime(0);
    setTimeLeft(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerTitle = (): string => {
    if (countdownState === 'countdown-gm') return 'PRÉPAREZ-VOUS - GAINAGE MAIN';
    if (countdownState === 'countdown-gc') return 'PRÉPAREZ-VOUS - GAINAGE COUDE';
    
    switch (timerState) {
      case 'gm': return 'GAINAGE MAIN';
      case 'rest': return 'RÉCUPÉRATION';
      case 'gc': return 'GAINAGE COUDE';
      case 'completed': return 'TERMINÉ !';
      default: return '';
    }
  };

  const getTimerColor = (): string => {
    if (countdownState) return 'text-orange-600';
    
    switch (timerState) {
      case 'gm': return 'text-blue-600';
      case 'rest': return 'text-yellow-600';
      case 'gc': return 'text-red-600';
      case 'completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getProgressPercentage = (): number => {
    if (!selectedDay || (timerState === 'idle' && !countdownState)) return 0;
    
    const totalTime = selectedDay.gm + 30 + selectedDay.gc;
    let elapsed = 0;
    
    switch (timerState) {
      case 'gm':
        elapsed = selectedDay.gm - timeLeft;
        break;
      case 'rest':
        elapsed = selectedDay.gm + (30 - timeLeft);
        break;
      case 'gc':
        elapsed = selectedDay.gm + 30 + (selectedDay.gc - timeLeft);
        break;
      case 'completed':
        elapsed = totalTime;
        break;
    }
    
    return (elapsed / totalTime) * 100;
  };

  const handleToggleComplete = (dayNumber: number) => {
      setCompletedDays(prev => {
          const newSet = new Set(prev);
          if (newSet.has(dayNumber)) {
              newSet.delete(dayNumber);
          } else {
              newSet.add(dayNumber);
          }
          return newSet;
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 p-4 font-sans" onDoubleClick={startWorkout}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-black text-red-600 mb-2">GAINAGE</h1>
          <p className="text-2xl font-bold text-gray-800">DÉFI 30 JOURS</p>
          <p className="text-gray-600 mt-2">Sélectionnez un jour pour commencer ou appuyez longuement pour (dé)valider.</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-4">
            <Award className="text-yellow-500 w-8 h-8" />
            <div>
              <p className="text-2xl font-bold text-gray-800">{completedDays.size}/30</p>
              <p className="text-gray-600">Jours complétés</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Calendrier du défi</h2>
            <div className="grid grid-cols-5 gap-3">
              {challengeData.map((day) => (
                <DayButton
                    key={day.day}
                    day={day}
                    isSelected={selectedDay?.day === day.day}
                    isCompleted={completedDays.has(day.day)}
                    onSelect={() => setSelectedDay(day)}
                    onToggleComplete={() => handleToggleComplete(day.day)}
                />
              ))}
            </div>
            
            <div className="mt-6 flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded border"></div>
                <span className="text-gray-600">À faire</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-600 rounded"></div>
                <span className="text-gray-600">Sélectionné</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-gray-600">Terminé</span>
              </div>
            </div>
           
           <div className="mt-4 text-center">
             <p className="text-xs text-gray-500">
               💡 <strong>Astuce :</strong> Appuyez longuement sur un jour pour le marquer comme terminé ou le débloquer.
             </p>
           </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6" ref={timerRef}>
            {!selectedDay ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Clock className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">Sélectionnez un jour</h3>
                <p className="text-gray-500">Choisissez un jour dans le calendrier pour voir les exercices</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-3xl font-bold text-gray-800 mb-2">JOUR {selectedDay.day}</h3>
                  <div className="flex justify-center gap-6 text-sm">
                    <div className="bg-blue-50 px-4 py-2 rounded-lg">
                      <p className="font-semibold text-blue-800">GAINAGE MAIN</p>
                      <p className="text-blue-600">{selectedDay.gm}"</p>
                    </div>
                    <div className="bg-red-50 px-4 py-2 rounded-lg">
                      <p className="font-semibold text-red-800">GAINAGE COUDE</p>
                      <p className="text-red-600">{selectedDay.gc}"</p>
                    </div>
                  </div>
                </div>

                {(timerState !== 'idle' || countdownState) && (
                  <div className="space-y-4">
                    <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-1000"
                        style={{ width: `${getProgressPercentage()}%` }}
                      />
                    </div>

                    <div className="text-center">
                      <h4 className={`text-2xl font-bold mb-2 ${getTimerColor()}`}>
                        {getTimerTitle()}
                      </h4>
                      
                      {countdownState ? (
                        <div className={`text-8xl font-mono font-bold ${getTimerColor()} animate-pulse`}>
                          {countdownTime}
                        </div>
                      ) : (
                        <div className={`text-6xl font-mono font-bold ${getTimerColor()}`}>
                          {formatTime(timeLeft)}
                        </div>
                      )}
                      
                      {timerState === 'rest' && (
                        <p className="text-gray-600 mt-2">Récupération entre les exercices</p>
                      )}
                      
                      {timerState === 'completed' && (
                        <div className="mt-4 p-4 bg-green-50 rounded-lg">
                          <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                          <p className="text-green-800 font-semibold">Jour {selectedDay.day} terminé !</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-center">
                  {timerState === 'idle' && !countdownState && (
                    <button
                      onClick={startWorkout}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
                    >
                      <Play className="w-5 h-5" />
                      Commencer
                    </button>
                  )}
                  
                  {(timerState !== 'idle' || countdownState) && timerState !== 'completed' && (
                    <button
                      onClick={resetTimer}
                      className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
                    >
                      Arrêter
                    </button>
                  )}

                  {timerState === 'completed' && (
                    <button
                      onClick={() => {
                        resetTimer();
                        setSelectedDay(null);
                      }}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
                    >
                      Retour au calendrier
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      initAudioContext();
                      playBeep();
                    }}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                    title="Tester le son"
                  >
                    🔊 Test
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> 30 secondes de récupération entre les exercices. 
                    Cliquez sur "🔊 Test" pour vérifier que le son fonctionne.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
