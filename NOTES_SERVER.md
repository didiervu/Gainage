# Notes de Maintenance du Serveur

Ce fichier résume les commandes utiles pour la maintenance du serveur sur la VM.

## Comment mettre à jour le serveur avec du nouveau code

Lorsque vous avez modifié le code du serveur sur votre ordinateur de développement, suivez ces étapes :

1.  **Copiez les fichiers modifiés** de votre PC vers le dossier du serveur sur la VM (`/home/freebox/mon-serveur`).

2.  Connectez-vous à la VM et allez dans le dossier du serveur :
    ```bash
    cd /home/freebox/mon-serveur
    ```

3.  **Compilez la nouvelle version** du code :
    ```bash
    npm run build
    ```

4.  **Redémarrez le serveur** via pm2 pour qu'il utilise le nouveau code compilé :
    ```bash
    pm2 restart gainage-server
    ```

## Comment vérifier que le serveur fonctionne bien

1.  **Vérifier le statut du processus (sur la VM) :**
    *   La commande doit montrer `gainage-server` avec un statut `online`.
    ```bash
    pm2 list
    ```

2.  **Consulter les logs du serveur (sur la VM) :**
    *   Utile pour voir les messages d'activité ou les erreurs.
    ```bash
    pm2 logs gainage-server
    ```

3.  **Vérifier que le port est bien utilisé (sur la VM) :**
    *   Cette commande doit montrer une ligne avec `node` qui utilise le port `3001`.
    ```bash
    sudo lsof -i :3001
    ```

4.  **Tester la connexion réseau (depuis votre PC Windows) :**
    *   `TcpTestSucceeded` doit être `True`.
    ```powershell
    Test-NetConnection -ComputerName 192.168.0.54 -Port 3001
    ```
