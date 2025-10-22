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



  const isCustomChallenge = (challengeId: string) => {
    return !defaultChallenges.some(c => c.id === challengeId);
  };

  useEffect(() => {
    setEditingChallenge(initialEditingChallenge);
  }, [initialEditingChallenge]);


  const handleDeleteChallenge = (challengeId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce défi ?")) {
      onChallengesChange(prevCustomChallenges => prevCustomChallenges.filter(c => c.id !== challengeId));
    }
  };

  const handleUpdateChallenge = (challenge: Challenge) => {
    onChallengesChange(prevCustomChallenges => prevCustomChallenges.map(c => c.id === challenge.id ? challenge : c));
  };

  if (editingChallenge) {
    const handleUpdateDay = (updatedDay: DayData) => {
      const updatedData = editingChallenge.data.map(d => d.day === updatedDay.day ? updatedDay : d);
      const updatedChallenge = { ...editingChallenge, data: updatedData };
      setEditingChallenge(updatedChallenge);
      onChallengesChange(prevCustomChallenges => prevCustomChallenges.map(c => c.id === updatedChallenge.id ? updatedChallenge : c));
    };

    const handleAddDay = () => {
      const newDay: DayData = {
        day: editingChallenge.data.length + 1,
        type: 'workout',
        series: [],
      };
      const updatedChallenge = {
        ...editingChallenge,
        data: [...editingChallenge.data, newDay],
      };
      setEditingChallenge(updatedChallenge);
      onChallengesChange(prevCustomChallenges => prevCustomChallenges.map(c => c.id === updatedChallenge.id ? updatedChallenge : c));
    };

    const handleDeleteDay = (dayToDelete: DayData) => {
      if (window.confirm(`Êtes-vous sûr de vouloir supprimer le Jour ${dayToDelete.day} ?`)) {
        const updatedData = editingChallenge.data
          .filter(d => d.day !== dayToDelete.day)
          .map((d, i) => ({ ...d, day: i + 1 })); // Re-index days
        const updatedChallenge = {
          ...editingChallenge,
          data: updatedData,
        };
        setEditingChallenge(updatedChallenge);
        onChallengesChange(prevCustomChallenges => prevCustomChallenges.map(c => c.id === updatedChallenge.id ? updatedChallenge : c));
      }
    };

    const handleCopyDay = (dayToCopy: DayData) => {
      const newDay: DayData = {
        ...dayToCopy,
        day: editingChallenge.data.length + 1,
        series: dayToCopy.series ? dayToCopy.series.map(s => ({ ...s })) : [], // Deep copy series
      };
      const updatedChallenge = {
        ...editingChallenge,
        data: [...editingChallenge.data, newDay],
      };
      setEditingChallenge(updatedChallenge);
      onChallengesChange(prevCustomChallenges => prevCustomChallenges.map(c => c.id === updatedChallenge.id ? updatedChallenge : c));
    };

    return (
      <div className="p-4">
        <h1 className="text-3xl font-bold text-center text-[#10B981] mb-6">{editingChallenge.name}</h1>
        <button onClick={() => { setEditingChallenge(null); onCloseEditor(); }} className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg shadow-md hover:bg-[#059669] transition-colors mb-6">
          <ArrowLeft size={20} />
          Retour à la gestion des défis
        </button>

        <div className="space-y-4">
          {editingChallenge.data.map((day, dayIndex) => (
            <div key={day.day} className="p-4 bg-white rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold text-[#10B981]">Jour {day.day}</h2>
                <div className="flex gap-2">
                  <button onClick={() => handleCopyDay(day)} className="text-gray-500 hover:text-gray-700">Copier</button>
                  <button onClick={() => handleDeleteDay(day)} className="text-red-500 hover:underline">Supprimer</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1F2937] mb-2">Type de jour</label>
                <select
                  value={day.type || 'workout'} // Default to 'workout' if undefined
                  onChange={(e) => {
                    const newType: 'workout' | 'repos' | 'max' = e.target.value as 'workout' | 'repos' | 'max';
                    handleUpdateDay({ ...day, type: newType === 'workout' ? undefined : newType, series: newType === 'repos' ? [] : day.series });
                  }}
                  className="w-full appearance-none bg-white border border-[#10B981] text-[#1F2937] py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981]"
                >
                  <option value="workout">Entraînement</option>
                  <option value="repos">Repos</option>
                  <option value="max">Max</option>
                </select>
                {day.type === 'max' && (
                  <p className="text-sm text-gray-600 mt-1 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    Cette journée est dédiée à un test d'effort maximal. L'objectif est d'atteindre votre meilleure performance sur les exercices listés.
                  </p>
                )}
              </div>

              {(day.type === undefined || day.type === 'workout' || day.type === 'max') && (
                <div className="mt-4 space-y-3">
                  <h3 className="text-lg font-semibold text-[#1F2937]">Exercices</h3>
                  {day.series?.map((exercise, exerciseIndex) => (
                    <div key={exerciseIndex} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <input
                          type="text"
                          value={exercise.name || ''}
                          onChange={(e) => {
                            const updatedSeries = day.series ? [...day.series] : [];
                            updatedSeries[exerciseIndex] = { ...exercise, name: e.target.value };
                            handleUpdateDay({ ...day, series: updatedSeries });
                          }}
                          className="font-semibold w-full bg-transparent border-b border-gray-300 focus:outline-none focus:border-[#10B981]"
                          placeholder="Nom de l'exercice"
                        />
                        <button onClick={() => {
                          const updatedSeries = day.series?.filter((_, i) => i !== exerciseIndex);
                          handleUpdateDay({ ...day, series: updatedSeries });
                        }} className="text-red-500 hover:text-red-700 ml-2">Supprimer</button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#1F2937] mb-1">Type</label>
                        <select
                          value={
                            exercise.isMax ? 'isMax' :
                            exercise.repsPercentage !== undefined ? 'repsPercentage' :
                            exercise.reps !== undefined ? 'reps' :
                            'time'
                          }
                          onChange={(e) => {
                            const type = e.target.value as 'time' | 'reps' | 'isMax' | 'repsPercentage';
                            const newEx: SeriesEntry = { name: exercise.name };
                            if (type === 'isMax') {
                              newEx.isMax = true;
                            } else if (type === 'time') {
                              newEx.time = 30;
                            } else if (type === 'reps') {
                              newEx.reps = 10;
                            } else if (type === 'repsPercentage') {
                              newEx.repsPercentage = 0.5;
                            }
                            const updatedSeries = day.series ? [...day.series] : [];
                            updatedSeries[exerciseIndex] = newEx;
                            handleUpdateDay({ ...day, series: updatedSeries });
                          }}
                          className="w-full appearance-none bg-white border border-gray-300 text-[#1F2937] py-1 pl-2 pr-6 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] text-sm"
                        >
                          <option value="time">Temps</option>
                          <option value="reps">Répétitions</option>
                          <option value="isMax">Effort Maximal (Max)</option>
                          <option value="repsPercentage">% du Max de Répétitions</option>
                        </select>
                      </div>

                      {/* Input fields based on exercise type */}
                      {((exercise.isMax && !exercise.repsPercentage && exercise.reps === undefined) || (day.type === 'max' && exercise.isMax)) &&
                        <p className="text-center text-blue-700 bg-blue-100 p-2 rounded-lg text-sm mt-2 border border-blue-300">
                          Cet exercice est un défi "Effort Maximal". L'objectif est de réaliser la meilleure performance possible (temps ou répétitions).
                        </p>
                      }
                      {exercise.reps !== undefined && exercise.time === undefined && !exercise.isMax && !exercise.repsPercentage &&
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-[#1F2937] mb-1">Répétitions</label>
                          <input
                            type="number"
                            value={exercise.reps || ''}
                            onChange={(e) => {
                              const updatedSeries = day.series ? [...day.series] : [];
                              updatedSeries[exerciseIndex] = { ...exercise, reps: Number(e.target.value) };
                              handleUpdateDay({ ...day, series: updatedSeries });
                            }}
                            className="w-full appearance-none bg-white border border-gray-300 text-[#1F2937] py-1 px-2 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] text-sm"
                          />
                        </div>
                      }
                      {exercise.reps !== undefined && exercise.time !== undefined && !exercise.isMax && !exercise.repsPercentage &&
                        <>
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-[#1F2937] mb-1">Répétitions</label>
                            <input
                              type="number"
                              value={exercise.reps || ''}
                              onChange={(e) => {
                                const updatedSeries = day.series ? [...day.series] : [];
                                updatedSeries[exerciseIndex] = { ...exercise, reps: Number(e.target.value) };
                                handleUpdateDay({ ...day, series: updatedSeries });
                              }}
                              className="w-full appearance-none bg-white border border-gray-300 text-[#1F2937] py-1 px-2 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] text-sm"
                            />
                          </div>
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-[#1F2937] mb-1">Temps (secondes)</label>
                            <input
                              type="number"
                              value={exercise.time || ''}
                              onChange={(e) => {
                                const updatedSeries = day.series ? [...day.series] : [];
                                updatedSeries[exerciseIndex] = { ...exercise, time: Number(e.target.value) };
                                handleUpdateDay({ ...day, series: updatedSeries });
                              }}
                              className="w-full appearance-none bg-white border border-gray-300 text-[#1F2937] py-1 px-2 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] text-sm"
                            />
                          </div>
                        </>
                      }
                      {exercise.time !== undefined && !exercise.reps && !exercise.isMax && !exercise.repsPercentage &&
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-[#1F2937] mb-1">Temps (secondes)</label>
                          <input
                            type="number"
                            value={exercise.time || ''}
                            onChange={(e) => {
                              const updatedSeries = day.series ? [...day.series] : [];
                              updatedSeries[exerciseIndex] = { ...exercise, time: Number(e.target.value) };
                              handleUpdateDay({ ...day, series: updatedSeries });
                            }}
                            className="w-full appearance-none bg-white border border-gray-300 text-[#1F2937] py-1 px-2 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] text-sm"
                          />
                        </div>
                      }
                      {exercise.repsPercentage !== undefined && !exercise.isMax && !exercise.reps &&
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-[#1F2937] mb-1">Pourcentage du max (ex: 0.5)</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="2"
                            value={exercise.repsPercentage || ''}
                            onChange={(e) => {
                              const updatedSeries = day.series ? [...day.series] : [];
                              updatedSeries[exerciseIndex] = { ...exercise, repsPercentage: Number(e.target.value) };
                              handleUpdateDay({ ...day, series: updatedSeries });
                            }}
                            className="w-full appearance-none bg-white border border-gray-300 text-[#1F2937] py-1 px-2 rounded-lg focus:outline-none focus:bg-white focus:border-[#10B981] text-sm"
                          />
                        </div>
                      }
                    </div>
                  ))}
                  <button onClick={() => {
                    const newExercise: SeriesEntry = { name: 'Nouvel exercice', time: 30 };
                    const updatedSeries = [...(day.series || []), newExercise];
                    handleUpdateDay({ ...day, series: updatedSeries });
                  }} className="w-full bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors">
                    + Ajouter un exercice
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={handleAddDay} className="w-full mt-6 bg-[#10B981] text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-[#059669] transition-transform hover:scale-105">
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
          if (!name) return;
          const durationStr = prompt("Nombre de jours pour ce défi (ex: 30) :");
          const duration = durationStr ? parseInt(durationStr, 10) : 0;

          if (name && duration > 0) {
            const newChallenge: Challenge = {
              id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              name,
              data: Array.from({ length: duration }, (_, i) => ({ day: i + 1, type: 'workout', series: [] })),
            };
            onChallengesChange(prevCustomChallenges => [...prevCustomChallenges, newChallenge]);
            setEditingChallenge(newChallenge);
          } else if (name) {
            alert("Veuillez entrer un nombre de jours valide.");
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