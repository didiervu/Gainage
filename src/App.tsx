import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Clock, ChevronDown, Home, CalendarDays, SlidersHorizontal, Play } from 'lucide-react';
import { DayData, Challenge } from './types';
import { TimerView, TimerViewHandles } from './TimerView';


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

// --- Sub-Components ---

interface DayDetailsProps {
  day: DayData;
}

const DayDetails: React.FC<DayDetailsProps> = ({ day }) => {
  const series = day.originalSeries || day.series || [];
  if (day.type === 'repos') return <p className="text-[#EAEAEA] text-center">Jour de repos.</p>;
  if (series.length === 0) {
    if (day.type === 'max') return <p className="text-[#EAEAEA] text-center">Session d'exercices à intensité maximale.</p>;
    return <p className="text-[#EAEAEA] text-center">Aucun exercice pour ce jour.</p>;
  }
  return (
    <ul className="space-y-2 mt-2">
      {series.map((s, i) => {
        let label = s.name || 'Exercice';
        if (s.isMax) {
            if (!label.toLowerCase().includes('max')) label = `${label} MAX`;
        } else {
            const details = [];
            if (s.reps) details.push(`${s.reps} reps`);
            if (s.time) details.push(`${s.time}s`);
            if (details.length > 0) label = `${label} : ${details.join(', ')}`;
        }
        return <li key={i} className="text-[#EAEAEA] bg-[#243447] p-2 rounded-md text-sm">{label.trim()}</li>;
      })}
    </ul>
  );
};

// --- Main App Component ---

function App() {
  // --- State ---
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>('default');
  const [challengeData, setChallengeData] = useState<DayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [restTime, setRestTime] = useState<number>(30);
  const [maxTimes, setMaxTimes] = useState<{ [day: number]: number }>({});
  const [isFreeMode, setIsFreeMode] = useState<boolean>(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const timerViewRef = useRef<TimerViewHandles>(null);

  const [activeTab, setActiveTab] = useState('home');
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);

  // --- Effects ---
  useEffect(() => {
    getChallenges().then(loadedChallenges => {
      setChallenges(loadedChallenges);
      const lastChallengeId = localStorage.getItem('gainage-last-challenge') || 'default';
      setSelectedChallengeId(lastChallengeId);
    });
  }, []);

  useEffect(() => {
    const challenge = challenges.find(c => c.id === selectedChallengeId);
    if (!challenge) return;

    const processedData = challenge.data.map(day => {
      if (!day.series) return day;
      return { ...day, series: day.series, originalSeries: day.series };
    });

    setChallengeData(processedData);
    localStorage.setItem('gainage-last-challenge', selectedChallengeId);

    const savedCompleted = JSON.parse(localStorage.getItem(`gainage-completed-${selectedChallengeId}`) || '[]') as number[];
    setCompletedDays(new Set(savedCompleted));
    const savedMaxTimes = JSON.parse(localStorage.getItem(`gainage-max-times-${selectedChallengeId}`) || '{}');
    setMaxTimes(savedMaxTimes);
    setRestTime(parseInt(localStorage.getItem(`gainage-rest-time-${selectedChallengeId}`) || '30', 10));
    setIsFreeMode(JSON.parse(localStorage.getItem(`gainage-free-mode-${selectedChallengeId}`) || 'false'));
    
    const nextDay = processedData.find(day => !savedCompleted.includes(day.day));
    setSelectedDay(nextDay || processedData[0] || null);

  }, [selectedChallengeId, challenges]);

  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-completed-${selectedChallengeId}`, JSON.stringify([...completedDays])); }, [completedDays, selectedChallengeId, challengeData]);
  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-max-times-${selectedChallengeId}`, JSON.stringify(maxTimes)); }, [maxTimes, selectedChallengeId, challengeData]);
  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-rest-time-${selectedChallengeId}`, String(restTime)); }, [restTime, selectedChallengeId, challengeData]);
  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-free-mode-${selectedChallengeId}`, JSON.stringify(isFreeMode)); }, [isFreeMode, selectedChallengeId, challengeData]);

  // --- Audio --- 
  const initAudioContext = useCallback(() => {
    if (audioContext) return audioContext;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext is not supported.");
      }
      const ctx = new AudioContextClass();
      setAudioContext(ctx);
      return ctx;
    } catch (e) { console.error("AudioContext is not supported.", e); return null; }
  }, [audioContext]);

  const playBeep = useCallback(() => {
    const ctx = initAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 800; o.type = 'sine';
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
    } catch (error) { console.error('Erreur lors de la lecture du bip:', error); if (navigator.vibrate) navigator.vibrate(200); }
  }, [initAudioContext]);

  // --- Handlers ---
  const handleDaySelect = (day: DayData) => {
    setSelectedDay(day);
    setActiveTab('home');
  };

  const startWorkout = () => {
    if (!selectedDay || (selectedDay.type !== 'max' && (!selectedDay.series || selectedDay.series.length === 0))) return;
    initAudioContext();
    setIsWorkoutActive(true);
    setTimeout(() => timerViewRef.current?.startWorkout(), 100); // Delay to allow modal transition
  };

  const handleCloseWorkout = () => {
    timerViewRef.current?.stopWorkout();
    setIsWorkoutActive(false);
  };

  const handleWorkoutComplete = useCallback((dayNumber: number, maxTime?: number) => {
    setIsWorkoutActive(false);
    setCompletedDays(prevCompleted => {
        const newCompleted = new Set([...prevCompleted, dayNumber]);
        const nextDay = challengeData.find(day => !newCompleted.has(day.day) && day.day > dayNumber);
        setSelectedDay(nextDay || null);
        return newCompleted;
    });
    if (maxTime !== undefined) {
      setMaxTimes(prev => ({ ...prev, [dayNumber]: maxTime }));
    }
    setActiveTab('home');
  }, [challengeData]);

  const handleToggleComplete = useCallback((dayNumber: number) => {
      setCompletedDays(prev => {
          const newSet = new Set(prev);
          if (newSet.has(dayNumber)) newSet.delete(dayNumber);
          else newSet.add(dayNumber);
          return newSet;
      });
  }, []);

  // --- Render --- 
  if (challengeData.length === 0) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><Clock className="w-12 h-12 animate-spin"/></div>;
  }

  const currentChallengeName = challenges.find(c => c.id === selectedChallengeId)?.name || 'Chargement...';
  const nextDayToDo = challengeData.find(day => !completedDays.has(day.day));

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold text-center text-[#FF6B35] mb-2">{selectedDay ? `Jour ${selectedDay.day}` : (nextDayToDo ? `Jour ${nextDayToDo.day}`: 'Défi Terminé')}</h1>
            <p className="text-center text-[#EAEAEA] mb-6">{currentChallengeName}</p>
            {selectedDay ? (
              <>
                <DayDetails day={selectedDay} />
                <div className="mt-8 flex justify-center">
                  {selectedDay.type === 'repos' ? (
                    <button onClick={() => handleWorkoutComplete(selectedDay.day)} className="flex items-center gap-2 bg-[#06D6A0] text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-[#05B88A] transition-transform hover:scale-105">
                      <Check />
                      Marquer comme terminé
                    </button>
                  ) : (
                    <button onClick={startWorkout} className="flex items-center gap-2 bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-red-700 transition-transform hover:scale-105">
                      <Play />
                      Démarrer
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center p-8 bg-[#243447] rounded-lg shadow-md">
                <Check className="w-12 h-12 text-[#06D6A0] mx-auto mb-4" />
                <h2 className="text-2xl font-semibold">Félicitations !</h2>
                <p className="text-[#EAEAEA]">Vous avez terminé ce défi.</p>
              </div>
            )}
          </div>
        );
      case 'calendar':
        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold text-center text-[#FF6B35] mb-6">Programme du défi</h1>
            <div className="space-y-4">
              {challengeData.map((day) => (
                <div key={day.day} className={`p-4 rounded-lg ${completedDays.has(day.day) ? 'bg-[#1A2635]' : 'bg-[#243447]'} shadow-md transition-all`}>
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-[#FF6B35] cursor-pointer hover:underline" onClick={() => handleDaySelect(day)}>
                      Jour {day.day}
                    </h2>
                    <button onClick={() => handleToggleComplete(day.day)} className={`p-1 rounded-full transition-colors ${completedDays.has(day.day) ? 'bg-[#06D6A0] text-white hover:bg-[#05B88A]' : 'bg-[#243447] text-[#EAEAEA] hover:bg-[#1A2635]'}`}>
                      <Check size={16} />
                    </button>
                  </div>
                  <div className="mt-2">
                    <DayDetails day={day} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold text-center text-[#FF6B35] mb-6">Réglages</h1>
            <div className="max-w-xs mx-auto space-y-6">
              <div>
                <label htmlFor="challenge-select" className="block text-sm font-medium text-[#EAEAEA] mb-2">Défi actuel</label>
                <div className="relative">
                  <select id="challenge-select" value={selectedChallengeId} onChange={e => setSelectedChallengeId(e.target.value)} className="w-full appearance-none bg-[#243447] border border-[#FF6B35] text-[#EAEAEA] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-[#1A2635] focus:border-[#FF6B35]">
                    {challenges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#EAEAEA]"><ChevronDown className="w-4 h-4"/></div>
                </div>
              </div>
              <div>
                <label htmlFor="rest-time" className="block text-sm font-medium text-[#EAEAEA] mb-2">Temps de récupération</label>
                <div className="flex items-center gap-4">
                  <input id="rest-time" type="range" min="10" max="120" step="5" value={restTime} onChange={(e) => setRestTime(Number(e.target.value))} className="w-full h-2 bg-[#243447] rounded-lg appearance-none cursor-pointer accent-red-600"/>
                  <span className="font-bold text-[#EAEAEA] text-lg w-12 text-center">{restTime}s</span>
                </div>
              </div>
              <div>
                <label className="flex items-center justify-center gap-2 text-sm font-medium text-[#EAEAEA] mt-4">
                  <input type="checkbox" checked={isFreeMode} onChange={(e) => setIsFreeMode(e.target.checked)} className="h-4 w-4 rounded border-[#FF6B35] text-red-600 focus:ring-red-500"/>
                  <span>Mode libre (permet de faire les jours dans le désordre)</span>
                </label>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] font-sans text-[#EAEAEA]">
      <div className="pb-20">
        {renderContent()}
      </div>

      {isWorkoutActive && selectedDay && (
        <div className="fixed inset-0 bg-[#0D1B2A] z-50 animate-fade-in">
          <TimerView
            ref={timerViewRef}
            selectedDay={selectedDay}
            restTime={restTime}
            onWorkoutComplete={handleWorkoutComplete}
            playBeep={playBeep}
            onClose={handleCloseWorkout}
          />
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-[#0D1B2A] border-t border-[#243447] flex justify-around shadow-top-lg">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'home' ? 'text-red-600' : 'text-[#EAEAEA]'}`}>
          <Home />
          <span className="text-xs">Accueil</span>
        </button>
        <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'calendar' ? 'text-red-600' : 'text-[#EAEAEA]'}`}>
          <CalendarDays />
          <span className="text-xs">Calendrier</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'settings' ? 'text-red-600' : 'text-[#EAEAEA]'}`}>
          <SlidersHorizontal />
          <span className="text-xs">Réglages</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
