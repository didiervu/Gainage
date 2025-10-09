import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateReadableId } from './readableIdGenerator';
import { Check, Clock, ChevronDown, Home, CalendarDays, SlidersHorizontal, Play, Settings2, Users } from 'lucide-react';
import { DayData, Challenge, SeriesEntry } from './types';
import { TimerView, TimerViewHandles } from './TimerView';
import { ChallengeEditor } from './ChallengeEditor';

const USER_CHALLENGES_STORAGE_KEY = 'gainage-user-challenges';


// --- Utility to get challenges ---
import { getChallenges } from './challengeLoader';

function getUserChallengesFromLocalStorage(): Challenge[] {
  try {
    const storedChallenges = localStorage.getItem(USER_CHALLENGES_STORAGE_KEY);
    return storedChallenges ? JSON.parse(storedChallenges) : [];
  } catch (error) {
    console.error("Error loading user challenges from localStorage:", error);
    return [];
  }
}

function saveUserChallengeToLocalStorage(challenge: Challenge) {
  const userChallenges = getUserChallengesFromLocalStorage();
  const existingIndex = userChallenges.findIndex(c => c.id === challenge.id);
  if (existingIndex > -1) {
    userChallenges[existingIndex] = challenge; // Update existing
  } else {
    userChallenges.push(challenge); // Add new
  }
  localStorage.setItem(USER_CHALLENGES_STORAGE_KEY, JSON.stringify(userChallenges));
}

function removeUserChallengeFromLocalStorage(challengeId: string) {
  let userChallenges = getUserChallengesFromLocalStorage();
  userChallenges = userChallenges.filter(c => c.id !== challengeId);
  localStorage.setItem(USER_CHALLENGES_STORAGE_KEY, JSON.stringify(userChallenges));
}

// --- Sub-Components ---

interface ChallengeProgressProps {
  completed: number;
  total: number;
}

const ChallengeProgress: React.FC<ChallengeProgressProps> = ({ completed, total }) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const remaining = total - completed;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="w-full max-w-md mx-auto p-4 flex flex-col items-center space-y-4">
      <div className="relative flex items-center justify-center">
        <svg className="transform -rotate-90" width="140" height="140">
          <circle
            className="text-[#E5E7EB]"
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            r={radius}
            cx="70"
            cy="70"
          />
          <circle
            className="text-[#10B981] transition-all duration-500 ease-out"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="70"
            cy="70"
            style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-bold text-[#1F2937]">{`${Math.floor(percentage)}%`}</span>
            <span className="text-xs text-[#6B7280]">complété</span>
        </div>
      </div>
      <div className="w-full flex justify-between text-sm font-medium text-[#1F2937]">
        <span className="px-3 py-1 bg-white rounded-full shadow-sm">{`${completed} jours faits`}</span>
        <span className="px-3 py-1 bg-white rounded-full shadow-sm">{`${remaining} jours restants`}</span>
      </div>
    </div>
  );
};


interface DayDetailsProps {
  day: DayData;
}

const DayDetails: React.FC<DayDetailsProps> = ({ day }) => {
  const series = day.originalSeries || day.series || [];

  if (day.type === 'max') {
    return <p className="text-[#1F2937] text-center">Tenir le plus longtemps possible.</p>;
  }

  if (day.type === 'repos' && series.length === 0) {
      return <p className="text-[#1F2937] text-center">Jour de repos.</p>;
  }

  if (!series || series.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2 mt-2">
      {series.map((s, i) => {
        let label = s.name || 'Exercice';
        const details = [];
        if (s.reps) details.push(`${s.reps} reps`);
        if (s.time) details.push(`${s.time}s`);
        if (details.length > 0) label = `${label} : ${details.join(', ')}`;
        return <li key={i} className="text-[#1F2937] bg-white shadow-sm p-2 rounded-md text-sm">{label.trim()}</li>;
      })}
    </ul>
  );
};

// --- Main App Component ---

export function HomePage() {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState('');

  const handleCreateSession = () => {
    const sessionId = generateReadableId();
    navigate(`/session/${sessionId}`);
  };

  const handleJoinSession = () => {
    if (!joinId.trim()) return;
    // Extrait le dernier segment de l'URL si c'est un lien complet
    const id = joinId.includes('/') ? joinId.split('/').pop() : joinId;
    navigate(`/session/${id}`);
  };
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
  const dayRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const nextDayToDo = useMemo(() => challengeData.find(day => !completedDays.has(day.day)), [challengeData, completedDays]);

  const [activeTab, setActiveTab] = useState('home');
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);

  const [newChallengeName, setNewChallengeName] = useState<string>('');
  const [repsMultiplier, setRepsMultiplier] = useState<number>(1);
  const [timeToAdd, setTimeToAdd] = useState<number>(0);

  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  const [selectedChallengeToDuplicateId, setSelectedChallengeToDuplicateId] = useState<string>('default');
  const [selectedChallengeToExportId, setSelectedChallengeToExportId] = useState<string>('default');

  const [customChallenges, setCustomChallenges] = useState<Challenge[]>(() => getUserChallengesFromLocalStorage());





  useEffect(() => {
    localStorage.setItem(USER_CHALLENGES_STORAGE_KEY, JSON.stringify(customChallenges));
  }, [customChallenges]);

  const allChallenges = useMemo(() => [...challenges, ...customChallenges], [challenges, customChallenges]);

  // --- Effects ---
  useEffect(() => {
    const loadDefaultChallenges = async () => {
      const defaultChallenges = await getChallenges();
      setChallenges(defaultChallenges);
    };
    loadDefaultChallenges();
  }, []);

  useEffect(() => {
    const challenge = allChallenges.find(c => c.id === selectedChallengeId);
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
    setSelectedDay(nextDay ? { ...nextDay } : (processedData[0] ? { ...processedData[0] } : null));

  }, [selectedChallengeId, allChallenges]);

  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-completed-${selectedChallengeId}`, JSON.stringify([...completedDays])); }, [completedDays, selectedChallengeId, challengeData]);
  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-max-times-${selectedChallengeId}`, JSON.stringify(maxTimes)); }, [maxTimes, selectedChallengeId, challengeData]);
  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-rest-time-${selectedChallengeId}`, String(restTime)); }, [restTime, selectedChallengeId, challengeData]);
  useEffect(() => { if (challengeData.length > 0) localStorage.setItem(`gainage-free-mode-${selectedChallengeId}`, JSON.stringify(isFreeMode)); }, [isFreeMode, selectedChallengeId, challengeData]);

  // Scroll to the selected day when the calendar tab is active
  useEffect(() => {
    if (activeTab === 'calendar' && selectedDay) {
      const dayElement = dayRefs.current.get(selectedDay.day);
      if (dayElement) {
        dayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeTab, selectedDay]);

  

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
      if (!isFreeMode) return; // Only allow toggling in free mode

      setCompletedDays(prev => {
          const newSet = new Set(prev);
          if (newSet.has(dayNumber)) newSet.delete(dayNumber);
          else newSet.add(dayNumber);
          return newSet;
      });
  }, [isFreeMode]);

  const handleDuplicateChallenge = useCallback(async () => {
    if (!newChallengeName.trim()) {
      alert('Veuillez donner un nom au nouveau défi.');
      return;
    }

    const challengeToDuplicate = allChallenges.find(c => c.id === selectedChallengeToDuplicateId);
    if (!challengeToDuplicate) {
      alert('Défi à dupliquer introuvable.');
      return;
    }

    const newChallengeId = newChallengeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (allChallenges.some(c => c.id === newChallengeId)) {
      alert('Un défi avec ce nom existe déjà. Veuillez choisir un nom différent.');
      return;
    }

    const duplicatedData: DayData[] = challengeToDuplicate.data.map(day => {
      const baseDay = { ...day }; // Shallow copy of the day object

      // Ensure series is an array, even if it was undefined/null in the original
      let currentSeries = day.series || [];

      if (day.type === 'repos') {
        return { ...baseDay, series: day.series || [], originalSeries: day.originalSeries || [] };
      }

      // If it's an 'exercices' day and currentSeries is empty, initialize with a default exercise
      if (day.type !== 'repos' && day.type !== 'max' && currentSeries.length === 0) {
          currentSeries = [{ name: 'Nouvel exercice', time: 30 }];
      }


      const newSeries: SeriesEntry[] = currentSeries.map(entry => {
        const newEntry = { ...entry };
        if (newEntry.reps !== undefined) {
          newEntry.reps = Math.round(newEntry.reps * repsMultiplier);
        }
        if (newEntry.time !== undefined) {
          newEntry.time = newEntry.time + timeToAdd;
          if (newEntry.time < 0) newEntry.time = 0;
        }
        return newEntry;
      });

      // Explicitly set series and originalSeries
      return { ...baseDay, series: newSeries, originalSeries: newSeries };
    });

    const newChallenge: Challenge = {
      id: newChallengeId,
      name: newChallengeName,
      data: duplicatedData,
    };

    setCustomChallenges(prev => [...prev, newChallenge]);

    alert(`Défi "${newChallenge.name}" créé et sauvegardé localement.`);

    // Update the challenges list in the UI
    setNewChallengeName(''); // Clear form
    setRepsMultiplier(1);
    setTimeToAdd(0);
    setActiveTab('challenge-management');

  }, [challenges, newChallengeName, repsMultiplier, timeToAdd, selectedChallengeToDuplicateId]);

  const handleImportChallengeFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedImportFile(event.target.files[0]);
    } else {
      setSelectedImportFile(null);
    }
  }, []);

  const handleImportChallenge = useCallback(async () => {
    if (!selectedImportFile) {
      alert('Veuillez sélectionner un fichier JSON à importer.');
      return;
    }

    try {
      const fileContent = await selectedImportFile.text();
      const importedChallengeData = JSON.parse(fileContent);

      // Basic validation for challenge structure
      if (!importedChallengeData.id || !importedChallengeData.name || !importedChallengeData.data) {
        alert('Le fichier JSON sélectionné ne semble pas être un défi valide.');
        return;
      }

      // Ensure unique ID for imported challenge
      let newChallengeId = importedChallengeData.id;
      let counter = 1;
      while (allChallenges.some(c => c.id === newChallengeId)) {
        newChallengeId = `${importedChallengeData.id}-${counter}`;
        counter++;
      }
      const importedChallenge: Challenge = { ...importedChallengeData, id: newChallengeId };

      setCustomChallenges(prev => [...prev, importedChallenge]);
      alert(`Défi "${importedChallenge.name}" importé et sauvegardé localement.`);

      setSelectedChallengeId(importedChallenge.id);
      setSelectedImportFile(null); // Clear selected file
    } catch (error) {
      console.error("Error importing challenge:", error);
      alert('Erreur lors de l\'importation du défi. Assurez-vous que le fichier est un JSON valide.');
    }
  }, [selectedImportFile, challenges]);

  const handleExportChallenge = useCallback(() => {
    const challengeToExport = allChallenges.find(c => c.id === selectedChallengeToExportId);
    if (!challengeToExport) {
      alert('Défi à exporter introuvable.');
      return;
    }

    const fileContent = JSON.stringify(challengeToExport, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${challengeToExport.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`Défi "${challengeToExport.name}" exporté et téléchargé.`);
  }, [challenges, selectedChallengeToExportId]);



  const handleUpdateCustomChallenge = (challenge: Challenge) => {
    setCustomChallenges(prev => prev.map(c => c.id === challenge.id ? challenge : c));
  };

  // --- Render ---
  if (challengeData.length === 0) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><Clock className="w-12 h-12 animate-spin"/></div>;
  }

  const currentChallengeName = allChallenges.find(c => c.id === selectedChallengeId)?.name || 'Chargement...';
  const selectedChallenge = allChallenges.find(c => c.id === selectedChallengeId);
  

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="p-4">
            <p style={{ backgroundColor: 'red', color: 'white', padding: '10px', textAlign: 'center', fontSize: '12px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
              DEBUG: API URL is {import.meta.env.VITE_API_URL || 'NOT SET'}
            </p>
            <h1 className="text-3xl font-bold text-center text-[#10B981] mb-2">{selectedDay ? `Jour ${selectedDay.day}` : (nextDayToDo ? `Jour ${nextDayToDo.day}`: 'Défi Terminé')}</h1>
            <p className="text-center text-[#1F2937] mb-6">{currentChallengeName}</p>
            {selectedDay ? (
              <>
                <DayDetails day={selectedDay} />
                <div className="mt-8 w-full max-w-sm mx-auto p-4 bg-white/90 rounded-2xl shadow-lg">
                  {selectedDay.type === 'repos' ? (
                    <button onClick={() => handleWorkoutComplete(selectedDay.day)} className="w-full flex items-center justify-center gap-2 bg-[#10B981] text-white font-bold py-3 px-5 rounded-full shadow-lg hover:bg-[#059669] transition-transform hover:scale-105">
                      <Check />
                      Marquer comme Jour de Repos
                    </button>
                  ) : (
                    <button onClick={startWorkout} className="w-full flex items-center justify-center gap-2 bg-[#10B981] text-white font-bold py-3 px-5 rounded-full shadow-lg hover:bg-[#059669] transition-transform hover:scale-105">
                      <Play />
                      Démarrer en Solo
                    </button>
                  )}

                  <div className="my-4 border-t border-gray-200"></div>

                  <h3 className="text-lg font-bold text-center text-gray-700 mb-3">Multijoueur</h3>
                  
                  <button onClick={handleCreateSession} className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white font-bold py-3 px-5 rounded-full shadow-lg hover:bg-blue-600 transition-transform hover:scale-105 mb-4">
                    <Users size={20} />
                    Créer une session
                  </button>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={joinId}
                      onChange={e => setJoinId(e.target.value)}
                      className="w-full bg-white border border-gray-300 text-[#1F2937] py-2 px-3 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400" 
                      placeholder="Coller un lien ou ID..."
                    />
                    <button onClick={handleJoinSession} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-full hover:bg-gray-700 shadow-md">
                      Rejoindre
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <Check className="w-12 h-12 text-[#10B981] mx-auto mb-4" />
                <h2 className="text-2xl font-semibold">Félicitations !</h2>
                <p className="text-[#1F2937]">Vous avez terminé ce défi.</p>
              </div>
            )}
            <div className="mt-8">
              <ChallengeProgress completed={completedDays.size} total={challengeData.length} />
            </div>
          </div>
        );
      case 'calendar':
        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">Programme du défi</h1>
            <div className="space-y-4">
              {challengeData.map((day) => (
                <div 
                  key={day.day} 
                  ref={(el) => dayRefs.current.set(day.day, el)}
                  className={`p-4 rounded-lg ${completedDays.has(day.day) ? 'bg-[#F9FAFB]' : 'bg-white'} shadow-md transition-all`}>
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-[#10B981] cursor-pointer hover:underline" onClick={() => handleDaySelect(day)}>
                      Jour {day.day}
                    </h2>
                    <button onClick={() => handleToggleComplete(day.day)} className={`p-1 rounded-full transition-colors ${completedDays.has(day.day) ? 'bg-[#10B981] text-white hover:bg-[#059669]' : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'}`}>
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
            <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">Réglages</h1>
            <div className="max-w-xs mx-auto space-y-6">
              <div>
                <label htmlFor="challenge-select" className="block text-sm font-medium text-[#1F2937] mb-2">Défi actuel</label>
                <div className="relative">
                  <select id="challenge-select" value={selectedChallengeId} onChange={e => setSelectedChallengeId(e.target.value)} className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]">
                    {allChallenges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#1F2937]"><ChevronDown className="w-4 h-4"/></div>
                </div>
              </div>
              <div>
                <label htmlFor="rest-time" className="block text-sm font-medium text-[#1F2937] mb-2">Temps de récupération</label>
                <div className="flex items-center gap-4">
                  <input id="rest-time" type="range" min="10" max="120" step="5" value={restTime} onChange={(e) => setRestTime(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#10B981]"/>
                  <span className="font-bold text-[#1F2937] text-lg w-12 text-center">{restTime}s</span>
                </div>
              </div>
              <div>
                <label className="flex items-center justify-center gap-2 text-sm font-medium text-[#1F2937] mt-4">
                  <input type="checkbox" checked={isFreeMode} onChange={(e) => setIsFreeMode(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#10B981] focus:ring-[#10B981] accent-[#10B981]"/>
                  <span>Mode libre (permet de faire les jours dans le désordre)</span>
                </label>
              </div>
            </div>
          </div>
        );
      case 'challenge-management':
        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">Gestion des défis</h1>
            <div className="space-y-6">

              {/* Duplicate Challenge Card */}
              <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-[#1F2937] mb-2">Dupliquer un défi</h3>
                <p className="text-sm text-gray-600 mb-4">Créez une copie d'un défi existant, avec la possibilité de modifier les répétitions et les durées.</p>
                <label htmlFor="challenge-to-duplicate-select" className="block text-sm font-medium text-[#1F2937] mb-2">Défi à dupliquer</label>
                <div className="relative mb-4">
                  <select id="challenge-to-duplicate-select" value={selectedChallengeToDuplicateId} onChange={e => setSelectedChallengeToDuplicateId(e.target.value)} className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]">
                    {allChallenges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#1F2937]"><ChevronDown className="w-4 h-4"/></div>
                </div>
                <label htmlFor="new-challenge-name" className="block text-sm font-medium text-[#1F2937] mb-2">Nom du nouveau défi</label>
                <input type="text" id="new-challenge-name" value={newChallengeName} onChange={e => setNewChallengeName(e.target.value)} className="w-full bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] mb-4" placeholder="Ex: Mon défi personnalisé"/>
                <label htmlFor="reps-multiplier" className="block text-sm font-medium text-[#1F2937] mb-2">Multiplicateur de répétitions</label>
                <input type="number" id="reps-multiplier" value={repsMultiplier} onChange={e => setRepsMultiplier(parseFloat(e.target.value))} step="0.1" className="w-full bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] mb-4"/>
                <label htmlFor="time-add" className="block text-sm font-medium text-[#1F2937] mb-2">Temps à ajouter (secondes)</label>
                <input type="number" id="time-add" value={timeToAdd} onChange={e => setTimeToAdd(parseInt(e.target.value))} step="1" className="w-full bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] mb-6"/>
                <button onClick={handleDuplicateChallenge} className="w-full bg-[#10B981] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#059669]">Dupliquer</button>
              </div>

              {/* Import/Export Challenge Card */}
              <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-[#1F2937] mb-2">Importer / Exporter</h3>
                <p className="text-sm text-gray-600 mb-4">Partagez vos défis avec d'autres ou sauvegardez-les sur votre appareil.</p>
                <h4 className="font-semibold text-[#1F2937] mb-2">Importer</h4>
                <input type="file" accept=".json" onChange={handleImportChallengeFile} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-[#10B981] hover:file:bg-gray-200 mb-4"/>
                <button onClick={handleImportChallenge} className="w-full bg-[#10B981] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#059669] mb-4">Importer</button>
                <h4 className="font-semibold text-[#1F2937] mb-2">Exporter</h4>
                <div className="relative mb-4">
                  <select value={selectedChallengeToExportId} onChange={e => setSelectedChallengeToExportId(e.target.value)} className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]">
                    {allChallenges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#1F2937]"><ChevronDown className="w-4 h-4"/></div>
                </div>
                <button onClick={handleExportChallenge} className="w-full bg-[#10B981] text-white font-bold py-2 px-4 rounded-lg hover:bg-[#059669]">Exporter</button>
              </div>



            </div>
          </div>
        );
      case 'editor':
        return (
      <ChallengeEditor
        challenges={customChallenges}
        defaultChallenges={challenges}
        onChallengesChange={setCustomChallenges}
        initialEditingChallenge={null}
        onCloseEditor={() => setActiveTab('challenge-management')}
      />
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FDF4] font-sans text-[#1F2937]">
      <div className="pb-20">
        {renderContent()}
      </div>

      {isWorkoutActive && selectedDay && (
        <div className="fixed inset-0 bg-white z-50 animate-fade-in">
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around shadow-top-lg">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'home' ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
          <Home />
          <span className="text-xs">Accueil</span>
        </button>
        <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'calendar' ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
          <CalendarDays />
          <span className="text-xs">Calendrier</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'settings' ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
          <SlidersHorizontal />
          <span className="text-xs">Réglages</span>
        </button>
        <button onClick={() => setActiveTab('challenge-management')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'challenge-management' ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
          <Settings2 />
          <span className="text-xs">Gérer</span>
        </button>
        <button onClick={() => setActiveTab('editor')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'editor' ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil-ruler"><path d="m15 5 4 4"/><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13"/><path d="M8 12v4h4"/><path d="M21.7 16.4a1 1 0 0 0-1.1-1.5l-1.6.3-3.5-3.5.3-1.6a1 1 0 0 0-1.5-1.1l-1.9 1.9-8.2 8.2c-.9.9-2.3.9-3.2 0l-2.3-2.3a2.3 2.3 0 0 1 0-3.2l8.2-8.2 1.9-1.9Z"/></svg>
          <span className="text-xs">Éditeur</span>
        </button>
      </nav>
    </div>
  );
}
