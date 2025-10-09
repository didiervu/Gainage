# Guide d'Hébergement pour l'Application Gainage

Ce fichier résume les différentes options d'hébergement et configurations discutées.

---

### 1. Comparaison des Plateformes d'Hébergement

*   **Replit : L'environnement de développement tout-en-un.**
    *   **Idéal pour :** Développer, apprendre, et prototyper rapidement dans le navigateur.
    *   **Offre gratuite :** L'environnement complet est disponible, mais le serveur web s'endort après une période d'inactivité, ce qui n'est pas idéal pour un site en production.
    *   **Workflow :** On code et on exécute directement dans le navigateur.

*   **Render : La plateforme de déploiement pour la production.**
    *   **Idéal pour :** Mettre en ligne une application de manière stable et professionnelle.
    *   **Offre gratuite :** Propose des services "always-on" (ou qui se réveillent très vite) pour les petits serveurs backend, ce qui est parfait pour la production de projets personnels.
    *   **Workflow :** On pousse son code sur GitHub/GitLab, et Render déploie automatiquement les mises à jour.

---

### 2. Stratégie d'Hébergement Gratuite Recommandée

Pour une solution 100% gratuite, performante et "always-on" :

1.  **Frontend (Votre application React) :**
    *   **Service :** **Netlify** (ou Render, qui le fait aussi très bien).
    *   **Pourquoi :** Leur offre gratuite est extrêmement généreuse pour les sites statiques, avec les performances d'un CDN mondial.

2.  **Backend (Votre API dans le dossier `server`) :**
    *   **Service :** **Render**.
    *   **Pourquoi :** Leur offre gratuite est conçue pour héberger de petits serveurs Node.js en production sans qu'ils ne s'endorment de manière permanente.

---

### 3. Guide pour l'Hébergement sur une VM Freebox (Option Avancée)

Héberger le backend chez vous est possible mais demande plusieurs étapes de configuration.

#### Étape 1 : Mettre à jour le code du Frontend

Le code de votre application React doit savoir où se trouve le serveur.

1.  **Créez un fichier `.env.production`** à la racine du projet.
2.  **Ajoutez l'URL de votre serveur.** Ce sera votre nom de domaine DDNS ou votre IP publique, suivi du port que vous avez ouvert.
    ```
    VITE_API_BASE_URL=http://mon-serveur.ddns.net:8080
    ```
3.  **Utilisez cette variable dans vos appels `fetch` :**
    ```javascript
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    fetch(`${apiUrl}/api/endpoint`)
      .then(res => res.json())
      .then(data => console.log(data));
    ```

#### Étape 2 : Rendre la VM Accessible depuis Internet

1.  **Redirection de Ports (Freebox OS) :**
    *   Allez dans les paramètres de la Freebox, section "Redirection de ports".
    *   Créez une règle pour rediriger un port externe (ex: `8080`) vers l'IP locale de votre VM et le port sur lequel votre serveur écoute (ex: `3000`).
    *   `Port externe : 8080` → `IP VM : 192.168.1.XX` → `Port interne : 3000`.

2.  **DNS Dynamique (DDNS) :**
    *   Comme votre IP publique change, utilisez un service de DDNS (ex: No-IP, Dynu).
    *   La Freebox a un client DDNS intégré que vous pouvez configurer pour lier votre IP à un nom de domaine fixe (ex: `mon-serveur.ddns.net`).

#### Étape 3 : Configurer le CORS sur le Backend

Pour des raisons de sécurité, votre serveur doit explicitement autoriser les requêtes venant de votre site Netlify.

1.  **Installez le package `cors`** dans votre dossier `server` :
    ```bash
    npm install cors
    ```
2.  **Appliquez le middleware** dans votre fichier `server/src/index.ts` :
    ```typescript
    import express from 'express';
    import cors from 'cors'; // Importer

    const app = express();

    // Options pour n'autoriser que votre site Netlify
    const corsOptions = {
      origin: 'https://VOTRE_NOM_DE_SITE.netlify.app'
    };
    app.use(cors(corsOptions)); // Appliquer avant les routes

    // ... Reste de votre configuration de serveur et de vos routes

    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    ```
