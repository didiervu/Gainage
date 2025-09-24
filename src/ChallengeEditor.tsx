import React, { useState, useCallback, useEffect } from 'react';
import { Challenge, DayData, SeriesEntry } from './types';
import { ArrowLeft } from 'lucide-react';

interface ChallengeEditorProps {
  challenges: Challenge[];
  defaultChallenges: Challenge[];
  onChallengesChange: (updater: (prev: Challenge[]) => Challenge[]) => void;
  initialEditingChallenge: Challenge | null;
  onCloseEditor: () => void;
}

export const ChallengeEditor: React.FC<ChallengeEditorProps> = ({ challenges, defaultChallenges, onChallengesChange, initialEditingChallenge, onCloseEditor }) => {
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [editingDay, setEditingDay] = useState<DayData | null>(null);
  const [editingExercise, setEditingExercise] = useState<SeriesEntry | null>(null);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);

  const isCustomChallenge = (challengeId: string) => {
    return !defaultChallenges.some(c => c.id === challengeId);
  };

  useEffect(() => {
    setEditingChallenge(initialEditingChallenge);
  }, [initialEditingChallenge]);

  useEffect(() => {
    if (editingExercise && editingExerciseIndex !== null) {
      handleUpdateExercise(editingExercise, editingExerciseIndex);
    }
  }, [editingExercise, editingExerciseIndex]);


  const handleDeleteChallenge = (challengeId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce défi ?")) {
      onChallengesChange(prevCustomChallenges => prevCustomChallenges.filter(c => c.id !== challengeId));
    }
  };

  const handleUpdateChallenge = (challenge: Challenge) => {
    onChallengesChange(prevCustomChallenges => prevCustomChallenges.map(c => c.id === challenge.id ? challenge : c));
  };

  const handleUpdateDay = (day: DayData) => {
    if (!editingChallenge) return;
    const updatedData = editingChallenge.data.map(d => d.day === day.day ? day : d);
    const updatedChallenge = { ...editingChallenge, data: updatedData };
    setEditingChallenge(updatedChallenge);
    handleUpdateChallenge(updatedChallenge);
  };

  const handleUpdateExercise = (exercise: SeriesEntry, oldIndex: number) => {
    if (!editingDay) return;
    const updatedSeries = editingDay.series ? [...editingDay.series] : [];
    updatedSeries[oldIndex] = exercise;
    const updatedDay = { ...editingDay, series: updatedSeries };
    setEditingDay(updatedDay);
    handleUpdateDay(updatedDay);
  };

  if (editingChallenge) {
    if (editingDay) {
      if (editingExercise) {
        return (
          <div className="p-4">
            <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">{editingExercise.name || 'Nouvel exercice'}</h1>
            <button onClick={() => setEditingExercise(null)} className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg shadow-md hover:bg-[#059669] transition-colors mb-6">
              <ArrowLeft size={20} />
              Retour
            </button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-2">Nom de l'exercice</label>
                <input
                  type="text"
                  value={editingExercise.name || ''}
                  onChange={(e) => setEditingExercise(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-2">Répétitions</label>
                <input
                  type="number"
                  value={editingExercise.reps || ''}
                  onChange={(e) => setEditingExercise(prev => prev ? { ...prev, reps: Number(e.target.value) } : null)}
                  className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-2">Temps (secondes)</label>
                <input
                  type="number"
                  value={editingExercise.time || ''}
                  onChange={(e) => setEditingExercise(prev => prev ? { ...prev, time: Number(e.target.value) } : null)}
                  className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 px-3 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]"
                />
              </div>

            </div>
          </div>
        );
      }
      return (
        <div className="p-4">
          <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">Jour {editingDay.day}</h1>
          <button onClick={() => setEditingDay(null)} className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg shadow-md hover:bg-[#059669] transition-colors mb-6">
            <ArrowLeft size={20} />
            Retour
          </button>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1F2937] mb-2">Type de jour</label>
              <select
                value={editingDay.type}
                onChange={(e) => {
                  let newType: 'workout' | 'repos' | 'max' = e.target.value as 'workout' | 'repos' | 'max';
                  const updatedDay = { ...editingDay, type: newType };
                  setEditingDay(updatedDay);

                  // Convert 'workout' type to undefined for storage
                  const dayToSave: DayData = {
                      ...updatedDay,
                      type: newType === 'workout' ? undefined : newType
                  };

                  // Update the challenge with the updated day
                  const updatedChallengeData = editingChallenge.data.map(d => d.day === dayToSave.day ? dayToSave : d);
                  const updatedChallenge = { ...editingChallenge, data: updatedChallengeData };
                  setEditingChallenge(updatedChallenge);
                  handleUpdateChallenge(updatedChallenge);
                }}
                className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]"
              >
                <option value="workout">Entraînement</option>
                <option value="repos">Repos</option>
                <option value="max">Max</option>
              </select>
            </div>
            {editingDay.type === 'workout' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#10B981]">Exercices</h2>
                {editingDay.series?.map((series, index) => (
                  <div key={index} className="p-4 bg-white rounded-lg shadow-md flex justify-between items-center">
                    <span className="font-semibold">{series.name || 'Exercice'}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingExercise(series); setEditingExerciseIndex(index); }} className="text-blue-500 hover:underline">Modifier</button>
                      <button onClick={() => {
                        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet exercice ?")) {
                          const updatedSeries = editingDay.series?.filter((_, i) => i !== index);
                          const updatedDay = { ...editingDay, series: updatedSeries };
                          setEditingDay(updatedDay);
                          handleUpdateDay(updatedDay);
                        }
                      }} className="text-red-500 hover:underline">Supprimer</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => {
                  const newExercise = {
                    name: 'Nouvel exercice',
                    reps: undefined,
                    time: undefined,
                  };
                  const updatedSeries = [...(editingDay.series || []), newExercise];
                  const updatedDay = { ...editingDay, series: updatedSeries };
                  setEditingDay(updatedDay);
                  handleUpdateDay(updatedDay);

                  const newExerciseToEdit = updatedSeries[updatedSeries.length - 1];
                  if (newExerciseToEdit) {
                    setEditingExercise(newExerciseToEdit);
                    setEditingExerciseIndex(updatedSeries.length - 1);
                  }
                }} className="w-full mt-6 bg-[#10B981] text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-[#059669] transition-transform hover:scale-105">
                  + Ajouter un exercice
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="p-4">
        <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">{editingChallenge.name}</h1>
        <button onClick={() => setEditingChallenge(null)} className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg shadow-md hover:bg-[#059669] transition-colors mb-6">
          <ArrowLeft size={20} />
          Retour
        </button>
        <div className="space-y-4">
          {editingChallenge.data.map(day => (
            <div key={day.day} className="p-4 bg-white rounded-lg shadow-md flex justify-between items-center">
              <span className="font-semibold">Jour {day.day}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditingDay({ ...day, type: day.type === 'repos' ? 'repos' : (day.type === 'max' ? 'max' : 'workout') })} className="text-blue-500 hover:underline">Modifier</button>
                <button onClick={() => {
                  if (window.confirm("Êtes-vous sûr de vouloir supprimer ce jour ?")) {
                    const updatedData = editingChallenge.data
                      .filter(d => d.day !== day.day)
                      .map((d, i) => ({ ...d, day: i + 1 }));
                    const updatedChallenge = {
                      ...editingChallenge,
                      data: updatedData,
                    };
                    setEditingChallenge(updatedChallenge);
                    handleUpdateChallenge(updatedChallenge);
                  }
                }} className="text-red-500 hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => {
          const newDay: DayData = {
            day: editingChallenge.data.length + 1,
            type: 'workout',
          };
          const updatedChallenge = {
            ...editingChallenge,
            data: [...editingChallenge.data, newDay],
          };
          setEditingChallenge(updatedChallenge);
          handleUpdateChallenge(updatedChallenge);
        }} className="w-full mt-6 bg-[#10B981] text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-[#059669] transition-transform hover:scale-105">
          + Ajouter un jour
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">Éditeur de défis</h1>
      <div className="max-w-md mx-auto">
        {initialEditingChallenge && isCustomChallenge(initialEditingChallenge.id) && (
            <button onClick={() => setEditingChallenge(initialEditingChallenge)} className="w-full bg-[#10B981] text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-[#059669] transition-transform hover:scale-105 mb-6">
                Modifier le défi: {initialEditingChallenge.name}
            </button>
        )}
        <button onClick={() => {
          const name = prompt("Nom du nouveau défi :");
          if (name) {
            const newChallenge: Challenge = {
              id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              name,
              data: [],
            };
            onChallengesChange(prevCustomChallenges => [...prevCustomChallenges, newChallenge]);
            setEditingChallenge(newChallenge);
          }
        }} className="w-full bg-[#10B981] text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-[#059669] transition-transform hover:scale-105 mb-6">
          + Créer un nouveau défi
        </button>
        <div className="space-y-4">
          {challenges.map(challenge => (
            <div key={challenge.id} className="p-4 bg-white rounded-lg shadow-md flex justify-between items-center">
              <span className="font-semibold">{challenge.name}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditingChallenge(challenge)} className="text-blue-500 hover:underline">Modifier</button>
                <button onClick={() => handleDeleteChallenge(challenge.id)} className="text-red-500 hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}