import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [step, setStep] = useState('landing');
  const [sessionCode, setSessionCode] = useState('');
  const [userType, setUserType] = useState(''); // 'userA' or 'userB'
  const [genres, setGenres] = useState([]);
  const [movies, setMovies] = useState([]);
  const [ratings, setRatings] = useState({});
  const [recommended, setRecommended] = useState(null);

  // 1) Generate session code (then show it, wait for user to press 'Next')
  const handleGenerateCode = async () => {
    try {
      const res = await axios.get('https://my-moviepicker.onrender.com/api/generateCode');
      setSessionCode(res.data.code);
      setStep('showCode');
    } catch (err) {
      console.error(err);
    }
  };

  // 2) Once we see the code and press "Next", join as userA
  const handleJoinAsUserA = async () => {
    try {
      const joinRes = await axios.post(`https://my-moviepicker.onrender.com/api/session/${sessionCode}/join`);
      setUserType(joinRes.data.user);
      setStep('genres');
    } catch (err) {
      console.error(err);
      alert('Could not join session. Try again.');
    }
  };

  // 3) Join an existing code (likely for user B)
  const handleJoinCode = async () => {
    try {
      const joinRes = await axios.post(`https://my-moviepicker.onrender.com/api/session/${sessionCode}/join`);
      setUserType(joinRes.data.user);
      setStep('genres');
    } catch (err) {
      alert('Error joining session. Check code or if session is full.');
      console.error(err);
    }
  };

  // 4) Save selected genres
  const handleSaveGenres = async () => {
    try {
      await axios.post(`https://my-moviepicker.onrender.com/api/session/${sessionCode}/preferences`, {
        user: userType,
        genres,
      });
      setStep('fetchMovies');
    } catch (err) {
      console.error(err);
    }
  };

  // 5) Fetch movies
  const handleFetchMovies = async () => {
    try {
      const res = await axios.get(`https://my-moviepicker.onrender.com/api/session/${sessionCode}/movies`);
      setMovies(res.data.movies);
      setStep('rateMovies');
    } catch (err) {
      console.error(err);
    }
  };

  // 6) Rate a movie (update local state & notify server)
  const handleRate = async (movieId, ratingValue) => {
    // Update local ratings state
    setRatings(prev => ({ ...prev, [movieId]: ratingValue }));

    // Send rating to server
    try {
      await axios.post(`https://my-moviepicker.onrender.com/api/session/${sessionCode}/rate`, {
        user: userType,
        movieId,
        rating: ratingValue,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 7) Get final recommendation
  const handleGetRecommendation = async () => {
    try {
      const res = await axios.get(`https://my-moviepicker.onrender.com/api/session/${sessionCode}/recommendation`);
      setRecommended(res.data.recommended);
      setStep('final');
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle a genre in local state
  const toggleGenre = (id) => {
    setGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  // RENDER UI
  return (
    <div style={{ padding: '20px' }}>
      {/* Show session code at the top if it exists */}
      {sessionCode && (
        <div style={{ background: '#eee', padding: '10px', marginBottom: '20px' }}>
          <strong>Session Code:</strong> {sessionCode}
        </div>
      )}

      {step === 'landing' && (
        <div>
          <h1>Two-Person Movie Picker</h1>
          <button onClick={handleGenerateCode}>Generate Code</button>
          <div style={{ marginTop: '20px' }}>
            <input
              type="text"
              placeholder="Enter code"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
            />
            <button onClick={handleJoinCode}>Join Existing Code</button>
          </div>
        </div>
      )}

      {step === 'showCode' && (
        <div>
          <h2>Here is your generated code:</h2>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{sessionCode}</p>
          <p>Share this code with your friend so they can join.</p>
          <button onClick={handleJoinAsUserA}>Next</button>
        </div>
      )}

      {step === 'genres' && (
        <div>
          <h2>Select Your Genres</h2>
          {/* Example genre IDs from TMDb: 28(Action), 35(Comedy), 18(Drama), 878(Sci-Fi), 10749(Romance) */}
          <div>
            <label>
              <input
                type="checkbox"
                checked={genres.includes('28')}
                onChange={() => toggleGenre('28')}
              />
              Action
            </label>
            <br />
            <label>
              <input
                type="checkbox"
                checked={genres.includes('35')}
                onChange={() => toggleGenre('35')}
              />
              Comedy
            </label>
            <br />
            <label>
              <input
                type="checkbox"
                checked={genres.includes('18')}
                onChange={() => toggleGenre('18')}
              />
              Drama
            </label>
            <br />
            <label>
              <input
                type='checkbox'
                checked={genres.includes('878')}
                onChange={() => toggleGenre('878')}
              />
              Sci-Fi
            </label>
            <br />
            <label>
              <input
                type='checkbox'
                checked={genres.includes('10749')}
                onChange={() => toggleGenre('10749')}
              />
              Romance
            </label>
          </div>
          <button onClick={handleSaveGenres} style={{ marginTop: '10px' }}>
            Save Genres
          </button>
        </div>
      )}

      {step === 'fetchMovies' && (
        <div>
          <h2>Ready to fetch movies?</h2>
          <button onClick={handleFetchMovies}>Fetch Movies</button>
        </div>
      )}

      {step === 'rateMovies' && (
        <div>
          <h2>Rate These Movies</h2>
          {movies.map(movie => {
            const userRating = ratings[movie.id] || 0;
            return (
              <div key={movie.id} style={{ border: '1px solid #ccc', marginBottom: '10px', padding: '10px' }}>
                <h3>
                  {movie.title} ({movie.release_date?.substring(0, 4)})
                </h3>
                {movie.poster_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                    alt={movie.title}
                    style={{ display: 'block', marginBottom: '10px' }}
                  />
                )}
                <p>{movie.overview}</p>

                {/* 5-star rating buttons */}
                {[1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => handleRate(movie.id, r)}
                    style={{
                      marginRight: '5px',
                      backgroundColor: userRating === r ? '#d4edda' : ''
                    }}
                  >
                    {r} ★
                  </button>
                ))}
                <p>Current rating: {userRating || 'Not rated'}</p>
              </div>
            );
          })}
          <button onClick={handleGetRecommendation}>Get Recommendation</button>
        </div>
      )}

      {step === 'final' && (
        <div>
          <h2>Your Recommendation</h2>
          {recommended ? (
            <div style={{ border: '1px solid #ccc', padding: '10px' }}>
              <h3>{recommended.title}</h3>
              {recommended.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w200${recommended.poster_path}`}
                  alt={recommended.title}
                  style={{ display: 'block', marginBottom: '10px' }}
                />
              )}
              <p>{recommended.overview}</p>
            </div>
          ) : (
            <p>No good match found or no ratings were given.</p>
          )}

          <button onClick={() => window.location.reload()}>
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
