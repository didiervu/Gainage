import { Challenge, DayData } from './types';

const challengeModules = import.meta.glob('./challenges/*.json');

export async function getChallenges(): Promise<Challenge[]> {
  const challenges: Challenge[] = [];
  for (const path in challengeModules) {
    const id = path.split('/').pop()?.replace('.json', '');
    if (id) {
      const module = await challengeModules[path]() as { name: string; data: DayData[] };
      challenges.push({ id, name: module.name, data: module.data });
    }
  }
  return challenges;
}
