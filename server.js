const express = require('express');
const path = require('path');

// Charge le fichier .env s'il existe (Node 20.6+ ; sinon, passer les variables à la main)
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* pas de .env : valeurs par défaut */ }

const app = express();
app.use(express.json({ limit: '5mb' }));

// URL interne d'Ollama (côté serveur uniquement — jamais exposée au navigateur)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

// Clés API — restent sur le serveur, ne sont jamais envoyées au navigateur
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const OMDB_API_KEY = process.env.OMDB_API_KEY || '';

if (!TMDB_API_KEY) console.warn('⚠️  TMDB_API_KEY absente : définis-la dans .env (voir .env.example)');
if (!OMDB_API_KEY) console.warn('ℹ️  OMDB_API_KEY absente : les notes IMDb / Rotten Tomatoes seront désactivées');

// Proxy : le navigateur appelle /api/ollama/chat (même origine, pas de CORS),
// et c'est ce serveur qui relaie vers Ollama en interne.
app.post('/api/ollama/chat', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: "Impossible de joindre Ollama : " + e.message });
  }
});

// Paramètres de la requête d'origine, sans jamais laisser le client imposer une clé
function queryFrom(req) {
  const qs = new URLSearchParams(req.originalUrl.split('?')[1] || '');
  qs.delete('api_key');
  qs.delete('apikey');
  return qs;
}

async function relay(res, url, label) {
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: `Impossible de joindre ${label} : ` + e.message });
  }
}

// Proxy TMDB : /api/tmdb/<chemin>?… → https://api.themoviedb.org/3/<chemin>?…&api_key=…
// Seuls les points d'accès utilisés par l'application sont autorisés.
const TMDB_ALLOWED = [
  /^discover\/movie$/,
  /^movie\/\d+$/,
  /^search\/(movie|person)$/,
  /^person\/\d+\/movie_credits$/,
];
app.get('/api/tmdb/*path', (req, res) => {
  if (!TMDB_API_KEY) return res.status(503).json({ error: 'TMDB_API_KEY non configurée sur le serveur' });
  const endpoint = [].concat(req.params.path).join('/');
  if (!TMDB_ALLOWED.some(re => re.test(endpoint))) return res.status(404).json({ error: 'Point d\'accès TMDB non autorisé' });
  const qs = queryFrom(req);
  qs.set('api_key', TMDB_API_KEY);
  relay(res, `https://api.themoviedb.org/3/${endpoint}?${qs}`, 'TMDB');
});

// Proxy OMDb : /api/omdb?t=…&y=… → https://www.omdbapi.com/?t=…&y=…&apikey=…
app.get('/api/omdb', (req, res) => {
  if (!OMDB_API_KEY) return res.status(503).json({ Response: 'False', Error: 'OMDB_API_KEY non configurée sur le serveur' });
  const qs = queryFrom(req);
  qs.set('apikey', OMDB_API_KEY);
  relay(res, `https://www.omdbapi.com/?${qs}`, 'OMDb');
});

// Sert le fichier CineForest (et tout autre fichier statique du dossier public/)
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));
