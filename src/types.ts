export interface SeriesEntry {
  time?: number; // Duration in seconds
  reps?: number; // Number of repetitions
  name?: string; // Optional name for the exercise (e.g., "Gainage Main", "Gainage Coude")
  isMax?: boolean; // Indicates if this specific series entry is a 'max' type
}

export interface DayData {
  day: number;
  type?: 'repos'; // 'repos' for rest day. 'max' as a top-level type is now redundant if series entries can be 'isMax'
  series?: SeriesEntry[]; // Array of exercises/sets for the day
}

export interface Challenge {
  id: string;
  name: string;
  data: DayData[];
}
