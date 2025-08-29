import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Check, Clock, Award, Settings, ChevronDown } from 'lucide-react';

// --- Data Interfaces ---
interface DayData {
  day: number;
  gm: number; // Gainage Main (secondes)
  gc: number; // Gainage Coude (secondes)
}

interface Challenge {
  id: string;
  name: string;
  data: DayData[];
}

// --- Utility to get challenges ---
const challengeModules = import.meta.glob('./challenges/*.json');

async function getChallenges(): Promise<Challenge[]> {
  const challenges: Challenge[] = [];
  for (const path in challengeModules) {
    const id = path.split('/').pop()?.replace('.json', '');
    if (id) {
      const module = await challengeModules[path]() as any;
      challenges.push({ id, name: module.name, data: module.data });
    }
  }
  return challenges;
}

import { useLongPress } from './useLongPress';

// --- Components ---

interface DayButtonProps {
    day: DayData;
    isSelected: boolean;
    isCompleted: boolean;
    onSelect: () => void;
    onToggleComplete: () => void;
    disabled: boolean;
    isSelectable: boolean;
}

const DayButton: React.FC<DayButtonProps> = ({ day, isSelected, isCompleted, onSelect, onToggleComplete, disabled, isSelectable }) => {
    const longPressHandlers = useLongPress(onToggleComplete, isSelectable ? onSelect : () => {}, { delay: 500 });
    const handlers = disabled ? {} : longPressHandlers;

    return (
        <button
            {...handlers}
            disabled={disabled}
            onContextMenu={(e) => e.preventDefault()}
            className={`
              rounded-lg border-2 transition-all duration-200 hover:scale-105 p-3 select-none
              ${isSelected 
                ? 'bg-red-600 text-white border-red-600 shadow-lg'
                : isCompleted 
                ? 'bg-green-500 text-white border-green-500 shadow-md'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }
              ${(disabled || (!isSelectable && !isCompleted)) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
        >
            <div className="flex flex-col items-center justify-center relative pointer-events-none">
              {isCompleted && <Check className="absolute -top-1 -right-1 w-4 h-4 text-white bg-green-600 rounded-full p-0.5" />}
              <span className="text-sm font-bold mb-1">JOUR {day.day}</span>
              <div className="text-xs space-y-0.5">
                <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'}`}>{day.gm}" GM</div>
                <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'}`}>{day.gc}" GC</div>
              </div>
            </div>
        </button>
    );
};

type TimerState = 'idle' | 'gm' | 'rest' | 'gc' | 'completed';
type CountdownState = 'countdown-gm' | 'countdown-gc' | null;

function App() {
  // --- State ---
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('default');
  const [challengeData, setChallengeData] = useState<DayData[]>([]);

  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [restTime, setRestTime] = useState<number>(30);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [countdownState, setCountdownState] = useState<CountdownState>(null);
  const [countdownTime, setCountdownTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const timerRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Load all challenges on startup
  useEffect(() => {
    getChallenges().then(loadedChallenges => {
      setChallenges(loadedChallenges);
      const lastChallengeId = localStorage.getItem('gainage-last-challenge') || 'default';
      setSelectedChallengeId(lastChallengeId);
    });
  }, []);

  // Load data and progress when challenge changes
  useEffect(() => {
    const challenge = challenges.find(c => c.id === selectedChallengeId);
    if (!challenge) return;

    setChallengeData(challenge.data);
    localStorage.setItem('gainage-last-challenge', selectedChallengeId);

    // Reset progress
    resetTimer();
    setCompletedDays(new Set());
    setSelectedDay(null);

    // Load progress for the new challenge
    const savedCompleted = localStorage.getItem(`gainage-completed-${selectedChallengeId}`);
    if (savedCompleted) {
      try {
        const parsed = JSON.parse(savedCompleted);
        if (Array.isArray(parsed)) {
          setCompletedDays(new Set(parsed));
        }
      } catch (e) { console.error("Failed to parse completed days", e); }
    }

    const savedRestTime = localStorage.getItem(`gainage-rest-time-${selectedChallengeId}`);
    if (savedRestTime) {
      const parsedTime = parseInt(savedRestTime, 10);
      if (!isNaN(parsedTime)) {
        setRestTime(parsedTime);
      }
    }
  }, [selectedChallengeId, challenges]);

  // Save progress to localStorage
  useEffect(() => {
    if (challengeData.length === 0) return;
    localStorage.setItem(`gainage-completed-${selectedChallengeId}`, JSON.stringify([...completedDays]));
  }, [completedDays, selectedChallengeId, challengeData]);

  useEffect(() => {
    if (challengeData.length === 0) return;
    localStorage.setItem(`gainage-rest-time-${selectedChallengeId}`, String(restTime));
  }, [restTime, selectedChallengeId, challengeData]);

  // Auto-select next day
  useEffect(() => {
    if (selectedDay || timerState !== 'idle' || challengeData.length === 0) {
      return;
    }
    const nextDay = challengeData.find(day => !completedDays.has(day.day));
    if (nextDay) {
      setSelectedDay(nextDay);
    }
  }, [completedDays, selectedDay, timerState, challengeData]);

  // --- Audio --- 
  const initAudioContext = useCallback(() => {
    if (audioContext) return audioContext;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);
      return ctx;
    } catch (e) {
      console.error("AudioContext is not supported.", e);
      return null;
    }
  }, [audioContext]);

  const playBeep = useCallback(() => {
    const ctx = initAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 800;
      o.type = 'sine';
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.5);
    } catch (error) {
      console.error('Erreur lors de la lecture du bip:', error);
      if (navigator.vibrate) navigator.vibrate(200);
    }
  }, [initAudioContext]);

  // --- Timer Logic ---
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTimerState('idle');
    setCountdownState(null);
    setCountdownTime(0);
    setTimeLeft(0);
  }, []);

  const handleTimerComplete = useCallback(() => {
    setIsRunning(false);
    playBeep();
    switch (timerState) {
      case 'gm':
        setTimerState('rest');
        setTimeLeft(restTime);
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
  }, [playBeep, timerState, selectedDay, restTime]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
        if (timeLeft === 0 && isRunning) handleTimerComplete();
        return;
    };
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, handleTimerComplete]);

  useEffect(() => {
    if (!countdownState || countdownTime <= 0) return;
    const interval = setInterval(() => setCountdownTime(prev => prev - 1), 1000);
    if (countdownTime > 0 && countdownTime <= 3) playBeep();
    return () => clearInterval(interval);
  }, [countdownState, countdownTime, playBeep]);

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

  useEffect(() => {
    if (timerState === 'completed') {
      setIsTransitioning(true);
      const transitionTimeout = setTimeout(() => {
        const nextDay = challengeData.find(day => !completedDays.has(day.day));
        resetTimer();
        setSelectedDay(nextDay || null);
        setIsTransitioning(false);
      }, 3000);
      return () => {
        clearTimeout(transitionTimeout);
        setIsTransitioning(false);
      }
    }
  }, [timerState, completedDays, resetTimer, challengeData]);

  const startWorkout = useCallback(() => {
    if (!selectedDay) return;
    initAudioContext();
    setCountdownState('countdown-gm');
    setCountdownTime(3);
    setTimeout(() => timerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }, [selectedDay, initAudioContext]);

  // --- UI Helpers ---
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const getTimerTitle = () => {
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
  const getTimerColor = () => {
    if (countdownState) return 'text-orange-600';
    switch (timerState) {
      case 'gm': return 'text-blue-600';
      case 'rest': return 'text-yellow-600';
      case 'gc': return 'text-red-600';
      case 'completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };
  const getProgressPercentage = () => {
    if (!selectedDay || (timerState === 'idle' && !countdownState)) return 0;
    const totalTime = selectedDay.gm + restTime + selectedDay.gc;
    let elapsed = 0;
    switch (timerState) {
      case 'gm': elapsed = selectedDay.gm - timeLeft; break;
      case 'rest': elapsed = selectedDay.gm + (restTime - timeLeft); break;
      case 'gc': elapsed = selectedDay.gm + restTime + (selectedDay.gc - timeLeft); break;
      case 'completed': elapsed = totalTime; break;
    }
    return (elapsed / totalTime) * 100;
  };

  const handleToggleComplete = (dayNumber: number) => {
      setCompletedDays(prev => {
          const newSet = new Set(prev);
          if (newSet.has(dayNumber)) newSet.delete(dayNumber);
          else newSet.add(dayNumber);
          return newSet;
      });
  };

  const nextDayToDo = challengeData.find(day => !completedDays.has(day.day));
  const isStartable = selectedDay && nextDayToDo ? selectedDay.day === nextDayToDo.day : false;
  const currentChallengeName = challenges.find(c => c.id === selectedChallengeId)?.name || 'Chargement...';

  // --- Render ---
  if (challengeData.length === 0) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><Clock className="w-12 h-12 animate-spin"/></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 p-4 font-sans" onDoubleClick={startWorkout}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-black text-red-600 mb-2">GAINAGE</h1>
          <p className="text-2xl font-bold text-gray-800">{currentChallengeName}</p>
          <p className="text-gray-600 mt-2">Sélectionnez un jour pour commencer ou appuyez longuement pour (dé)valider.</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-4">
            <Award className="text-yellow-500 w-8 h-8" />
            <div>
              <p className="text-2xl font-bold text-gray-800">{completedDays.size}/{challengeData.length}</p>
              <p className="text-gray-600">Jours complétés</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Calendrier du défi</h2>
            <div className="grid grid-cols-5 gap-3">
              {challengeData.map((day) => {
                const isSelectable = (nextDayToDo ? day.day === nextDayToDo.day : false) || completedDays.has(day.day);
                return (
                    <DayButton
                        key={day.day}
                        day={day}
                        isSelected={selectedDay?.day === day.day}
                        isCompleted={completedDays.has(day.day)}
                        onSelect={() => setSelectedDay(day)}
                        onToggleComplete={() => handleToggleComplete(day.day)}
                        disabled={isTransitioning || (timerState !== 'idle' && timerState !== 'completed')}
                        isSelectable={isSelectable}
                    />
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-200 rounded border"></div><span className="text-gray-600">À faire</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-600 rounded"></div><span className="text-gray-600">Sélectionné</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div><span className="text-gray-600">Terminé</span></div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center flex items-center justify-center gap-2"><Settings className="w-5 h-5" />Réglages</h3>
              <div className="max-w-xs mx-auto space-y-4">
                <div>
                  <label htmlFor="challenge-select" className="block text-sm font-medium text-gray-700 text-center mb-2">Défi actuel</label>
                  <div className="relative">
                    <select 
                      id="challenge-select"
                      value={selectedChallengeId}
                      onChange={e => setSelectedChallengeId(e.target.value)}
                      className="w-full appearance-none bg-white border border-gray-300 text-gray-700 py-2 pl-3 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-red-500"
                    >
                      {challenges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDown className="w-4 h-4"/></div>
                  </div>
                </div>
                <div>
                  <label htmlFor="rest-time" className="block text-sm font-medium text-gray-700 text-center mb-2">Temps de récupération</label>
                  <div className="flex items-center gap-4">
                    <input id="rest-time" type="range" min="10" max="120" step="5" value={restTime} onChange={(e) => setRestTime(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-600"/>
                    <span className="font-bold text-gray-800 text-lg w-12 text-center">{restTime}s</span>
                  </div>
                </div>
              </div>
            </div>
           
           <div className="mt-4 text-center">
             <p className="text-xs text-gray-500">💡 <strong>Astuce :</strong> Appuyez longuement sur un jour pour le marquer comme terminé ou le débloquer.</p>
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
                    <div className="bg-blue-50 px-4 py-2 rounded-lg"><p className="font-semibold text-blue-800">GAINAGE MAIN</p><p className="text-blue-600">{selectedDay.gm}"</p></div>
                    <div className="bg-red-50 px-4 py-2 rounded-lg"><p className="font-semibold text-red-800">GAINAGE COUDE</p><p className="text-red-600">{selectedDay.gc}"</p></div>
                  </div>
                </div>

                {(timerState !== 'idle' || countdownState) && (
                  <div className="space-y-4">
                    <div className="bg-gray-200 rounded-full h-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-1000" style={{ width: `${getProgressPercentage()}%` }}/></div>
                    <div className="text-center">
                      <h4 className={`text-2xl font-bold mb-2 ${getTimerColor()}`}>{getTimerTitle()}</h4>
                      {countdownState ? (
                        <div className={`text-8xl font-mono font-bold ${getTimerColor()} animate-pulse`}>{countdownTime}</div>
                      ) : (
                        <div className={`text-6xl font-mono font-bold ${getTimerColor()}`}>{formatTime(timeLeft)}</div>
                      )}
                      {timerState === 'rest' && <p className="text-gray-600 mt-2">Récupération entre les exercices</p>}
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
                    <button onClick={startWorkout} disabled={!isStartable} className={`flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl ${!isStartable ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <Play className="w-5 h-5" />
                      Commencer
                    </button>
                  )}
                  {(timerState !== 'idle' || countdownState) && timerState !== 'completed' && (
                    <button onClick={resetTimer} className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl">Arrêter</button>
                  )}
                  <button onClick={() => { initAudioContext(); playBeep(); }} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors" title="Tester le son">🔊 Test</button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600"><strong>Note:</strong> {restTime} secondes de récupération entre les exercices. Cliquez sur "🔊 Test" pour vérifier que le son fonctionne.</p>
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
