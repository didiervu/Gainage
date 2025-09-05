export interface SeriesEntry {
  time?: number; // Duration in seconds
  reps?: number; // Number of repetitions
  sets?: number; // Number of sets
  name?: string; // Optional name for the exercise (e.g., "Gainage Main", "Gainage Coude")
  isMax?: boolean; // Indicates if this specific series entry is a 'max' type
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
