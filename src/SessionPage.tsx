import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { getChallenges } from './challengeLoader';
import { Challenge } from './types';
import { SynchronizedTimer } from './SynchronizedTimer';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const USERNAME_KEY = 'gainage-userName';

// --- Types ---
type TimerState = 'running' | 'rest' | 'paused' | 'finished' | 'preparation';

interface Participant {
  id: string; // socket.id
  name: string;
}

interface WorkoutState {
  currentDayIndex: number;
  currentSeriesIndex: number;
  timerState: TimerState;
  timerStartTime: number;
  timerDuration: number;
}

interface SessionState {
  participants: Participant[];
  challengeId?: string;
  challenge?: Challenge;
  workoutState?: WorkoutState;
}

// --- Composant ---
export const SessionPage: React.FC = () => {
  console.log('SessionPage: Rendu');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [isHost, setIsHost] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  
  const [userName, setUserName] = useState(() => localStorage.getItem(USERNAME_KEY) || '');
  const [isNameSet, setIsNameSet] = useState(() => !!localStorage.getItem(USERNAME_KEY));
  const [inputName, setInputName] = useState('');

  // --- Connexion et gestion de la session ---
  useEffect(() => {
    if (!isNameSet || !sessionId) return;

    console.log('SessionPage: Tentative de connexion socket');
    console.log('Connexion au serveur à l\'adresse :', SERVER_URL);
    const newSocket = io(SERVER_URL, {
      timeout: 60000, // 60 secondes de délai
      reconnection: false, // On gère l'erreur nous-mêmes
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connecté !');
      setServerStatus('connected');
      newSocket.emit('join-session', { sessionId, name: userName });
    });

    newSocket.on('connect_error', (err) => {
      console.error('Erreur de connexion socket:', err.message);
      setServerStatus('error');
      newSocket.disconnect();
    });

    newSocket.on('session-joined', ({ isHost }) => setIsHost(isHost));
    newSocket.on('session-update', (state: SessionState) => {
      console.log('SessionPage: session-update reçu', state);
      setSessionState(state);
    });
    
    return () => { 
      console.log('SessionPage: Nettoyage socket');
      newSocket.disconnect(); 
    };
  }, [sessionId, isNameSet, userName]);

  // --- Chargement des défis (pour l'hôte) ---
  useEffect(() => {
    if (isHost) {
      console.log('SessionPage: Chargement des défis');
      getChallenges().then(setAllChallenges);
    }
  }, [isHost]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      setUserName(inputName.trim());
      localStorage.setItem(USERNAME_KEY, inputName.trim());
      setIsNameSet(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  const handleSelectChallenge = (challengeId: string) => {
    socket?.emit('select-challenge', { sessionId, challengeId });
  };

  const handleStartWorkout = () => {
    socket?.emit('start-workout', { sessionId });
  };

  const handleLeaveSession = () => {
    socket?.disconnect();
    navigate('/');
  };

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

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

  const handleTimerComplete = useCallback(() => {
    // Le serveur est le seul maître du temps, donc le client n'a rien à faire ici.
    // On pourrait jouer un son de fin d'exercice si on le souhaitait.
  }, []);

  // --- Rendu du composant ---

  if (!isNameSet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleNameSubmit} className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Quel est votre nom ?</h1>
          <input 
            type="text"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Entrez votre nom..."
            autoFocus
          />
          <button type="submit" className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">
            Rejoindre la session
          </button>
        </form>
      </div>
    );
  }

  if (serverStatus === 'connecting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Connexion au serveur...</h1>
        <p className="text-lg text-gray-600">Le démarrage du serveur peut prendre jusqu'à une minute.</p>
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mt-8"></div>
      </div>
    );
  }

  if (serverStatus === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Erreur de connexion</h1>
        <p className="text-lg text-gray-600">Impossible de se connecter au serveur.<br/>Veuillez réessayer en rafraîchissant la page.</p>
      </div>
    );
  }

  // Logique de rendu principale
  let mainContent = null;

  if (!sessionState) {
    mainContent = <p>En attente des informations de la session...</p>;
  } else if (!sessionState.challenge) {
    if (isHost) {
      mainContent = (
        <div>
          <h2 className="text-xl font-semibold mb-4">Choisissez un défi</h2>
          <div className="grid grid-cols-2 gap-4">
            {allChallenges.map(c => (
              <button key={c.id} onClick={() => handleSelectChallenge(c.id)} className="p-4 bg-white rounded-lg shadow-md hover:bg-gray-100">
                {c.name}
              </button>
            ))}
          </div>
        </div>
      );
    } else {
      mainContent = <p>En attente de l'hôte pour choisir un défi...</p>;
    }
  } else if (!sessionState.workoutState) {
    const firstDay = sessionState.challenge?.data[0];
    const firstSeriesEntry = firstDay?.series?.[0];

    mainContent = (
      <div className="text-center p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-text mb-2">Défi: {sessionState.challenge.name}</h2>
        {firstSeriesEntry ? (
          <>
            <p className="text-lg text-muted mb-4">Prochain exercice:</p>
            <p className="text-2xl font-bold text-accent">{firstSeriesEntry.name}</p>
            {firstSeriesEntry.repetitions && <p className="text-xl text-text">{firstSeriesEntry.repetitions} répétitions</p>}
            {firstSeriesEntry.time && <p className="text-xl text-text">{firstSeriesEntry.time} secondes</p>}
          </>
        ) : (
          <p className="text-lg text-muted">Aucun exercice défini pour le premier jour.</p>
        )}
        <p className="text-muted mt-4">L'entraînement commencera bientôt...</p>
        {isHost &&
          <button onClick={handleStartWorkout} className="mt-4 bg-accent text-white font-bold py-3 px-5 rounded-full shadow-lg hover:bg-[#059669] transition-transform hover:scale-105">
            Démarrer l'entraînement
          </button>
        }
      </div>
    );
  } else if (sessionState.workoutState.timerState === 'preparation') {
    const firstDay = sessionState.challenge?.data[0];
    const firstSeriesEntry = firstDay?.series?.[0];

    mainContent = (
      <div className="text-center p-4 bg-card rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-text mb-2">Défi: {sessionState.challenge.name}</h2>
        <h3 className="text-3xl font-bold text-yellow-500 mb-4">Préparation...</h3>
        {firstSeriesEntry ? (
          <>
            <p className="text-lg text-muted mb-2">Prochain exercice:</p>
            <p className="text-2xl font-bold text-accent">{firstSeriesEntry.name}</p>
            {firstSeriesEntry.repetitions && <p className="text-xl text-text">{firstSeriesEntry.repetitions} répétitions</p>}
            {firstSeriesEntry.time && <p className="text-xl text-text">{firstSeriesEntry.time} secondes</p>}
          </>
        ) : (
          <p className="text-lg text-muted">Aucun exercice défini pour le premier jour.</p>
        )}
        <SynchronizedTimer
          key={`preparation-${sessionState.workoutState.timerStartTime}`}
          startTime={sessionState.workoutState.timerStartTime}
          duration={sessionState.workoutState.timerDuration}
          onComplete={handleTimerComplete}
          playBeep={playBeep}
        />
      </div>
    );
  } else if (sessionState.workoutState.timerState === 'finished') {
    mainContent = (
      <div>
        <h2 className="text-2xl font-bold text-green-500">Félicitations !</h2>
        <p>Vous avez terminé la session.</p>
      </div>
    );
  } else {
    const currentDay = sessionState.challenge.data[sessionState.workoutState.currentDayIndex];
    const currentSeries = currentDay.series?.[sessionState.workoutState.currentSeriesIndex];

        const getNextAction = (currentWorkoutState: WorkoutState, challenge: Challenge): string => {
          const { currentDayIndex, currentSeriesIndex, timerState } = currentWorkoutState;
          const currentDay = challenge.data[currentDayIndex];
    
          if (timerState === 'rest') {
            // Si nous sommes en repos, la prochaine action est le prochain exercice de la série actuelle
            const nextSeriesIndex = currentSeriesIndex + 1;
            if (currentDay.series && nextSeriesIndex < currentDay.series.length) {
              return `Exercice: ${currentDay.series[nextSeriesIndex].name}`;
            } else {
              // Si c'est la fin de la série, la prochaine action est le repos du jour suivant ou la fin
              const nextDayIndex = currentDayIndex + 1;
              if (nextDayIndex < challenge.data.length) {
                return `Jour ${challenge.data[nextDayIndex].day} (Repos)`;
              } else {
                                  return 'Fin de l\'entraînement';              }
            }
          } else if (timerState === 'running') {
            // Si nous sommes en train de courir un exercice, la prochaine action est le repos
            return 'Repos';
          }
          return ''; // Ne devrait pas arriver pour ces états
        };
    
        const nextAction = getNextAction(sessionState.workoutState, sessionState.challenge);
    
        mainContent = (
          <div>
            <h2 className="text-xl font-semibold">{sessionState.challenge.name} - Jour {currentDay.day}</h2>
            {sessionState.workoutState.timerState === 'rest' ? (
              <h3 className="text-3xl font-bold text-blue-500">Repos</h3>
            ) : (
              <h3 className="text-lg">Exercice: {currentSeries?.name || ''}</h3>
            )}
            {nextAction && (
              <p className="text-md text-gray-600 mt-2">Prochaine action: {nextAction}</p>
            )}
            <SynchronizedTimer
              key={`${sessionState.workoutState.currentDayIndex}-${sessionState.workoutState.currentSeriesIndex}-${sessionState.workoutState.timerState}`}
              startTime={sessionState.workoutState.timerStartTime}
              duration={sessionState.workoutState.timerDuration}
              onComplete={handleTimerComplete}
              playBeep={playBeep}
            />
          </div>
        );  }

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
        <h1 className="text-2xl font-bold truncate max-w-full sm:max-w-md text-center sm:text-left text-[#1F2937]">Session: {sessionId}</h1>
        <div className="flex justify-center sm:justify-end space-x-2 w-full sm:w-auto">
          <button onClick={handleCopyLink} className={`w-full sm:w-auto flex items-center justify-center gap-2 ${isCopied ? 'bg-accent' : 'bg-blue-500'} text-white font-bold py-3 px-5 rounded-full shadow-lg hover:bg-blue-600 transition-transform hover:scale-105`}>
            {isCopied ? 'Lien copié !' : 'Copier le lien'}
          </button>
          <button onClick={handleLeaveSession} className={`w-full sm:w-auto flex items-center justify-center gap-2 bg-danger text-white font-bold py-3 px-5 rounded-full shadow-lg hover:bg-red-600 transition-transform hover:scale-105`}>
            Quitter
          </button>
        </div>
      </div>
      
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-bold mb-2">Participants ({sessionState?.participants.length || 0})</h3>
        <ul>
          {sessionState?.participants.map(p => (
            <li key={p.id} className="text-sm">{p.name}</li>
          ))}
        </ul>
      </div>

      {mainContent}
    </div>
  );
};