import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { DayData } from "./types";
import { Play, Pause, RotateCcw, Check, FastForward, X } from "lucide-react";

export interface TimerViewHandles {
  startWorkout: () => void;
  stopWorkout: () => void;
}

interface TimerViewProps {
  selectedDay: DayData | null;
  restTime: number;
  onWorkoutComplete: (dayNumber: number, maxTime?: number) => void;
  playBeep: () => void;
  onClose: () => void;
}

const PREP_TIME = 3;

export const TimerView = forwardRef<TimerViewHandles, TimerViewProps>(
  ({ selectedDay, restTime, onWorkoutComplete, playBeep, onClose }, ref) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [currentSeriesIndex, setCurrentSeriesIndex] = useState(0);
    const [currentRep, setCurrentRep] = useState(0);
    const [phase, setPhase] = useState<"idle" | "prep" | "work" | "rest" | "done" | "max" | "reps_manual">("idle");
    const [maxTime, setMaxTime] = useState(0);
    const [dayMaxRecord, setDayMaxRecord] = useState<number | undefined>(undefined);

    

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    const resetTimer = useCallback(() => {
      setTimeLeft(0);
      setIsRunning(false);
      setCurrentSeriesIndex(0);
      setCurrentRep(0);
      setPhase("idle");
      setMaxTime(0);
      setDayMaxRecord(undefined);
    }, []);

    const moveToNextSeries = useCallback(() => {
        if (!selectedDay) return;
        setCurrentRep(0);
        const nextSeriesIndex = currentSeriesIndex + 1;
        if (selectedDay.series && nextSeriesIndex < selectedDay.series.length) {
            setCurrentSeriesIndex(nextSeriesIndex);
            setPhase("rest");
            setTimeLeft(restTime);
            setIsRunning(true);
        } else {
            setPhase("done");
            setIsRunning(false);
            onWorkoutComplete(selectedDay.day, dayMaxRecord);
        }
    }, [selectedDay, currentSeriesIndex, restTime, onWorkoutComplete, dayMaxRecord]);

    useEffect(() => {
      resetTimer();
      if (selectedDay?.type === "repos") {
        setPhase("done");
      }
    }, [selectedDay, resetTimer]);

    useEffect(() => {
        if (!isRunning || phase === 'idle' || phase === 'done' || phase === 'reps_manual' || !selectedDay) {
            return; // Timer is stopped, do nothing.
        }

        // Handle "max" phase separately as it's an incrementing stopwatch
        if (phase === 'max') {
            const interval = setInterval(() => setMaxTime(m => m + 1), 1000);
            return () => clearInterval(interval);
        }

        // --- Countdown Logic ---
        if (timeLeft <= 0) { // Timer reached zero, transition to the next phase
            playBeep();

            if (phase === 'prep') {
                const currentSeries = selectedDay.series![currentSeriesIndex];
                if (currentSeries.isMax) {
                    setPhase('max');
                } else if (currentSeries.time) {
                    setPhase('work');
                    setTimeLeft(currentSeries.time);
                } else {
                    setPhase('reps_manual');
                    setIsRunning(false);
                }
            } else if (phase === 'work') {
                const currentSeries = selectedDay.series![currentSeriesIndex];
                if (currentSeries.reps && currentRep < currentSeries.reps - 1) {
                    setCurrentRep(r => r + 1);
                    setPhase('rest');
                    setTimeLeft(restTime);
                } else {
                    moveToNextSeries();
                }
            } else if (phase === 'rest') {
                setPhase('prep');
                setTimeLeft(PREP_TIME);
            }
            return; // End of transition logic for this render
        }

        // --- Decrement Logic ---
        const timeout = setTimeout(() => {
            // Beep on the last 3 seconds of prep
            if (phase === 'prep' && timeLeft > 0 && timeLeft <= PREP_TIME) {
                playBeep();
            }
            setTimeLeft(timeLeft - 1);
        }, 1000);

        // Cleanup function
        return () => clearTimeout(timeout);

    }, [isRunning, phase, timeLeft, selectedDay, currentSeriesIndex, currentRep, moveToNextSeries, playBeep, setMaxTime, restTime]);

    const handleStartWorkout = useCallback(() => {
      if (!selectedDay || (selectedDay.type !== 'max' && (!selectedDay.series || selectedDay.series.length === 0))) return;
      setCurrentSeriesIndex(0);
      setCurrentRep(0);
      setPhase("prep");
      setTimeLeft(PREP_TIME);
      setIsRunning(true);
    }, [selectedDay]);

    useImperativeHandle(ref, () => ({ startWorkout: handleStartWorkout, stopWorkout: resetTimer }));

    const handleManualRepComplete = () => moveToNextSeries();
    const handlePause = () => setIsRunning(false);
    const handleResume = () => setIsRunning(true);
    const handleReset = () => resetTimer();
    const handleCompleteMax = () => {
      setIsRunning(false);
      setDayMaxRecord(prev => (prev === undefined || maxTime > prev ? maxTime : prev));
      moveToNextSeries();
    };

    const handleSkipRest = () => {
      if (phase === "rest") {
        playBeep();
        setPhase("prep");
        setTimeLeft(PREP_TIME);
        setIsRunning(true);
      }
    };

    const currentSeriesInfo = selectedDay?.series?.[currentSeriesIndex];
    const getTitle = () => {
        if (phase === 'prep') return 'Préparez-vous...';
        if (phase === 'work' || phase === 'reps_manual') return currentSeriesInfo?.name || 'Exercice';
        if (phase === 'rest') return 'Récupération';
        if (phase === 'max') return currentSeriesInfo?.name || 'Max';
        return `Série ${currentSeriesIndex + 1} / ${selectedDay?.series?.length}`;
    };
    
    const getSubtitle = () => {
        if (phase === 'idle' || phase === 'done' || phase === 'prep' || phase === 'max') return '';
        if (currentSeriesInfo?.reps && currentSeriesInfo.reps > 1 && currentSeriesInfo.time) {
            return `Série ${currentRep + 1} / ${currentSeriesInfo.reps}`;
        }
        return `Série ${currentSeriesIndex + 1} / ${selectedDay?.series?.length || 1}`;
    }

    if (!selectedDay) return null;

    const renderContent = () => {
        if (phase === "done") {
            return (
                <div className="mt-4 p-4">
                    <Check className="w-16 h-16 text-[#06D6A0] mx-auto mb-4" />
                    <p className="text-2xl text-[#06D6A0] font-semibold">Jour {selectedDay.day} terminé !</p>
                    <p className="text-[#EAEAEA] mt-4">Félicitations !</p>
                    <button onClick={onClose} className="mt-6 bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Fermer</button>
                </div>
            );
        }

        if (phase === "reps_manual" && currentSeriesInfo) {
            return (
                <>
                    <p className="text-xl text-[#EAEAEA] mb-2 h-7">{getSubtitle()}</p>
                    <p className="text-2xl font-bold text-[#FF6B35] mb-4 h-8">{getTitle()}</p>
                    <p className="font-mono my-4 text-[#EAEAEA] text-7xl md:text-8xl">{currentSeriesInfo.reps}x</p>
                    <div className="h-8 mb-4"></div>
                    <div className="flex justify-center items-center gap-4">
                        <button onClick={handleManualRepComplete} className="w-32 h-16 bg-green-500 text-white rounded-lg flex items-center justify-center shadow-lg text-xl font-bold">Terminé</button>
                        <button onClick={handleReset} className="w-16 h-16 bg-[#243447] text-white rounded-full flex items-center justify-center shadow-md"><RotateCcw size={32}/></button>
                    </div>
                </>
            );
        }

        return (
            <>
                <p className="text-xl text-[#EAEAEA] mb-2 h-7">{getSubtitle()}</p>
                <p className="text-2xl font-bold text-[#FF6B35] mb-4 h-8">{getTitle()}</p>
                <p className={`font-mono my-4 transition-all duration-300 ${phase === 'prep' ? 'text-[#FF6B35] text-8xl md:text-9xl' : 'text-[#EAEAEA] text-7xl md:text-8xl'}`}>
                    {phase === "max" ? formatTime(maxTime) : formatTime(timeLeft)}
                </p>
                <div className="h-8 mb-4">
                  {phase === 'prep' && currentSeriesInfo && (
                    <p className="text-xl text-[#EAEAEA]">
                        À suivre: {currentSeriesInfo.time ? `${currentSeriesInfo.time}s` : ''} {currentSeriesInfo.name || ''}
                    </p>
                  )}
                </div>
                <div className="flex justify-center items-center gap-4">
                  {!isRunning && phase !== "done" && phase === 'idle' && (
                    <button onClick={handleStartWorkout} className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg"><Play size={40} className="ml-1"/></button>
                  )}
                  {!isRunning && phase !== "done" && phase !== 'idle' && (
                     <button onClick={handleResume} className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg"><Play size={40} className="ml-1"/></button>
                  )}
                  {isRunning && phase !== "max" && (
                    <button onClick={handlePause} className="w-20 h-20 bg-yellow-500 text-white rounded-full flex items-center justify-center shadow-lg"><Pause size={40} /></button>
                  )}
                  {phase !== "done" && phase !== 'idle' && (
                    <button onClick={handleReset} className="w-16 h-16 bg-[#243447] text-white rounded-full flex items-center justify-center shadow-md"><RotateCcw size={32}/></button>
                  )}
                  {phase === "max" && (
                    <button onClick={handleCompleteMax} className="w-20 h-20 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg"><Check size={40}/></button>
                  )}
                  {phase === "rest" && (
                    <button onClick={handleSkipRest} className="w-16 h-16 bg-purple-500 text-white rounded-full flex items-center justify-center shadow-md" title="Passer la récupération"><FastForward size={32}/></button>
                  )}
                </div>
            </>
        );
    }

    return (
      <div className="relative text-center p-4 h-full flex flex-col justify-center bg-[#243447]">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#EAEAEA] hover:text-[#FF6B35] transition-colors"><X size={28} /></button>
        <h2 className="text-2xl font-bold text-[#FF6B35] mb-4">JOUR {selectedDay.day}</h2>
        {selectedDay.type === "repos" ? <p className="text-[#EAEAEA]">Repos aujourd'hui !</p> : <div className="flex-grow flex flex-col justify-center">{renderContent()}</div>}
      </div>
    );
  }
);