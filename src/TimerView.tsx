import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { DayData, SeriesEntry } from "./types";
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

export const TimerView = forwardRef<TimerViewHandles, TimerViewProps>((
  {
    selectedDay,
    restTime,
    onWorkoutComplete,
    playBeep,
  },
  ref
) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSeriesIndex, setCurrentSeriesIndex] = useState(0);
  const [currentRep, setCurrentRep] = useState(0); // New state for current repetition
  const [phase, setPhase] = useState<"idle" | "work" | "rest" | "done" | "max">("idle");
  const [maxTime, setMaxTime] = useState(0);
  const [dayMaxRecord, setDayMaxRecord] = useState<number | undefined>(undefined);

  const timerRef = useRef<number | null>(null);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current!); // Clear any running interval
    timerRef.current = null;
    setTimeLeft(0);
    setIsRunning(false);
    setCurrentSeriesIndex(0);
    setCurrentRep(0); // Reset currentRep
    setPhase("idle");
    setMaxTime(0);
    setDayMaxRecord(undefined);
  }, []);

  // (Re)initialise le timer à chaque changement de jour
  useEffect(() => {
    resetTimer(); // Always reset when selectedDay changes

    if (!selectedDay) {
      return;
    }

    if (selectedDay.type === "repos") {
      setPhase("done");
      return;
    }

    if (selectedDay.type === "max") {
      setPhase("max");
      // Do NOT start running automatically, wait for explicit start
      return;
    }

    if (selectedDay.series && selectedDay.series.length > 0) {
      setPhase("work");
      setCurrentSeriesIndex(0); // Ensure this is reset
      setCurrentRep(0); // Initialize currentRep
      setTimeLeft(selectedDay.series[0].time || 0);
      // Do NOT start running automatically, wait for explicit start
      return;
    }

    // Fallback for days with no specific type or series (should not happen with unified JSON)
    setPhase("idle");
  }, [selectedDay, resetTimer]);

  // Timer principal
  useEffect(() => {
    if (!isRunning || phase === "idle" || phase === "done" || !selectedDay) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (phase === "max") {
      timerRef.current = window.setInterval(() => {
        setMaxTime((m) => m + 1);
      }, 1000);
    } else {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev > 0) {
            return prev - 1;
          } else {
            clearInterval(timerRef.current!); // Clear current interval
            timerRef.current = null;
            playBeep();

            const currentSeriesInfo = selectedDay.series?.[currentSeriesIndex];
            const totalRepsForCurrentSeries = currentSeriesInfo?.reps || 1; // Default to 1 if reps not specified

            if (phase === "work") {
              // Work phase is over. Check if it was the last one.
              if (selectedDay.series && currentSeriesIndex + 1 < selectedDay.series.length) {
                // Not the last series, so go to rest.
                // The series index will be incremented AFTER the rest.
                setPhase("rest");
                setTimeLeft(restTime);
                setIsRunning(true);
              } else {
                // This was the last series. Workout is done.
                setPhase("done");
                onWorkoutComplete(selectedDay.day, dayMaxRecord);
              }
            } else if (phase === "rest") {
              // Rest is over, move to the next series.
              const nextSeriesIndex = currentSeriesIndex + 1;
              const nextSeries = selectedDay.series![nextSeriesIndex];

              if (nextSeries.isMax) {
                setPhase("max");
                setMaxTime(0);
              } else {
                setPhase("work");
                setTimeLeft(nextSeries.time || 0);
              }
              setCurrentSeriesIndex(nextSeriesIndex);
              setCurrentRep(0);
              setIsRunning(true);
            }
            return 0; // Reset timeLeft to 0 after phase change
          }
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, phase, currentSeriesIndex, currentRep, selectedDay, restTime, onWorkoutComplete, playBeep]);

  // Function to be called from App.tsx to start the workout
  const handleStartWorkout = useCallback(() => {
    if (!selectedDay) return;

    if (selectedDay.type === "max") {
      setIsRunning(true);
    } else if (selectedDay.series && selectedDay.series.length > 0) {
      const firstSeries = selectedDay.series[0];
      if (firstSeries.isMax) {
        setPhase("max");
        setMaxTime(0);
      } else {
        setPhase("work");
        setTimeLeft(firstSeries.time || 0);
      }
      setCurrentSeriesIndex(0);
      setCurrentRep(0);
      setIsRunning(true);
    }
  }, [selectedDay, currentSeriesIndex]);

  useImperativeHandle(ref, () => ({
    startWorkout: handleStartWorkout,
  }));

  const handlePause = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleReset = () => {
    resetTimer();
    if (selectedDay) {
      if (selectedDay.type === "max") {
        setPhase("max");
      } else if (selectedDay.series && selectedDay.series.length > 0) {
        setPhase("work");
        setCurrentSeriesIndex(0);
        setCurrentRep(0); // Reset currentRep
        setTimeLeft(selectedDay.series[0].time || 0);
      }
    }
  };

  const handleCompleteMax = () => {
    setIsRunning(false); // Stop timer interval

    // Update the day's max time record if the current one is higher
    setDayMaxRecord(prevRecord => {
      if (prevRecord === undefined || maxTime > prevRecord) {
        return maxTime;
      }
      return prevRecord;
    });

    // Case 1: We are in a top-level max day workout with no series
    if (selectedDay && selectedDay.type === "max" && !selectedDay.series?.length) {
      setPhase("done");
      onWorkoutComplete(selectedDay.day, maxTime);
      return;
    }

    // Case 2: We are in any workout that has series (top-level max with series, or regular day)
    if (selectedDay && selectedDay.series?.length) {
      // Check if there are more series after this one
      if (currentSeriesIndex + 1 < selectedDay.series.length) {
        // This is a "max" series in the middle of a workout, go to rest.
        setPhase("rest");
        setTimeLeft(restTime);
        setIsRunning(true);
      } else {
        // This was the last series (even if it was a max). Workout is done.
        setPhase("done");
        onWorkoutComplete(selectedDay.day, dayMaxRecord);
      }
    }
  };

  const handleSkipRest = () => {
    if (phase === "rest" && selectedDay && selectedDay.series) {
      playBeep();
      clearInterval(timerRef.current!); // Clear current rest interval
      timerRef.current = null;

      const currentSeriesInfo = selectedDay.series[currentSeriesIndex];
      const totalRepsForCurrentSeries = currentSeriesInfo?.reps || 1;

      if (currentRep + 1 < totalRepsForCurrentSeries) {
        // More reps in current series
        setCurrentRep((prevRep) => prevRep + 1);
        setPhase("work");
        setTimeLeft(currentSeriesInfo.time || 0);
        setIsRunning(true);
      } else if (currentSeriesIndex + 1 < selectedDay.series.length) {
        // Move to next series
        setCurrentSeriesIndex((prevIndex) => prevIndex + 1);
        setCurrentRep(0); // Reset rep for new series
        setPhase("work");
        setTimeLeft(selectedDay.series[currentSeriesIndex + 1].time || 0);
        setIsRunning(true);
      } else {
        // All series and reps completed
        setPhase("done");
        onWorkoutComplete(selectedDay.day, dayMaxRecord);
        setIsRunning(false);
      }
    }
  };

  const currentSeriesInfo = selectedDay?.series?.[currentSeriesIndex];

  // --- UI ---
  if (!selectedDay) {
    return <div className="text-center text-gray-500">Sélectionnez un jour pour commencer</div>;
  }

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        JOUR {selectedDay.day}
      </h2>

      {selectedDay.type === "repos" ? (
        <p className="text-gray-500">Repos aujourd&apos;hui !</p>
      ) : (
        <div>
          {phase === "done" ? (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-semibold">Jour {selectedDay.day} terminé !</p>
            </div>
          ) : (
            <>
              {selectedDay.type !== "max" && currentSeriesInfo && (
                <p className="text-lg text-gray-600 mb-2">
                  Série {currentSeriesIndex + 1} / {selectedDay.series?.length}
                  {currentSeriesInfo.reps && currentSeriesInfo.reps > 1 && ` - Répétition ${currentRep + 1} / ${currentSeriesInfo.reps}`}
                  {` - ${phase === "work" || phase === "max" ? (currentSeriesInfo.name || (phase === "max" ? "Max" : "Exercice")) : "Récupération"}`}
                </p>
              )}
              {selectedDay.type === "max" && phase !== "max" && currentSeriesInfo && (
                <p className="text-lg text-gray-600 mb-2">
                  Série {currentSeriesIndex + 1} / {selectedDay.series?.length}
                  {currentSeriesInfo.reps && currentSeriesInfo.reps > 1 && ` - Répétition ${currentRep + 1} / ${currentSeriesInfo.reps}`}
                  {` - ${phase === "work" || phase === "max" ? (currentSeriesInfo.name || (phase === "max" ? "Max" : "Exercice")) : "Récupération"}`}
                </p>
              )}
              <p className="text-4xl font-mono text-gray-800 mb-4">
                {phase === "max" ? formatTime(maxTime) : formatTime(timeLeft)}
              </p>

              <div className="flex justify-center gap-4">
                {!isRunning && phase !== "done" && (
                  <button
                    onClick={handleStartWorkout} // Call internal start function
                    className="p-3 bg-green-500 text-white rounded-full shadow"
                  >
                    <Play />
                  </button>
                )}
                {isRunning && phase !== "max" && (
                  <button
                    onClick={handlePause}
                    className="p-3 bg-yellow-500 text-white rounded-full shadow"
                  >
                    <Pause />
                  </button>
                )}
                {phase !== "done" && (
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
});