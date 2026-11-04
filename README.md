# CinéForest

Application web de recommandation de films : décrivez en langage naturel ce que vous avez envie de voir
(« un thriller psychologique des années 90 avec une fin inattendue »), et CinéForest propose des films adaptés.
L'interprétation des requêtes est faite par un modèle de langage local via [Ollama](https://ollama.com),
et la sélection repose sur un scoring inspiré des forêts aléatoires (Random Forest).

## Architecture

```
Navigateur ──► server.js (Express) ──► Ollama (127.0.0.1:11434)
   │                │
   └── public/index.html (servi par le même serveur)
```

Le navigateur n'appelle jamais les services externes directement : il passe par `server.js`, sur la même origine.

| Route du navigateur      | Relayée vers                         | Ce que le serveur ajoute |
|--------------------------|--------------------------------------|--------------------------|
| `POST /api/ollama/chat`  | Ollama (`/api/chat`)                 | —                        |
| `GET /api/tmdb/...`      | `https://api.themoviedb.org/3/...`   | la clé `TMDB_API_KEY`    |
| `GET /api/omdb?...`      | `https://www.omdbapi.com/`           | la clé `OMDB_API_KEY`    |

Résultat : pas de problème de CORS, l'URL d'Ollama reste privée, et **les clés API ne sont jamais envoyées au
navigateur** : elles restent dans le fichier `.env` du serveur, qui n'est pas versionné.

```
├── server.js            Serveur Express : fichiers statiques + proxy vers Ollama
├── public/
│   └── index.html       Interface de l'application
├── Dockerfile           Image Node 22 pour un déploiement conteneurisé
├── docker-compose.yml   Lancement en une commande avec Docker
├── .env.example         Modèle de configuration (clés API, port, URL d'Ollama)
└── docs/
    └── DEPLOIEMENT.md   Guide détaillé de déploiement serveur et dépannage
```

## Prérequis

- [Node.js](https://nodejs.org) 20.12 ou plus récent
- Une clé API TMDB (gratuite) et, en option, une clé OMDb : voir [Configurer les clés API](#configurer-les-clés-api)
- [Ollama](https://ollama.com) installé, avec un modèle téléchargé :

```bash
ollama pull qwen2.5:14b
```

Le modèle utilisé se règle dans la constante `OLLAMA_MODEL` de `public/index.html`
(par exemple `llama3.2:3b`, plus léger et plus rapide, sur une machine modeste).

## Configurer les clés API

CinéForest a besoin de clés API pour récupérer les données des films. **Aucune clé n'est fournie dans ce dépôt** :
chaque utilisateur utilise les siennes, qui sont gratuites.

| Service | Rôle | Obligatoire ? | Où l'obtenir |
|---------|------|---------------|--------------|
| **TMDB** | Recherche des films, affiches, synopsis, casting | Oui | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| **OMDb** | Notes IMDb et Rotten Tomatoes | Non | [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) |

**Obtenir la clé TMDB**
1. Créez un compte gratuit sur [themoviedb.org](https://www.themoviedb.org/signup).
2. Allez dans *Paramètres → API* et demandez une clé (type « Developer », usage personnel).
3. Copiez la valeur **API Key** (32 caractères). Ce n'est pas le « Read Access Token », qui est beaucoup plus long.

**Obtenir la clé OMDb (optionnel)**
1. Choisissez l'offre *FREE* (1 000 requêtes par jour) et indiquez votre e-mail.
2. Cliquez sur le lien d'activation reçu par e-mail : la clé (8 caractères) ne fonctionne qu'après.

**Où les mettre**

Copiez le fichier modèle `.env.example` en `.env`, à la racine du projet :

```bash
cp .env.example .env        # Windows (PowerShell) : copy .env.example .env
```

Puis ouvrez `.env` et collez vos clés :

```
TMDB_API_KEY=votre_cle_tmdb_de_32_caracteres
OMDB_API_KEY=votre_cle_omdb
```

Le fichier `.env` est ignoré par Git (voir `.gitignore`) : vos clés restent sur votre machine et ne seront jamais
publiées. Au démarrage, le serveur affiche un avertissement si une clé manque. Sans clé OMDb, l'application
fonctionne quand même, mais sans les notes IMDb.

## Lancer en local

```bash
git clone https://github.com/<votre-pseudo>/cineforest.git
cd cineforest
npm install
cp .env.example .env     # puis renseignez vos clés (voir section précédente)
npm start
```

Ouvrez ensuite http://localhost:2000. Le port et l'adresse d'Ollama se règlent aussi dans `.env`.

## Lancer avec Docker

```bash
cp .env.example .env     # clés API, puis PORT et BIND_IP si besoin
docker compose up -d --build
```

Le conteneur joint l'Ollama de la machine hôte via `host.docker.internal`. Par défaut, le service n'est exposé
que sur `127.0.0.1` ; définissez `BIND_IP` dans `.env` pour l'ouvrir sur une autre interface (réseau privé, VPN…).

## Déploiement sur un serveur

Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) : installation sans droits administrateur, tunnels SSH ou
Cloudflare pour obtenir une URL publique, et solutions aux erreurs courantes.

## Licence

Tous droits réservés. Ce code est publié à titre de consultation ; aucune réutilisation sans autorisation.
