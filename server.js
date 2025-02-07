// server.js
require('dotenv').config(); // Loads variables from .env if available
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store for sessions (for demo only)
const sessions = {};
// sessions = {
//   'ABC123': {
//       userA: { genres: [], ratings: {}, releaseYear: number },
//       userB: { genres: [], ratings: {}, releaseYear: number },
//       isUserAJoined: false,
//       isUserBJoined: false,
//       movieList: []
//   }
// }

// Generate random code helper
function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase(); 
  // e.g., "ABC123"
}

// 1) Endpoint to generate a new session code
app.get('/api/generateCode', (req, res) => {
  let code = generateSessionCode();
  // Make sure code is unique (very basic approach)
  while (sessions[code]) {
    code = generateSessionCode();
  }
  // Initialize session object
  sessions[code] = {
    userA: { genres: [], ratings: {} },
    userB: { genres: [], ratings: {} },
    isUserAJoined: false,
    isUserBJoined: false,
    movieList: []
  };
  res.json({ code });
});

// 2) Endpoint to "join" a session
//    We assume the first user to join is userA, second is userB.
app.post('/api/session/:code/join', (req, res) => {
  const { code } = req.params;
  const session = sessions[code];
  
  if (!session) {
    return res.status(400).json({ error: 'Session code not found' });
  }

  // Determine if userA or userB is joining
  if (!session.isUserAJoined) {
    session.isUserAJoined = true;
    return res.json({ user: 'userA' });
  } else if (!session.isUserBJoined) {
    session.isUserBJoined = true;
    return res.json({ user: 'userB' });
  } else {
    return res.status(400).json({ error: 'Session is full (two users already joined)' });
  }
});

// 3) Endpoint to save genre preferences (and release year) for a user
app.post('/api/session/:code/preferences', (req, res) => {
  const { code } = req.params;
  const { user, genres, releaseYear } = req.body; // e.g., { user: 'userA', genres: ['28','35'], releaseYear: "2000" }
  const session = sessions[code];

  if (!session || !session[user]) {
    return res.status(400).json({ error: 'Invalid session or user' });
  }

  session[user].genres = genres;
  if (releaseYear) {
    session[user].releaseYear = parseInt(releaseYear, 10);
  }
  res.json({ message: 'Preferences updated' });
});

// 4) Endpoint to fetch a list of movies based on the union of both users' genres and release year filter
app.get('/api/session/:code/movies', async (req, res) => {
  const { code } = req.params;
  const session = sessions[code];
  if (!session) {
    return res.status(400).json({ error: 'Invalid session code' });
  }

  // Combine genres from both users
  const allGenres = new Set([...session.userA.genres, ...session.userB.genres]);
  const genresString = Array.from(allGenres).join(',');

  // Determine the release year filter.
  // If one user chooses a year and the other does too, we use the lower (more restrictive) value.
  const releaseYearA = session.userA.releaseYear || Infinity;
  const releaseYearB = session.userB.releaseYear || Infinity;
  const finalYear = Math.min(releaseYearA, releaseYearB);

  // Build parameters for TMDb discover endpoint
  const params = {
    api_key: process.env.TMDB_API_KEY, // put your TMDb key in .env
    with_genres: genresString,
    language: 'en-US',
    sort_by: 'popularity.desc',
    page: 1
  };

  // If a valid year is provided (i.e. not Infinity), filter movies released on or before that year.
  if (finalYear !== Infinity) {
    // Format: YYYY-12-31
    params['primary_release_date.lte'] = `${finalYear}-12-31`;
  }

  try {
    const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
      params
    });

    // Save the movie list in the session for reference
    session.movieList = response.data.results.slice(0, 12); // take top 12 for rating
    res.json({ movies: session.movieList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching movie list' });
  }
});

// 5) Endpoint to receive a rating
//    e.g. { user: 'userA', movieId: 12345, rating: 4 }
app.post('/api/session/:code/rate', (req, res) => {
  const { code } = req.params;
  const { user, movieId, rating } = req.body;
  const session = sessions[code];

  if (!session || !session[user]) {
    return res.status(400).json({ error: 'Invalid session or user' });
  }

  session[user].ratings[movieId] = rating; 
  res.json({ message: 'Rating saved' });
});

// 6) Endpoint to get the final recommendation (only after both users have rated every movie)
app.get('/api/session/:code/recommendation', (req, res) => {
  const { code } = req.params;
  const session = sessions[code];

  if (!session || !session.movieList) {
    return res.status(400).json({ error: 'No movie list available or session invalid' });
  }

  const movieList = session.movieList;

  // Check that both users have rated every movie in the list.
  const allMoviesRatedByUserA = movieList.every(movie =>
    session.userA.ratings.hasOwnProperty(movie.id)
  );
  const allMoviesRatedByUserB = movieList.every(movie =>
    session.userB.ratings.hasOwnProperty(movie.id)
  );

  if (!allMoviesRatedByUserA || !allMoviesRatedByUserB) {
    return res.status(400).json({ error: 'Both users have not finished rating yet' });
  }

  let bestMovie = null;
  let bestScore = -1;
  for (const movie of movieList) {
    const mId = movie.id;
    const ratingA = session.userA.ratings[mId] || 0;
    const ratingB = session.userB.ratings[mId] || 0;
    const combinedScore = (ratingA + ratingB) / 2; // simple average
    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestMovie = movie;
    }
  }

  if (bestMovie) {
    return res.json({ recommended: bestMovie });
  } else {
    return res.json({ message: 'No ratings found to make a recommendation' });
  }
});

// Start server on port 4000 (example)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
