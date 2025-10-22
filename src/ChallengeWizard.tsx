
import React, { useState } from 'react';
import { Challenge, DayData, SeriesEntry } from './types';

interface ChallengeWizardProps {
  onChallengeCreated: (challenge: Challenge) => void;
  onClose: () => void;
}

type ExerciseType = 'gainage' | 'pompes' | 'abdos' | 'poids-du-corps' | 'rapide';
type Difficulty = 'facile' | 'moyen' | 'difficile';

const exerciseTypeOptions: { id: ExerciseType; name: string }[] = [
  { id: 'gainage', name: 'Gainage' },
  { id: 'pompes', name: 'Pompes' },
  { id: 'abdos', name: 'Abdos' },
  { id: 'poids-du-corps', name: 'Poids du corps' },
  { id: 'rapide', name: 'Rapide' },
];

export const ChallengeWizard: React.FC<ChallengeWizardProps> = ({ onChallengeCreated, onClose }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [selectedExercises, setSelectedExercises] = useState<ExerciseType[]>(['gainage']);
  const [difficulty, setDifficulty] = useState<Difficulty>('moyen');

  const handleExerciseToggle = (exercise: ExerciseType) => {
    setSelectedExercises(prev =>
      prev.includes(exercise) ? prev.filter(e => e !== exercise) : [...prev, exercise]
    );
  };

  const generateChallenge = () => {
    const newChallenge: Challenge = {
      id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      name,
      data: [],
    };

    let restDayFrequency: number;
    let initialTime: number;
    let timeIncrement: number;
    let initialReps: number;
    let repsIncrement: number;
    let exercisesPerDayConfig: number; // Renamed to avoid conflict with loop variable

    switch (difficulty) {
      case 'facile':
        restDayFrequency = 4;
        initialTime = 20;
        timeIncrement = 2;
        initialReps = 8;
        repsIncrement = 1;
        exercisesPerDayConfig = 1;
        break;
      case 'moyen':
        restDayFrequency = 6;
        initialTime = 30;
        timeIncrement = 3;
        initialReps = 10;
        repsIncrement = 2;
        exercisesPerDayConfig = 1; // Will alternate between 1 and 2
        break;
      case 'difficile':
        restDayFrequency = 8;
        initialTime = 40;
        timeIncrement = 4;
        initialReps = 12;
        repsIncrement = 3;
        exercisesPerDayConfig = 2; // Will alternate between 2 and 3
        break;
      default: // moyen
        restDayFrequency = 6;
        initialTime = 30;
        timeIncrement = 3;
        initialReps = 10;
        repsIncrement = 2;
        exercisesPerDayConfig = 1;
        break;
    }

    let workoutDayCount = 0;
    let currentExerciseIndex = 0;

    for (let day = 1; day <= duration; day++) {
      if (day % restDayFrequency === 0) {
        newChallenge.data.push({ day, type: 'repos' });
      } else {
        workoutDayCount++;
        const series: SeriesEntry[] = [];
        let numExercisesForThisDay = exercisesPerDayConfig;

        if (difficulty === 'moyen' && workoutDayCount % 2 === 0) {
          numExercisesForThisDay = 2;
        } else if (difficulty === 'difficile' && workoutDayCount % 2 === 0) {
          numExercisesForThisDay = 3;
        }

        for (let i = 0; i < numExercisesForThisDay; i++) {
          const exerciseType = selectedExercises[currentExerciseIndex % selectedExercises.length];
          const exerciseName = exerciseTypeOptions.find(e => e.id === exerciseType)?.name || 'Exercice';

          // Simple progression for time and reps
          const time = initialTime + (workoutDayCount - 1) * timeIncrement;
          const reps = initialReps + (workoutDayCount - 1) * repsIncrement;

          // For now, all exercises are time-based. We can add more logic later for reps-based.
          // If the exercise type is 'pompes' or 'abdos', we can make it reps-based.
          if (exerciseType === 'pompes' || exerciseType === 'abdos') {
            series.push({ name: exerciseName, reps: reps }); // Assuming 5s rest between reps
          } else {
            series.push({ name: exerciseName, time: time });
          }
          currentExerciseIndex++;
        }
        newChallenge.data.push({ day, series });
      }
    }

    onChallengeCreated(newChallenge);
    onClose();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <label className="block text-sm font-medium text-[#1F2937] mb-2">Nom du défi</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]"
              placeholder="Mon défi personnalisé"
            />
          </div>
        );
      case 2:
        return (
          <div>
            <label className="block text-sm font-medium text-[#1F2937] mb-2">Durée du défi (en jours)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]"
            />
          </div>
        );
      case 3:
        return (
          <div>
            <label className="block text-sm font-medium text-[#1F2937] mb-2">Types d'exercices</label>
            <div className="space-y-2">
              {exerciseTypeOptions.map(exercise => (
                <label key={exercise.id} className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedExercises.includes(exercise.id)}
                    onChange={() => handleExerciseToggle(exercise.id)}
                    className="form-checkbox h-5 w-5 text-[#10B981] rounded border-gray-300 focus:ring-[#10B981]"
                  />
                  <span className="text-gray-700">{exercise.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div>
            <label className="block text-sm font-medium text-[#1F2937] mb-2">Difficulté</label>
            <div className="space-y-2">
              {['facile', 'moyen', 'difficile'].map(level => (
                <label key={level} className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="difficulty"
                    value={level}
                    checked={difficulty === level}
                    onChange={() => setDifficulty(level as Difficulty)}
                    className="form-radio h-4 w-4 text-[#10B981] border-gray-300 focus:ring-[#10B981]"
                  />
                  <span className="text-gray-700 capitalize">{level}</span>
                </label>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-[#10B981] mb-6">Assistant de Défi</h2>
        <div className="space-y-4">
          {renderStep()}
        </div>
        <div className="mt-6 flex justify-between">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">
              Précédent
            </button>
          )}
          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)} className="px-4 py-2 bg-[#10B981] text-white rounded-lg hover:bg-[#059669]">
              Suivant
            </button>
          ) : (
            <button onClick={generateChallenge} className="px-4 py-2 bg-[#10B981] text-white rounded-lg hover:bg-[#059669]">
              Générer le défi
            </button>
          )}
        </div>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-800">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
