import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Clock, Award, Settings, ChevronDown } from 'lucide-react';
import { DayData, Challenge } from './types';
import { TimerView, TimerViewHandles } from './TimerView'; // Import TimerViewHandles
import { useLongPress } from './useLongPress';

// --- Utility to get challenges ---
const challengeModules = import.meta.glob('./challenges/*.json');

async function getChallenges(): Promise<Challenge[]> {
  const challenges: Challenge[] = [];
  for (const path in challengeModules) {
    const id = path.split('/').pop()?.replace('.json', '');
    if (id) {
      const module = await challengeModules[path]() as { name: string; data: DayData[] };
      challenges.push({ id, name: module.name, data: module.data });
    }
  }
  return challenges;
}

// --- Components ---

interface DayButtonProps {
    day: DayData;
    isSelected: boolean;
    isCompleted: boolean;
    onSelect: () => void;
    onToggleComplete: () => void;
    disabled: boolean;
    isSelectable: boolean;
    maxTime?: number;
}

const DayButton: React.FC<DayButtonProps> = ({ day, isSelected, isCompleted, onSelect, onToggleComplete, disabled, isSelectable, maxTime }) => {
    const longPressHandlers = useLongPress(onToggleComplete, isSelectable ? onSelect : () => {}, { delay: 500 });
    const handlers = disabled ? {} : longPressHandlers;

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    const renderDayContent = () => {
      if (isCompleted && maxTime && maxTime > 0) {
        return (
          <div className="text-white text-xs font-bold">
            {formatTime(maxTime)}
          </div>
        );
      }

      if (day.type === 'max') {
        return (
          <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'} text-xs`}>
            MAX
            {day.series && day.series.length > 0 && ` + ${day.series.length} SÉRIES`}
          </div>
        );
      } else if (day.type === 'repos') {
        return <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'} text-xs`}>REPOS</div>;
      } else if (day.series) {
        const gmEntry = day.series.find(s => s.name === 'Gainage Main');
        const gcEntry = day.series.find(s => s.name === 'Gainage Coude');
        return (
          <div className="text-xs space-y-0.5">
            {gmEntry && <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'}`}>{gmEntry.time}" GM</div>}
            {gcEntry && <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'}`}>{gcEntry.time}" GC</div>}
            {!gmEntry && !gcEntry && <div className={`${isSelected || isCompleted ? 'text-white' : 'text-gray-600'}`}>{day.series.length} SÉRIES</div>}
          </div>
        );
      }
      return null;
    };

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
              {renderDayContent()}
            </div>
        </button>
    );
};

function App() {
  // --- State ---
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('default');
  const [challengeData, setChallengeData] = useState<DayData[]>([]);

  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [restTime, setRestTime] = useState<number>(30);
  const [maxTimes, setMaxTimes] = useState<{ [day: number]: number }>({}); // Store max times
  const [isFreeMode, setIsFreeMode] = useState<boolean>(false);
  
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const timerViewRef = useRef<TimerViewHandles>(null); // Ref for TimerView

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

    // Expand series based on 'reps' property
    const processedData = challenge.data.map(day => {
      if (!day.series) return day;
      const newSeries = day.series.flatMap(entry => {
        if (entry.reps && entry.reps > 1) {
          return Array(entry.reps).fill(null).map(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { reps, ...rest } = entry;
            return rest;
          });
        }
        return entry;
      });
      return { ...day, series: newSeries };
    });

    setChallengeData(processedData);
    localStorage.setItem('gainage-last-challenge', selectedChallengeId);

    // Reset progress
    setCompletedDays(new Set());
    setSelectedDay(null);
    setMaxTimes({}); // Reset max times

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

    const savedMaxTimes = localStorage.getItem(`gainage-max-times-${selectedChallengeId}`);
    if (savedMaxTimes) {
      try {
        const parsed = JSON.parse(savedMaxTimes);
        if (typeof parsed === 'object' && parsed !== null) {
          setMaxTimes(parsed);
        }
      } catch (e) { console.error("Failed to parse max times", e); }
    }

    const savedFreeMode = localStorage.getItem(`gainage-free-mode-${selectedChallengeId}`);
    if (savedFreeMode) {
      try {
        setIsFreeMode(JSON.parse(savedFreeMode));
      } catch (e) { console.error("Failed to parse free mode", e); }
    } else {
      setIsFreeMode(false);
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

  useEffect(() => {
    if (challengeData.length === 0) return;
    localStorage.setItem(`gainage-max-times-${selectedChallengeId}`, JSON.stringify(maxTimes));
  }, [maxTimes, selectedChallengeId, challengeData]);

  useEffect(() => {
    if (challengeData.length === 0) return;
    localStorage.setItem(`gainage-free-mode-${selectedChallengeId}`, JSON.stringify(isFreeMode));
  }, [isFreeMode, selectedChallengeId, challengeData]);

  // Auto-select next day
  useEffect(() => {
    if (selectedDay || challengeData.length === 0) {
      return;
    }
    const nextDay = challengeData.find(day => !completedDays.has(day.day));
    if (nextDay) {
      setSelectedDay(nextDay);
    }
  }, [completedDays, selectedDay, challengeData]);

  // --- Audio --- 
  const initAudioContext = useCallback(() => {
    if (audioContext) return audioContext;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const startWorkout = useCallback(() => {
    if (!selectedDay) return;
    initAudioContext();
    timerViewRef.current?.startWorkout(); // Call startWorkout on TimerView
    setTimeout(() => timerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }, [selectedDay, initAudioContext]);

  const handleWorkoutComplete = useCallback((dayNumber: number, maxTime?: number) => {
    setCompletedDays(prev => new Set([...prev, dayNumber]));
    if (maxTime !== undefined) {
      setMaxTimes(prev => ({ ...prev, [dayNumber]: maxTime }));
    }
    // By setting the selected day to null, we trigger the auto-selection useEffect
    // on the next render, which will have the updated completedDays set.
    setSelectedDay(null);
  }, []);

  const handleToggleComplete = useCallback((dayNumber: number) => {
      setCompletedDays(prev => {
          const newSet = new Set(prev);
          if (newSet.has(dayNumber)) newSet.delete(dayNumber);
          else newSet.add(dayNumber);
          return newSet;
      });
      // If it's a 'repos' day, mark it as completed immediately
      const day = challengeData.find(d => d.day === dayNumber);
      if (day && day.type === 'repos') {
        setCompletedDays(prev => new Set([...prev, dayNumber]));
        setSelectedDay(null); // Deselect the day after marking as complete
      }
  }, [challengeData, setSelectedDay]);

  const nextDayToDo = challengeData.find(day => !completedDays.has(day.day));
  
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
                const isSelectable = isFreeMode || (nextDayToDo ? day.day === nextDayToDo.day : false) || completedDays.has(day.day);
                const isDayDisabled = !isFreeMode && selectedDay && selectedDay.day !== day.day; // Disable other days when one is selected
                const dayMaxTime = maxTimes[day.day];

                return (
                    <DayButton
                        key={day.day}
                        day={day}
                        isSelected={selectedDay?.day === day.day}
                        isCompleted={completedDays.has(day.day)}
                        onSelect={() => setSelectedDay(day)}
                        onToggleComplete={() => handleToggleComplete(day.day)}
                        disabled={isDayDisabled}
                        isSelectable={isSelectable}
                        maxTime={dayMaxTime}
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
                <div>
                  <label className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700 mt-4">
                    <input
                      type="checkbox"
                      checked={isFreeMode}
                      onChange={(e) => setIsFreeMode(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span>Mode libre</span>
                  </label>
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
                <p className="text-gray-500">Choisissez un jour dans le calendar pour voir les exercices</p>
              </div>
            ) : (
              <TimerView
                ref={timerViewRef}
                selectedDay={selectedDay}
                restTime={restTime}
                onWorkoutComplete={handleWorkoutComplete}
                playBeep={playBeep}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
