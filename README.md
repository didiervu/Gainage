# Gainage

This is a simple application to track your progress in different fitness challenges.

## Installation

To install the dependencies, run the following command:

```bash
npm install
```

## Development

To start the development server, run the following command:

```bash
npm run dev
```

## Build

To build the project, run the following command:

```bash
npm run build
```

## Testing

To run the tests, run the following command:

```bash
npm run test
```

---

## Tutoriel de l'application

Bienvenue sur l'application de suivi de défis de gainage ! Ce guide vous aidera à utiliser les fonctionnalités principales de l'application.

### 1. Écran d'Accueil

L'écran d'accueil est le point central de votre entraînement.

-   **Jour Actuel :** Il affiche le jour du défi que vous devez réaliser.
-   **Détails de la séance :** Vous y trouverez les exercices à effectuer pour la journée.
-   **Démarrer :** Cliquez sur ce bouton pour lancer le minuteur et commencer votre séance.
-   **Marquer comme terminé :** Pour les jours de repos, vous pouvez simplement marquer la journée comme terminée.
-   **Progression :** Visualisez votre progression globale dans le défi en cours.

### 2. Calendrier

L'onglet "Calendrier" vous donne une vue d'ensemble du programme.

-   **Vue complète :** Tous les jours du défi sont listés, avec les exercices prévus.
-   **Navigation :** Cliquez sur un jour pour voir ses détails et le sélectionner comme jour actif sur l'écran d'accueil.
-   **Suivi :** Les jours terminés sont visuellement indiqués, vous permettant de suivre votre avancée.

### 3. Réglages

Personnalisez votre expérience dans l'onglet "Réglages".

-   **Changer de défi :** Sélectionnez un autre défi parmi la liste des défis par défaut ou ceux que vous avez créés.
-   **Temps de récupération :** Ajustez le temps de repos entre les séries d'exercices.
-   **Mode libre :** Activez cette option pour pouvoir faire les jours dans le désordre et marquer manuellement les jours comme terminés.

### 4. Gérer les défis

L'onglet "Gérer" vous offre des outils puissants pour vos défis.

-   **Dupliquer un défi :**
    1.  Choisissez un défi à copier.
    2.  Donnez un nom à votre nouveau défi.
    3.  Ajustez les répétitions ou les durées avec un multiplicateur ou un temps additionnel.
    4.  Cliquez sur "Dupliquer" pour créer votre version personnalisée.

-   **Importer un défi :**
    1.  Cliquez sur "Choisir un fichier" et sélectionnez un fichier de défi (`.json`) sur votre appareil.
    2.  Cliquez sur "Importer" pour l'ajouter à votre liste de défis.

-   **Exporter un défi :**
    1.  Sélectionnez un de vos défis.
    2.  Cliquez sur "Exporter" pour le sauvegarder en tant que fichier `.json` sur votre appareil.

### 5. Éditeur de défis

Créez ou modifiez vos propres défis dans l'onglet "Éditeur".

-   **Créer un nouveau défi :**
    1.  Cliquez sur "Créer un nouveau défi" et donnez-lui un nom.
    2.  Votre nouveau défi apparaît, cliquez sur "Modifier" pour commencer à y ajouter des jours.

-   **Modifier un défi :**
    1.  Sélectionnez un de vos défis personnalisés et cliquez sur "Modifier".
    2.  Vous pouvez alors :
        -   **Ajouter un jour :** Configurez le type de jour (Entraînement, Repos, Max).
        -   **Modifier un jour :** Changez le type de jour ou modifiez les exercices.
        -   **Ajouter/Modifier/Supprimer des exercices** pour un jour d'entraînement.