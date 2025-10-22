export interface SeriesEntry {
  name: string;
  type: 'exercise' | 'rest' | 'max'; // Nouveau champ
  time?: number; // Durée en secondes
  reps?: number; // Nombre de répétitions
  repsPercentage?: number; // Pourcentage du max de répétitions
  isMax?: boolean; // Indique un exercice de type 'max' (chronomètre)
}

export interface DayData {
  day: number;
  type?: 'repos' | 'max'; // 'repos' for rest day. 'max' for a day that is entirely a max effort, or if series entries can be 'isMax'
  series?: SeriesEntry[]; // Array of exercises/sets for the day
  originalSeries?: SeriesEntry[];
}

export interface Challenge {
  id: string;
  name: string;
  data: DayData[];
}
