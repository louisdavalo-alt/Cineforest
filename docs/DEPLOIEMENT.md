# Déployer CineForest (avec Ollama) sur un serveur — sans droits admin

## 0. Comprendre l'architecture

`public/index.html` est un front autonome, mais il ne fonctionne pas seul face à Ollama :
appeler Ollama directement depuis le navigateur pose des soucis de CORS dès que la page
n'est pas ouverte en `localhost`. La solution : un petit serveur Node (`server.js`) qui
sert la page **et** relaie les appels vers Ollama en interne (même origine, donc plus de
CORS du tout).

Le front appelle, en `same-origin` (CSP `connect-src 'self'`) :
- `POST /api/ollama/chat` → relayé côté serveur vers `http://127.0.0.1:11434/api/chat`
- `GET /api/tmdb/...` → relayé vers l'API TMDB, avec la clé `TMDB_API_KEY` ajoutée par le serveur
- `GET /api/omdb?...` → relayé vers l'API OMDb, avec la clé `OMDB_API_KEY` ajoutée par le serveur

Les clés API ne sont donc jamais dans `index.html` : elles vivent dans le fichier `.env` du serveur.

Structure du projet :
```
sequence-cineforest/
├── server.js
├── .env              ← tes clés API (jamais sur GitHub)
├── package.json
├── node_modules/      ← créé par npm install
└── public/
    └── index.html
```

## 1. Organiser le projet dans VS Code

- **Fichier > Ouvrir un dossier** → `~/sequence-cineforest`.
- Sous-dossier `public/`, avec le fichier HTML renommé `index.html`.
- `server.js` à la racine, **pas** dans `public/`.

⚠️ Vérifie que ce dossier est le seul ouvert dans VS Code et que le terminal intégré
pointe dessus (`pwd`) — une confusion de dossier est la cause la plus fréquente de blocage
(voir dépannage).

## 2. Vérifier Node.js

```bash
node -v
npm -v
```
Il faut Node **20.12 ou plus** (pour `fetch` natif et la lecture automatique du fichier `.env`).

## 3. Installer les dépendances

Toujours positionné dans `~/sequence-cineforest` (vérifier avec `pwd`) :
```bash
npm install
```
(`package.json` est déjà fourni : inutile de refaire `npm init`.)

Puis crée le fichier de configuration avec tes clés API :
```bash
cp .env.example .env
nano .env        # renseigne TMDB_API_KEY et OMDB_API_KEY
```
Au démarrage, `server.js` affiche un avertissement si une clé manque.

## 4. Vérifier Ollama côté serveur

```bash
ollama list                              # confirme les modèles disponibles
curl http://127.0.0.1:11434/api/tags     # confirme que l'API répond en local
```
Le modèle utilisé par défaut dans `index.html` est `qwen2.5:14b`.
Sur une machine modeste, remplacer par `llama3.2:3b` (plus léger et rapide) dans la constante `OLLAMA_MODEL`
du fichier HTML — le nom doit correspondre exactement à `ollama list`.

Si Ollama tourne sur un autre port que 11434, lancer le serveur avec :
```bash
OLLAMA_URL=http://127.0.0.1:<PORT_OLLAMA> node server.js
```

## 5. Lancer le serveur

```bash
node server.js
```
Tu dois voir : `Serveur lancé sur http://localhost:2000`. Laisse ce terminal ouvert (ne
pas le fermer tant que le serveur doit tourner). Ouvre ensuite `http://localhost:2000`
dans le navigateur. Pour arrêter : `Ctrl+C`.

## 6. Vérifier que tout communique

- Dans la page, section "Recherche intelligente", clique sur **"🔌 Vérifier la connexion"**.
- DevTools (F12) → Network : la requête doit apparaître comme `POST /api/ollama/chat`
  (même origine — plus de `localhost:11434` visible côté navigateur).
- Fais une recherche en langage naturel et vérifie que les films s'affichent.

## 7. Rendre le service joignable via une URL (sans droits admin)

**Option A — tunnel SSH**, si tu testes depuis ta propre machine :
```bash
ssh -L 2000:localhost:2000 toi@ton-serveur
```
Puis ouvre `http://localhost:2000` en local.

**Option B — tunnel public (cloudflared)**, pour une URL partageable en HTTPS :
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/bin/cloudflared
chmod +x ~/bin/cloudflared
~/bin/cloudflared tunnel --url http://localhost:2000
```

**Option C — reverse proxy nginx**, pour une URL propre sur le domaine du serveur :
nécessite de demander à un admin d'ajouter `proxy_pass http://127.0.0.1:2000;` — la
seule étape qui requiert des droits admin. À faire seulement après A ou B validés.

---

## Dépannage — problèmes déjà rencontrés

### `npm error EACCES ... open '/package.json'`
La commande a été lancée depuis la racine du système (`/`) au lieu du dossier du projet.

Corrige comme ceci :
```bash
mkdir -p ~/sequence-cineforest/public
cd ~/sequence-cineforest
pwd
```
`pwd` doit maintenant afficher quelque chose comme `/home/louis/sequence-cineforest` —
vérifie bien ça avant de continuer.

Ensuite seulement, relance :
```bash
npm install
```
Ça doit créer `node_modules/` dans ce dossier, pas à la racine.

Si tu utilises VS Code, le plus sûr est de refaire **Fichier > Ouvrir un dossier** sur
`~/sequence-cineforest`, puis d'ouvrir un nouveau terminal intégré (`` Ctrl+` ``) : il se
positionnera automatiquement dans le bon dossier, ce qui évite ce genre d'erreur.

Une fois dans le bon dossier, place-y `server.js` et `public/index.html` (renommé depuis
le fichier téléchargé), et reprends à l'étape 4 (`node server.js`).

### `Error: Cannot find module '.../server.js'`
Même cause : mauvais dossier.
```bash
pwd
ls      # server.js doit apparaître dans la liste
```
Si le mauvais dossier est ouvert dans VS Code : **Fichier > Ouvrir un dossier**, choisir
le bon. Sinon `cd chemin/vers/sequence-cineforest` avant `node server.js`.

### Panneau "Problems" de VS Code : "Unterminated regular expression literal"
Bug corrigé dans la version fournie (une regex mal échappée dans la fonction
`sanitize()`, ligne ~1535). Si ça réapparaît après une modification du fichier, chercher
`.replace(/\/g` et vérifier qu'il s'agit bien de `.replace(/\\/g` (backslash échappé).

### Avertissements CSS "Also define the standard property 'line-clamp'"
Purement cosmétique (icône jaune/bleue, pas rouge) — VS Code signale que la propriété
standard `line-clamp` pourrait être ajoutée à côté de `-webkit-line-clamp` pour la
compatibilité future. Aucun impact sur le fonctionnement, à ignorer sans risque.

### Le bouton "Vérifier la connexion" affiche une erreur (502 ou autre)
`server.js` n'arrive pas à joindre Ollama. Tester directement :
```bash
curl http://127.0.0.1:11434/api/tags
```
Si ça échoue aussi, le souci est côté Ollama (service arrêté, mauvais port) — pas le
proxy Node.

### Le navigateur dit "site inaccessible" sur `http://localhost:2000`
Le serveur ne tourne pas. Retourner dans le terminal, relancer `node server.js`, et
confirmer que le message "Serveur lancé sur..." s'affiche avant de retester.

### `Error: listen EADDRINUSE :::2000`
Un ancien `node server.js` tourne encore en arrière-plan.
```bash
lsof -i :2000
kill <pid>
```
ou lancer temporairement sur un autre port : `PORT=2001 node server.js`.
