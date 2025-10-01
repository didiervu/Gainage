export interface SeriesEntry {
  name: string;
  type: 'exercise' | 'rest' | 'max'; // Nouveau champ
  time?: number; // Durée en secondes
  repetitions?: number; // Nombre de répétitions
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
