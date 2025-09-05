import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { DayData } from "./types";
import { Play, Pause, RotateCcw, Check, FastForward } from "lucide-react";

export interface TimerViewHandles {
  startWorkout: () => void;
}

interface TimerViewProps {
  selectedDay: DayData | null;
  restTime: number;
  onWorkoutComplete: (dayNumber: number, maxTime?: number) => void;
  playBeep: () => void;
}

const PREP_TIME = 3; // Seconds for preparation countdown

export const TimerView = forwardRef<TimerViewHandles, TimerViewProps>(
  ({ selectedDay, restTime, onWorkoutComplete, playBeep }, ref) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [currentSeriesIndex, setCurrentSeriesIndex] = useState(0);
    const [currentRep, setCurrentRep] = useState(0);
    const [phase, setPhase] = useState<"idle" | "prep" | "work" | "rest" | "done" | "max">("idle");
    const [maxTime, setMaxTime] = useState(0);
    const [dayMaxRecord, setDayMaxRecord] = useState<number | undefined>(undefined);

    const timerRef = useRef<number | null>(null);

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

    const resetTimer = useCallback(() => {
      clearInterval(timerRef.current!);
      timerRef.current = null;
      setTimeLeft(0);
      setIsRunning(false);
      setCurrentSeriesIndex(0);
      setCurrentRep(0);
      setPhase("idle");
      setMaxTime(0);
      setDayMaxRecord(undefined);
    }, []);

    useEffect(() => {
      resetTimer();
      if (selectedDay?.type === "repos") {
        setPhase("done");
      }
    }, [selectedDay, resetTimer]);

    useEffect(() => {
      if (!isRunning || phase === "idle" || phase === "done" || !selectedDay) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        return;
      }

      timerRef.current = window.setInterval(() => {
        if (phase === "max") {
          setMaxTime((m) => m + 1);
          return;
        }

        setTimeLeft((prevTime) => {
          if (prevTime > 1) {
            if (phase === 'prep' && prevTime <= PREP_TIME + 1) playBeep();
            return prevTime - 1;
          }

          clearInterval(timerRef.current!);
          timerRef.current = null;
          playBeep(); // Final beep for phase transition

          if (phase === "prep") {
            const currentSeries = selectedDay.series![currentSeriesIndex];
            if (currentSeries.isMax) {
              setPhase("max");
              setMaxTime(0);
            } else {
              setPhase("work");
              setTimeLeft(currentSeries.time || 0);
            }
            setIsRunning(true);
          } else if (phase === "work") {
            if (selectedDay.series && currentSeriesIndex + 1 < selectedDay.series.length) {
              setPhase("rest");
              setTimeLeft(restTime);
            } else {
              setPhase("done");
              setIsRunning(false);
              onWorkoutComplete(selectedDay.day, dayMaxRecord);
            }
          } else if (phase === "rest") {
            const nextSeriesIndex = currentSeriesIndex + 1;
            setCurrentSeriesIndex(nextSeriesIndex);
            setPhase("prep");
            setTimeLeft(PREP_TIME);
            setIsRunning(true);
          }
          return 0;
        });
      }, 1000);

      return () => {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      };
    }, [isRunning, phase, currentSeriesIndex, selectedDay, restTime, onWorkoutComplete, playBeep, dayMaxRecord]);

    const handleStartWorkout = useCallback(() => {
      if (!selectedDay || (selectedDay.type !== 'max' && (!selectedDay.series || selectedDay.series.length === 0))) return;
      
      setCurrentSeriesIndex(0);
      setCurrentRep(0);
      setPhase("prep");
      setTimeLeft(PREP_TIME);
      setIsRunning(true);
    }, [selectedDay]);

    useImperativeHandle(ref, () => ({
      startWorkout: handleStartWorkout,
    }));

    const handlePause = () => setIsRunning(false);
    const handleResume = () => setIsRunning(true);
    const handleReset = () => resetTimer();

    const handleCompleteMax = () => {
      setIsRunning(false);
      setDayMaxRecord(prev => (prev === undefined || maxTime > prev ? maxTime : prev));
      if (selectedDay && selectedDay.series?.length && currentSeriesIndex + 1 < selectedDay.series.length) {
        setPhase("rest");
        setTimeLeft(restTime);
        setIsRunning(true);
      } else if (selectedDay) {
        setPhase("done");
        onWorkoutComplete(selectedDay.day, maxTime);
      }
    };

    const handleSkipRest = () => {
      if (phase === "rest" && selectedDay && selectedDay.series) {
        playBeep();
        const nextSeriesIndex = currentSeriesIndex + 1;
        if (nextSeriesIndex < selectedDay.series.length) {
          setCurrentSeriesIndex(nextSeriesIndex);
          setPhase("prep");
          setTimeLeft(PREP_TIME);
          setIsRunning(true);
        } else {
          setPhase("done");
          onWorkoutComplete(selectedDay.day, dayMaxRecord);
          setIsRunning(false);
        }
      }
    };

    const currentSeriesInfo = selectedDay?.series?.[currentSeriesIndex];
    const getTitle = () => {
        if (phase === 'prep') return 'Préparez-vous...';
        if (phase === 'work') return currentSeriesInfo?.name || 'Exercice';
        if (phase === 'rest') return 'Récupération';
        if (phase === 'max') return currentSeriesInfo?.name || 'Max';
        if (currentSeriesInfo?.reps && currentSeriesInfo.reps > 1) return `Répétition ${currentRep + 1} / ${currentSeriesInfo.reps}`;
        return `Série ${currentSeriesIndex + 1} / ${selectedDay?.series?.length}`;
    };

    if (!selectedDay) {
      return <div className="text-center text-gray-500">Sélectionnez un jour pour commencer</div>;
    }

    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          JOUR {selectedDay.day}
        </h2>

        {selectedDay.type === "repos" ? (
          <p className="text-gray-500">Repos aujourd'hui !</p>
        ) : (
          <div>
            {phase === "done" ? (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-semibold">Jour {selectedDay.day} terminé !</p>
              </div>
            ) : (
              <>
                <p className="text-lg text-gray-600 mb-2 h-6">
                  {phase !== 'idle' && phase !== 'done' && phase !== 'prep' && `Série ${currentSeriesIndex + 1} / ${selectedDay.series?.length || 1}`}
                </p>
                <p className="text-xl font-bold text-gray-800 mb-4 h-7">
                  {phase !== 'idle' && phase !== 'done' && getTitle()}
                </p>

                <p className={`font-mono mb-4 transition-all duration-300 ${phase === 'prep' ? 'text-red-600 text-7xl md:text-8xl' : 'text-gray-800 text-4xl'}`}>
                  {phase === "max" ? formatTime(maxTime) : formatTime(timeLeft)}
                </p>

                <div className="h-6 mb-4">
                  {phase === 'prep' && currentSeriesInfo && (
                    <p className="text-lg text-gray-500">
                        À suivre: {currentSeriesInfo.time}s {currentSeriesInfo.name || ''}
                    </p>
                  )}
                </div>

                <div className="flex justify-center gap-4">
                  {!isRunning && phase !== "done" && phase === 'idle' && (
                    <button
                      onClick={handleStartWorkout}
                      className="p-3 bg-green-500 text-white rounded-full shadow"
                    >
                      <Play />
                    </button>
                  )}
                  {!isRunning && phase !== "done" && phase !== 'idle' && (
                     <button onClick={handleResume} className="p-3 bg-green-500 text-white rounded-full shadow"><Play /></button>
                  )}
                  {isRunning && phase !== "max" && (
                    <button
                      onClick={handlePause}
                      className="p-3 bg-yellow-500 text-white rounded-full shadow"
                    >
                      <Pause />
                    </button>
                  )}
                  {phase !== "done" && phase !== 'idle' && (
                    <button
                      onClick={handleReset}
                      className="p-3 bg-gray-500 text-white rounded-full shadow"
                    >
                      <RotateCcw />
                    </button>
                  )}
                  {phase === "max" && (
                    <button
                      onClick={handleCompleteMax}
                      className="p-3 bg-blue-500 text-white rounded-full shadow"
                    >
                      <Check />
                    </button>
                  )}
                  {phase === "rest" && (
                    <button
                      onClick={handleSkipRest}
                      className="p-3 bg-purple-500 text-white rounded-full shadow"
                      title="Passer la récupération"
                    >
                      <FastForward />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);
