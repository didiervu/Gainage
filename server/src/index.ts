import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { loadChallenges, getChallengeById, Challenge, DayData, SeriesEntry } from './challengeLoader';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3001;
const REST_TIME = 3; // Temps de repos réduit pour les tests
const DEFAULT_EXERCISE_TIME = 30; // Durée par défaut pour les exercices sans temps
const PREPARATION_TIME = 3; // Temps de préparation avant le premier exercice

// --- Types ---
type TimerState = 'running' | 'rest' | 'paused' | 'finished' | 'preparation';

interface Participant {
  id: string; // socket.id
  name: string;
}

interface WorkoutState {
  currentDayIndex: number;
  currentSeriesIndex: number;
  timerState: TimerState;
  timerStartTime: number;
  timerDuration: number;
}

interface Session {
  participants: Participant[];
  challengeId?: string;
  challenge?: Challenge;
  workoutState?: WorkoutState;
}

const sessions: Record<string, Session> = {};

// --- Logique de l'entraînement ---

io.on('connection', (socket) => {
  let currentSessionId: string | null = null;

  socket.on('join-session', ({ sessionId, name }) => {
    currentSessionId = sessionId;
    socket.join(sessionId);

    if (!sessions[sessionId]) {
      sessions[sessionId] = { participants: [] };
    }
    sessions[sessionId].participants.push({ id: socket.id, name });

    const isHost = sessions[sessionId].participants.length === 1;
    socket.emit('session-joined', { sessionId, isHost });
    io.to(sessionId).emit('session-update', { ...sessions[sessionId] }); // Émettre une nouvelle référence
  });

  socket.on('select-challenge', ({ sessionId, challengeId }) => {
    const session = sessions[sessionId];
    const challenge = getChallengeById(challengeId);
    if (session && challenge) {
      session.challengeId = challengeId;
      session.challenge = challenge;
      io.to(sessionId).emit('session-update', { ...session }); // Émettre une nouvelle référence
    }
  });

  socket.on('start-workout', ({ sessionId }) => {
    console.log(`[Server] start-workout reçu pour la session ${sessionId} par le socket ${socket.id}`);
    const session = sessions[sessionId];
    if (session && session.challenge) {
      const firstDay = session.challenge.data[0];
      const firstSeries = firstDay?.series?.[0];
      if (!firstSeries) {
        console.log(`[Server] Pas de première série trouvée pour le défi dans la session ${sessionId}`);
        return;
      }

      session.workoutState = {
        currentDayIndex: 0,
        currentSeriesIndex: 0,
        timerState: 'preparation', // Commencer par un compte à rebours de préparation
        timerStartTime: Date.now(),
        timerDuration: PREPARATION_TIME, // Utiliser le temps de préparation pour le compte à rebours initial
      };
      console.log(`[Server] workoutState initialisé pour la session ${sessionId}:`, session.workoutState);
      io.to(sessionId).emit('session-update', { ...session }); // Émettre une nouvelle référence de session
      console.log(`[Server] session-update émis après start-workout pour la session ${sessionId}`);
      // Après le compte à rebours initial, avancer l'état pour commencer le premier exercice
      setTimeout(() => advanceWorkoutState(sessionId), PREPARATION_TIME * 1000);
      console.log(`[Server] setTimeout pour advanceWorkoutState planifié pour la session ${sessionId} dans ${PREPARATION_TIME} secondes`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Server] Déconnexion du socket ${socket.id}`);
    if (currentSessionId && sessions[currentSessionId]) {
      const session = sessions[currentSessionId];
      session.participants = session.participants.filter(p => p.id !== socket.id);
      if (session.participants.length === 0) {
        console.log(`[Server] Session ${currentSessionId} vide, suppression.`);
        delete sessions[currentSessionId];
      } else {
        console.log(`[Server] Participant ${socket.id} retiré de la session ${currentSessionId}. Participants restants:`, session.participants.map(p => p.name));
        io.to(currentSessionId).emit('session-update', { ...session }); // Émettre une nouvelle référence
      }
    }
  });
});

// --- Logique de l'entraînement ---
function advanceWorkoutState(sessionId: string) {
  console.log(`[Server] advanceWorkoutState appelé pour la session ${sessionId}`);
  const session = sessions[sessionId];
  if (!session || !session.challenge || !session.workoutState) {
    console.log(`[Server] advanceWorkoutState: Session, challenge ou workoutState manquant pour ${sessionId}`);
    return;
  }

  const { workoutState, challenge } = session;
  const currentDay = challenge.data[workoutState.currentDayIndex];

  console.log(`[Server] advanceWorkoutState: État actuel pour ${sessionId}:`, workoutState);

      if (workoutState.timerState === 'preparation') {
        const firstDay = challenge.data[0];
        const firstSeries = firstDay?.series?.[0];

        if (firstSeries) {
          console.log(`[Server] advanceWorkoutState: Passage de preparation à l'état initial pour la session ${sessionId}, première série:`, firstSeries);
          if (firstSeries.type === 'rest') {
    // Update the workout state to reflect the timer running
            session.workoutState = {
              ...workoutState,
              timerState: 'running',
              timerStartTime: Date.now(),
            };
            io.to(sessionId).emit('session-update', { ...session });
            if (session.workoutState) {
              setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
              console.log(`[Server] Next advanceWorkoutState scheduled for session ${sessionId} in ${session.workoutState.timerDuration} seconds.`);
            }
          } else { // 'exercise' ou 'max'
            session.workoutState = {
              ...workoutState,
              timerState: 'running',
              timerStartTime: Date.now(),
              timerDuration: firstSeries.time || DEFAULT_EXERCISE_TIME,
            };
            io.to(sessionId).emit('session-update', { ...session });
            setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
          }
        } else {
          console.log(`[Server] advanceWorkoutState: Pas de première série trouvée après préparation pour la session ${sessionId}`);
          session.workoutState = { ...workoutState, timerState: 'finished' };
          io.to(sessionId).emit('session-update', { ...session });
        }
        return;
      }
  if (workoutState.timerState === 'running') {
    workoutState.currentSeriesIndex++;
    let nextSeries = currentDay.series?.[workoutState.currentSeriesIndex];

    if (nextSeries) {
      console.log(`[Server] advanceWorkoutState: Passage de running à l'état suivant pour la session ${sessionId}, prochaine série:`, nextSeries);
      if (nextSeries.type === 'rest') {
        session.workoutState = {
          ...workoutState,
          timerState: 'rest',
          timerStartTime: Date.now(),
          timerDuration: nextSeries.time || REST_TIME,
        };
        io.to(sessionId).emit('session-update', { ...session });
        setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
      } else { // 'exercise' ou 'max'
        session.workoutState = {
          ...workoutState,
          timerState: 'running',
          timerStartTime: Date.now(),
          timerDuration: nextSeries.time || DEFAULT_EXERCISE_TIME,
        };
        io.to(sessionId).emit('session-update', { ...session });
        setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
      }
    } else { // Fin de la série actuelle, vérifier le jour suivant
      workoutState.currentDayIndex++;
      workoutState.currentSeriesIndex = 0; // Réinitialiser l'index de la série pour le nouveau jour
      const nextDay = challenge.data[workoutState.currentDayIndex];

      if (nextDay) {
        const newCurrentDay = challenge.data[workoutState.currentDayIndex]; // Redéfinir currentDay
        let nextSeries = newCurrentDay.series?.[0];
        if (nextSeries) {
          console.log(`[Server] advanceWorkoutState: Passage à un nouveau jour pour la session ${sessionId}, première série du nouveau jour:`, nextSeries);
          if (nextSeries.type === 'rest') {
            session.workoutState = {
              ...workoutState,
              timerState: 'rest',
              timerStartTime: Date.now(),
              timerDuration: nextSeries.time || REST_TIME,
            };
            io.to(sessionId).emit('session-update', { ...session });
            setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
          } else { // 'exercise' ou 'max'
            session.workoutState = {
              ...workoutState,
              timerState: 'running',
              timerStartTime: Date.now(),
              timerDuration: nextSeries.time || DEFAULT_EXERCISE_TIME,
            };
            io.to(sessionId).emit('session-update', { ...session });
            setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
          }
        } else {
          console.log(`[Server] advanceWorkoutState: Pas de séries trouvées pour le nouveau jour dans la session ${sessionId}`);
          session.workoutState = { ...workoutState, timerState: 'finished' };
          io.to(sessionId).emit('session-update', { ...session });
        }
      } else {
        console.log(`[Server] advanceWorkoutState: Fin du défi pour la session ${sessionId}`);
        session.workoutState = { ...workoutState, timerState: 'finished' };
        io.to(sessionId).emit('session-update', { ...session });
      }
    }
    return;
  }

  if (workoutState.timerState === 'rest') {
    workoutState.currentSeriesIndex++;
    let nextSeries = currentDay.series?.[workoutState.currentSeriesIndex];

    if (nextSeries) {
      console.log(`[Server] advanceWorkoutState: Passage de rest à l'état suivant pour la session ${sessionId}, prochaine série:`, nextSeries);
      if (nextSeries.type === 'rest') {
        session.workoutState = {
          ...workoutState,
          timerState: 'rest',
          timerStartTime: Date.now(),
          timerDuration: nextSeries.time || REST_TIME,
        };
        io.to(sessionId).emit('session-update', { ...session });
        setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
      } else { // 'exercise' ou 'max'
        session.workoutState = {
          ...workoutState,
          timerState: 'running',
          timerStartTime: Date.now(),
          timerDuration: nextSeries.time || DEFAULT_EXERCISE_TIME,
        };
        io.to(sessionId).emit('session-update', { ...session });
        setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
      }
    } else { // Fin de la série actuelle, vérifier le jour suivant
      workoutState.currentDayIndex++;
      workoutState.currentSeriesIndex = 0; // Réinitialiser l'index de la série pour le nouveau jour
      const nextDay = challenge.data[workoutState.currentDayIndex];

      if (nextDay) {
        const newCurrentDay = challenge.data[workoutState.currentDayIndex]; // Redéfinir currentDay
        let nextSeries = newCurrentDay.series?.[0];
        if (nextSeries) {
          console.log(`[Server] advanceWorkoutState: Passage à un nouveau jour pour la session ${sessionId}, première série du nouveau jour:`, nextSeries);
          if (nextSeries.type === 'rest') {
            session.workoutState = {
              ...workoutState,
              timerState: 'rest',
              timerStartTime: Date.now(),
              timerDuration: nextSeries.time || REST_TIME,
            };
            io.to(sessionId).emit('session-update', { ...session });
            setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
          } else { // 'exercise' ou 'max'
            session.workoutState = {
              ...workoutState,
              timerState: 'running',
              timerStartTime: Date.now(),
              timerDuration: nextSeries.time || DEFAULT_EXERCISE_TIME,
            };
            io.to(sessionId).emit('session-update', { ...session });
            setTimeout(() => advanceWorkoutState(sessionId), session.workoutState.timerDuration * 1000);
          }
        } else {
          console.log(`[Server] advanceWorkoutState: Pas de séries trouvées pour le nouveau jour dans la session ${sessionId}`);
          session.workoutState = { ...workoutState, timerState: 'finished' };
          io.to(sessionId).emit('session-update', { ...session });
        }
      } else {
        console.log(`[Server] advanceWorkoutState: Fin du défi pour la session ${sessionId}`);
        session.workoutState = { ...workoutState, timerState: 'finished' };
        io.to(sessionId).emit('session-update', { ...session });
      }
    }
  }
}

// --- Démarrage du serveur ---
server.listen(PORT, async () => {
  await loadChallenges();
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
