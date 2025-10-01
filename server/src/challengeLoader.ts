import fs from 'fs/promises';
import path from 'path';

// Définition des types, à garder synchronisé avec le frontend
export interface SeriesEntry {
  name: string;
  type: 'exercise' | 'rest' | 'max'; // Nouveau champ
  time?: number; // Durée en secondes
  repetitions?: number; // Nombre de répétitions
}

export interface DayData {
  day: number;
  type?: 'repos' | 'max' | 'exercices';
  series?: SeriesEntry[];
  originalSeries?: SeriesEntry[];
}

export interface Challenge {
  id: string;
  name: string;
  data: DayData[];
}

const challengesPath = path.join(__dirname, '..', 'challenges');

let challenges: Challenge[] = [];

export async function loadChallenges(): Promise<void> {
  try {
    const files = await fs.readdir(challengesPath);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const loadedChallenges: Challenge[] = [];

    for (const file of jsonFiles) {
      const id = file.replace('.json', '');
      const filePath = path.join(challengesPath, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const challengeData = JSON.parse(fileContent);
      loadedChallenges.push({ ...challengeData, id });
    }
    challenges = loadedChallenges;
    console.log(`${challenges.length} défis chargés avec succès.`);

  } catch (error) {
    console.error("Erreur lors du chargement des défis:", error);
    challenges = [];
  }
}

export function getChallengeById(id: string): Challenge | undefined {
  return challenges.find(c => c.id === id);
}
