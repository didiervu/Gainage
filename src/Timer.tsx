

import React from 'react';
import { Play, Check } from 'lucide-react';

interface TimerProps {
  day: DayData;
  timerState: TimerState;
  countdownState: CountdownState;
  countdownTime: number;
  timeLeft: number;
  startWorkout: () => void;
  resetTimer: () => void;
  setSelectedDay: (day: DayData | null) => void;
  formatTime: (seconds: number) => string;
  getTimerTitle: () => string;
  getTimerColor: () => string;
  getProgressPercentage: () => number;
}

const Timer: React.FC<TimerProps> = ({ 
  day,
  timerState,
  countdownState,
  countdownTime,
  timeLeft,
  startWorkout,
  resetTimer,
  setSelectedDay,
  formatTime,
  getTimerTitle,
  getTimerColor,
  getProgressPercentage
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-3xl font-bold text-gray-800 mb-2">JOUR {day.day}</h3>
        <div className="flex justify-center gap-6 text-sm">
          <div className="bg-blue-50 px-4 py-2 rounded-lg">
            <p className="font-semibold text-blue-800">GAINAGE MAIN</p>
            <p className="text-blue-600">{day.gm}"</p>
          </div>
          <div className="bg-red-50 px-4 py-2 rounded-lg">
            <p className="font-semibold text-red-800">GAINAGE COUDE</p>
            <p className="text-red-600">{day.gc}"</p>
          </div>
        </div>
      </div>

      {(timerState !== 'idle' || countdownState) && (
        <div className="space-y-4">
          {/* Barre de progression */}
          <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-1000"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>

          {/* Timer principal */}
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
                <p className="text-green-800 font-semibold">Jour {day.day} terminé !</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Boutons de contrôle */}
      <div className="flex gap-3 justify-center">
        {timerState === 'idle' && !countdownState && (
          <button
            onClick={startWorkout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
            aria-label="Commencer l'entraînement"
          >
            <Play className="w-5 h-5" />
            Commencer
          </button>
        )}
        
        {(timerState !== 'idle' || countdownState) && timerState !== 'completed' && (
          <button
            onClick={resetTimer}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
            aria-label="Arrêter l'entraînement"
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
            aria-label="Retour au calendrier"
          >
            Retour au calendrier
          </button>
        )}
        
        {/* Bouton de test du son */}
        <button
          onClick={() => {
            // initAudioContext();
            // playBeep();
          }}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
          title="Tester le son"
          aria-label="Tester le son"
        >
          🔊 Test
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600">
          <strong>Note:</strong> 30 secondes de récupération entre les exercices. 
          Cliquez sur "🔊 Test\" pour vérifier que le son fonctionne.
        </p>
      </div>
    </div>
  );
}

export default Timer;
