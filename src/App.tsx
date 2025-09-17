import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Check, Clock, ChevronDown, Home, CalendarDays, SlidersHorizontal, Play, ListTodo } from 'lucide-react';
import { DayData, Challenge } from './types';
import { TimerView, TimerViewHandles } from './TimerView';

const USER_CHALLENGES_STORAGE_KEY = 'gainage-user-challenges';


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
  const [selectedChallengeToDeleteId, setSelectedChallengeToToDeleteId] = useState<string>('default');

  // --- Effects ---
  useEffect(() => {
    const loadAllChallenges = async () => {
      const defaultChallenges = await getChallenges();
      const userChallenges = getUserChallengesFromLocalStorage();
      const allChallenges = [...defaultChallenges, ...userChallenges];
      setChallenges(allChallenges);

      const lastChallengeId = localStorage.getItem('gainage-last-challenge') || 'default';
      // Ensure last selected challenge is still valid, otherwise select first available
      const initialSelectedId = allChallenges.some(c => c.id === lastChallengeId) ? lastChallengeId : (allChallenges[0]?.id || 'default');
      setSelectedChallengeId(initialSelectedId);
    };
    loadAllChallenges();
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

    const challengeToDuplicate = challenges.find(c => c.id === selectedChallengeToDuplicateId);
    if (!challengeToDuplicate) {
      alert('Défi à dupliquer introuvable.');
      return;
    }

    const newChallengeId = newChallengeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (challenges.some(c => c.id === newChallengeId)) {
      alert('Un défi avec ce nom existe déjà. Veuillez choisir un nom différent.');
      return;
    }

    const duplicatedData: DayData[] = challengeToDuplicate.data.map(day => {
      if (day.type === 'repos' || !day.series) {
        return { ...day };
      }

      const newSeries: SeriesEntry[] = day.series.map(entry => {
        const newEntry = { ...entry };
        if (newEntry.reps !== undefined) {
          newEntry.reps = Math.round(newEntry.reps * repsMultiplier);
        }
        if (newEntry.time !== undefined) {
          newEntry.time = newEntry.time + timeToAdd;
          if (newEntry.time < 0) newEntry.time = 0; // Ensure time doesn't go negative
        }
        return newEntry;
      });
      return { ...day, series: newSeries };
    });

    const newChallenge: Challenge = {
      id: newChallengeId,
      name: newChallengeName,
      data: duplicatedData,
    };

    saveUserChallengeToLocalStorage(newChallenge); // Save to localStorage

    alert(`Défi "${newChallenge.name}" créé et sauvegardé localement.`);

    // Update the challenges list in the UI
    setChallenges(prevChallenges => [...prevChallenges.filter(c => c.id !== newChallenge.id), newChallenge]); // Filter out old if exists, add new
    setSelectedChallengeId(newChallenge.id); // Select the new challenge
    setNewChallengeName(''); // Clear form
    setRepsMultiplier(1);
    setTimeToAdd(0);

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
      while (challenges.some(c => c.id === newChallengeId)) {
        newChallengeId = `${importedChallengeData.id}-${counter}`;
        counter++;
      }
      const importedChallenge: Challenge = { ...importedChallengeData, id: newChallengeId };

      saveUserChallengeToLocalStorage(importedChallenge);
      alert(`Défi "${importedChallenge.name}" importé et sauvegardé localement.`);

      setChallenges(prevChallenges => [...prevChallenges.filter(c => c.id !== importedChallenge.id), importedChallenge]);
      setSelectedChallengeId(importedChallenge.id);
      setSelectedImportFile(null); // Clear selected file
    } catch (error) {
      console.error("Error importing challenge:", error);
      alert('Erreur lors de l\'importation du défi. Assurez-vous que le fichier est un JSON valide.');
    }
  }, [selectedImportFile, challenges]);

  const handleExportChallenge = useCallback(() => {
    const challengeToExport = challenges.find(c => c.id === selectedChallengeToExportId);
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

  const handleDeleteChallenge = useCallback(() => {
    const challengeToDelete = challenges.find(c => c.id === selectedChallengeToDeleteId);
    if (!challengeToDelete) {
      alert('Défi à supprimer introuvable.');
      return;
    }

    const defaultChallengeIds = ['abdos', 'default', 'gainage', 'poids-du-corps', 'pompes', 'rapide'];
    if (defaultChallengeIds.includes(challengeToDelete.id)) { // Adjust prefix as needed
      alert('Vous ne pouvez pas supprimer les défis par défaut.');
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le défi "${challengeToDelete.name}" ?`)) {
      removeUserChallengeFromLocalStorage(challengeToDelete.id);
      alert(`Défi "${challengeToDelete.name}" supprimé.`);

      // Update challenges state
      setChallenges(prevChallenges => prevChallenges.filter(c => c.id !== challengeToDelete.id));

      // Select a new challenge if the deleted one was selected
      const remainingChallenges = challenges.filter(c => c.id !== challengeToDelete.id);
      setSelectedChallengeId(remainingChallenges[0]?.id || 'default');
    }
  }, [challenges, selectedChallengeToDeleteId]);

  // --- Render --- 
  if (challengeData.length === 0) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><Clock className="w-12 h-12 animate-spin"/></div>;
  }

  const currentChallengeName = challenges.find(c => c.id === selectedChallengeId)?.name || 'Chargement...';
  

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
                <div 
                  key={day.day} 
                  ref={(el) => dayRefs.current.set(day.day, el)}
                  className={`p-4 rounded-lg ${completedDays.has(day.day) ? 'bg-[#1A2635]' : 'bg-[#243447]'} shadow-md transition-all`}>
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
      case 'challenge-management':
        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold text-center text-[#FF6B35] mb-6">Gestion des défis</h1>

            {/* Duplicate Challenge */}
            <div className="mb-6 pb-6 border-b border-[#243447]">
              <h3 className="text-lg font-semibold text-[#EAEAEA] mb-2">Dupliquer un défi</h3>
              <label htmlFor="challenge-to-duplicate-select" className="block text-sm font-medium text-[#EAEAEA] mb-2">Défi à dupliquer</label>
              <div className="relative mb-4">
                <select id="challenge-to-duplicate-select" value={selectedChallengeToDuplicateId} onChange={e => setSelectedChallengeToDuplicateId(e.target.value)} className="w-full appearance-none bg-[#243447] border border-[#FF6B35] text-[#EAEAEA] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-[#1A2635] focus:border-[#FF6B35]">
                  {challenges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#EAEAEA]"><ChevronDown className="w-4 h-4"/></div>
              </div>

              <label htmlFor="new-challenge-name" className="block text-sm font-medium text-[#EAEAEA] mb-2">Nom du nouveau défi</label>
              <input type="text" id="new-challenge-name" value={newChallengeName} onChange={e => setNewChallengeName(e.target.value)} className="w-full bg-[#243447] border border-[#FF6B35] text-[#EAEAEA] py-2 px-3 rounded-lg focus:outline-none focus:bg-[#1A2635] focus:border-[#FF6B35] mb-4" placeholder="Ex: Mon défi personnalisé"/>

              <label htmlFor="reps-multiplier" className="block text-sm font-medium text-[#EAEAEA] mb-2">Multiplicateur de répétitions (ex: 1.2 pour +20%)</label>
              <input type="number" id="reps-multiplier" value={repsMultiplier} onChange={e => setRepsMultiplier(parseFloat(e.target.value))} step="0.1" className="w-full bg-[#243447] border border-[#FF6B35] text-[#EAEAEA] py-2 px-3 rounded-lg focus:outline-none focus:bg-[#1A2635] focus:border-[#FF6B35] mb-4"/>

              <label htmlFor="time-add" className="block text-sm font-medium text-[#EAEAEA] mb-2">Temps à ajouter (en secondes, ex: 10)</label>
              <input type="number" id="time-add" value={timeToAdd} onChange={e => setTimeToAdd(parseInt(e.target.value))} step="1" className="w-full bg-[#243447] border border-[#FF6B35] text-[#EAEAEA] py-2 px-3 rounded-lg focus:outline-none focus:bg-[#1A2635] focus:border-[#FF6B35] mb-6"/>

              <button onClick={handleDuplicateChallenge} className="flex items-center justify-center gap-2 bg-[#06D6A0] text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-[#05B88A] transition-transform hover:scale-105 w-full">
                Dupliquer le défi
              </button>
            </div>

            {/* Import/Export Challenge */}
            <div className="mb-6 pb-6 border-b border-[#243447]">
              <h3 className="text-lg font-semibold text-[#EAEAEA] mb-2">Importer / Exporter un défi</h3>
              <input type="file" accept=".json" onChange={handleImportChallengeFile} className="block w-full text-sm text-[#EAEAEA] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#243447] file:text-[#FF6B35] hover:file:bg-[#1A2635] mb-4"/>
              <button onClick={handleImportChallenge} className="flex items-center justify-center gap-2 bg-[#06D6A0] text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-[#05B88A] transition-transform hover:scale-105 w-full mb-4">
                Importer le défi
              </button>
              <label htmlFor="challenge-to-export-select" className="block text-sm font-medium text-[#EAEAEA] mb-2">Défi à exporter</label>
              <div className="relative mb-4">
                <select id="challenge-to-export-select" value={selectedChallengeToExportId} onChange={e => setSelectedChallengeToExportId(e.target.value)} className="w-full appearance-none bg-[#243447] border border-[#FF6B35] text-[#EAEAEA] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-[#1A2635] focus:focus:border-[#FF6B35]">
                  {challenges.filter(c => !c.id.startsWith('default')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#EAEAEA]"><ChevronDown className="w-4 h-4"/></div>
              </div>
              <button onClick={handleExportChallenge} className="flex items-center justify-center gap-2 bg-[#06D6A0] text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-[#05B88A] transition-transform hover:scale-105 w-full">
                Exporter le défi
              </button>
            </div>

            {/* Delete Challenge */}
            <div>
              <h3 className="text-lg font-semibold text-[#EAEAEA] mb-2">Supprimer un défi</h3>
              <label htmlFor="challenge-to-delete-select" className="block text-sm font-medium text-[#EAEAEA] mb-2">Défi à supprimer</label>
              <div className="relative mb-4">
                <select id="challenge-to-delete-select" value={selectedChallengeToDeleteId} onChange={e => setSelectedChallengeToToDeleteId(e.target.value)} className="w-full appearance-none bg-[#243447] border border-[#FF6B35] text-[#EAEAEA] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-[#1A2635] focus:border-[#FF6B35]">
                  {challenges.filter(c => !c.id.startsWith('default')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#EAEAEA]"><ChevronDown className="w-4 h-4"/></div>
              </div>
              <button onClick={handleDeleteChallenge} className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-red-700 transition-transform hover:scale-105 w-full">
                Supprimer le défi
              </button>
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
        <button onClick={() => setActiveTab('challenge-management')} className={`flex flex-col items-center justify-center p-2 w-full ${activeTab === 'challenge-management' ? 'text-red-600' : 'text-[#EAEAEA]'}`}>
          <ListTodo />
          <span className="text-xs">Défis</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
