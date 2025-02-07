// server.js
require('dotenv').config(); // Load variables from .env
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory store for sessions (for demonstration)
const sessions = {};
// sessions[code] = {
//   userA: { genres: [], ratings: {} },
//   userB: { genres: [], ratings: {} },
//   isUserAJoined: false,
//   isUserBJoined: false,
//   movieList: []
// };

// Generate a random session code, e.g. "ABC123"
function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 1) Generate a new session code
app.get('/api/generateCode', (req, res) => {
  let code = generateSessionCode();
  // Ensure it's unique
  while (sessions[code]) {
    code = generateSessionCode();
  }
  // Initialize the session object
  sessions[code] = {
    userA: { genres: [], ratings: {} },
    userB: { genres: [], ratings: {} },
    isUserAJoined: false,
    isUserBJoined: false,
    movieList: []
  };
  return res.json({ code });
});

// 2) Join a session
//    First user is userA, second user is userB, then session is full.
app.post('/api/session/:code/join', (req, res) => {
  const { code } = req.params;
  const session = sessions[code];
  if (!session) {
    return res.status(400).json({ error: 'Session code not found' });
  }

  if (!session.isUserAJoined) {
    session.isUserAJoined = true;
    return res.json({ user: 'userA' });
  } else if (!session.isUserBJoined) {
    session.isUserBJoined = true;
    return res.json({ user: 'userB' });
  } else {
    return res
      .status(400)
      .json({ error: 'Session is full (two users already joined)' });
  }
});

// 3) Save genre preferences for a user
app.post('/api/session/:code/preferences', (req, res) => {
  const { code } = req.params;
  const { user, genres } = req.body; // e.g. { user: 'userA', genres: ['28','35'] }
  const session = sessions[code];
  if (!session || !session[user]) {
    return res.status(400).json({ error: 'Invalid session or user' });
  }

  session[user].genres = genres;
  return res.json({ message: 'Genres updated' });
});

// 4) Fetch a list of movies based on both users' genres (union)
app.get('/api/session/:code/movies', async (req, res) => {
  const { code } = req.params;
  const session = sessions[code];
  if (!session) {
    return res.status(400).json({ error: 'Invalid session code' });
  }

  // Combine userA & userB genres
  const allGenres = new Set([
    ...session.userA.genres,
    ...session.userB.genres
  ]);
  const genresString = Array.from(allGenres).join(',');

  try {
    // Call The Movie Database (TMDb) discover endpoint
    const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
      params: {
        api_key: process.env.TMDB_API_KEY, // Put "TMDB_API_KEY=XXXX" in .env
        with_genres: genresString,
        language: 'en-US',
        sort_by: 'popularity.desc',
        page: 1
      }
    });

    // Store top 10 or 12 results
    session.movieList = response.data.results.slice(0, 10);
    return res.json({ movies: session.movieList });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error fetching movie list' });
  }
});

// 5) Rate a movie
app.post('/api/session/:code/rate', (req, res) => {
  const { code } = req.params;
  const { user, movieId, rating } = req.body;
  const session = sessions[code];

  if (!session || !session[user]) {
    return res.status(400).json({ error: 'Invalid session or user' });
  }

  session[user].ratings[movieId] = rating;
  return res.json({ message: 'Rating saved' });
});

// 6) Get the final recommendation
app.get('/api/session/:code/recommendation', (req, res) => {
  const { code } = req.params;
  const session = sessions[code];
  if (!session || !session.movieList) {
    return res.status(400).json({ error: 'No rated movies or session invalid' });
  }

  const { userA, userB, movieList } = session;

  let bestMovie = null;
  let bestScore = -1;

  // For each movie in the stored list
  for (const movie of movieList) {
    const mId = movie.id;
    const ratingA = userA.ratings[mId] || 0;
    const ratingB = userB.ratings[mId] || 0;
    const combinedScore = (ratingA + ratingB) / 2; // simple average

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestMovie = movie;
    }
  }

  if (bestMovie) {
    return res.json({ recommended: bestMovie });
  } else {
    return res.json({ recommended: null });
  }
});

// Start the server on port 4000
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
