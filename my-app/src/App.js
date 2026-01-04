import { useState } from 'react';
import './App.css';

const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function App() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(0);
  const [searchHistory, setSearchHistory] = useState([]);
  const [forecast, setForecast] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError('Enter a city to see the weather.');
      setResult(null);
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          trimmedQuery
        )}&count=1&language=en&format=json`
      );

      if (!geoResponse.ok) {
        throw new Error('Could not reach the location service.');
      }

      const geoData = await geoResponse.json();

      if (!geoData.results || geoData.results.length === 0) {
        setError('No matching city found.');
        setResult(null);
        setStatus('idle');
        return;
      }

      const [{ latitude, longitude, country, name, timezone }] = geoData.results;

      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=${encodeURIComponent(
          timezone
        )}`
      );

      if (!weatherResponse.ok) {
        throw new Error('Could not reach the weather service.');
      }

      const weatherData = await weatherResponse.json();
      const current = weatherData.current;

      if (!current) {
        throw new Error('Weather data is missing.');
      }

      setResult({
        location: `${name}, ${country}`,
        temperature: current.temperature_2m,
        feelsLike: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        code: current.weather_code,
        timestamp: current.time,
      });

      // Process 7-day forecast data
      if (weatherData.daily) {
        const forecastDays = weatherData.daily.time.map((date, index) => ({
          date,
          weatherCode: weatherData.daily.weather_code[index],
          maxTemp: weatherData.daily.temperature_2m_max[index],
          minTemp: weatherData.daily.temperature_2m_min[index],
          precipitationProb: weatherData.daily.precipitation_probability_max[index],
          windSpeed: weatherData.daily.wind_speed_10m_max[index],
        }));
        setForecast(forecastDays);
      }

      // Add to search history (keep only last 5 unique entries)
      setSearchHistory((prevHistory) => {
        const newHistory = [name, ...prevHistory.filter((city) => city !== name)];
        return newHistory.slice(0, 5);
      });

      setStatus('success');
    } catch (fetchError) {
      setError(fetchError.message || 'Something went wrong.');
      setResult(null);
      setForecast(null);
      setStatus('error');
    }
  };

  const readableCondition = result ? WEATHER_CODES[result.code] ?? 'Unknown conditions' : '';

  const handleIncrement = () => {
    setCount((current) => current + 1);
  };

  const handleHistoryClick = (city) => {
    setQuery(city);
  };

  return (
    <div className="app">
      <header className="navbar" role="banner">
        <div className="brand">Weather Now</div>
        <nav aria-label="Primary">
          <ul>
            <li>
              <a href="#search">Search</a>
            </li>
            <li>
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <h1 className="title">Weather Now</h1>
      <form id="search" className="search" onSubmit={handleSubmit}>
        <label htmlFor="city" className="hidden-label">
          City name
        </label>
        <input
          id="city"
          type="text"
          value={query}
          placeholder="Search for a city"
          onChange={(event) => setQuery(event.target.value)}
          disabled={status === 'loading'}
        />
        <button type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Searching…' : 'Check weather'}
        </button>
      </form>

      <section className="counter" aria-live="polite">
        <p className="counter-label">Button clicks</p>
        <div className="counter-display">{count}</div>
        <button type="button" className="counter-button" onClick={handleIncrement}>
          Increment
        </button>
      </section>

      {searchHistory.length > 0 && (
        <section className="search-history">
          <h3>Recent Searches</h3>
          <div className="history-buttons">
            {searchHistory.map((city, index) => (
              <button
                key={`${city}-${index}`}
                type="button"
                className="history-button"
                onClick={() => handleHistoryClick(city)}
              >
                {city}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <p className="message error">{error}</p>}

      {status === 'success' && result && (
        <section className="card" aria-live="polite">
          <header>
            <h2>{result.location}</h2>
            <p className="timestamp">Updated at {new Date(result.timestamp).toLocaleString()}</p>
          </header>
          <div className="primary">
            <p className="temperature">{Math.round(result.temperature)}°C</p>
            <p className="condition">{readableCondition}</p>
          </div>
          <dl className="details">
            <div>
              <dt>Feels like</dt>
              <dd>{Math.round(result.feelsLike)}°C</dd>
            </div>
            <div>
              <dt>Humidity</dt>
              <dd>{Math.round(result.humidity)}%</dd>
            </div>
            <div>
              <dt>Wind</dt>
              <dd>{Math.round(result.windSpeed)} km/h</dd>
            </div>
          </dl>
        </section>
      )}

      {status === 'success' && forecast && forecast.length > 0 && (
        <section className="forecast-section">
          <h2 className="forecast-title">7-Day Forecast</h2>
          <div className="forecast-grid">
            {forecast.map((day, index) => {
              const date = new Date(day.date);
              const dayName = index === 0 
                ? 'Today' 
                : date.toLocaleDateString('en-US', { weekday: 'short' });
              const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const condition = WEATHER_CODES[day.weatherCode] ?? 'Unknown';
              
              return (
                <div key={day.date} className="forecast-card">
                  <div className="forecast-day">
                    <strong>{dayName}</strong>
                    <span className="forecast-date">{monthDay}</span>
                  </div>
                  <div className="forecast-condition">{condition}</div>
                  <div className="forecast-temps">
                    <span className="temp-high">{Math.round(day.maxTemp)}°</span>
                    <span className="temp-divider">/</span>
                    <span className="temp-low">{Math.round(day.minTemp)}°</span>
                  </div>
                  <div className="forecast-details">
                    <div className="forecast-detail">
                      <span className="detail-icon">💧</span>
                      <span>{day.precipitationProb ?? 0}%</span>
                    </div>
                    <div className="forecast-detail">
                      <span className="detail-icon">💨</span>
                      <span>{Math.round(day.windSpeed)} km/h</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {status === 'idle' && !result && !error && (
        <p className="message">Look up any city to see its current conditions.</p>
      )}
    </div>
  );
}

export default App;
