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
  
  // Weather comparison feature state
  const [compareMode, setCompareMode] = useState(false);
  const [city1Query, setCity1Query] = useState('');
  const [city2Query, setCity2Query] = useState('');
  const [compareStatus, setCompareStatus] = useState('idle');
  const [compareError, setCompareError] = useState('');
  const [compareResults, setCompareResults] = useState({ city1: null, city2: null });

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

  // Fetch weather for a single city (helper function for comparison)
  const fetchWeatherForCity = async (cityName) => {
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        cityName
      )}&count=1&language=en&format=json`
    );

    if (!geoResponse.ok) {
      throw new Error('Could not reach the location service.');
    }

    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`No matching city found for "${cityName}".`);
    }

    const [{ latitude, longitude, country, name, timezone }] = geoData.results;

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=${encodeURIComponent(
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

    return {
      location: `${name}, ${country}`,
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      code: current.weather_code,
      timestamp: current.time,
    };
  };

  const handleCompare = async (event) => {
    event.preventDefault();
    const trimmedCity1 = city1Query.trim();
    const trimmedCity2 = city2Query.trim();

    if (!trimmedCity1 || !trimmedCity2) {
      setCompareError('Please enter both cities to compare.');
      setCompareResults({ city1: null, city2: null });
      return;
    }

    setCompareStatus('loading');
    setCompareError('');

    try {
      const [result1, result2] = await Promise.all([
        fetchWeatherForCity(trimmedCity1),
        fetchWeatherForCity(trimmedCity2),
      ]);

      setCompareResults({ city1: result1, city2: result2 });
      setCompareStatus('success');
    } catch (fetchError) {
      setCompareError(fetchError.message || 'Something went wrong.');
      setCompareResults({ city1: null, city2: null });
      setCompareStatus('error');
    }
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setCompareError('');
    setCompareResults({ city1: null, city2: null });
    setCompareStatus('idle');
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
              <a href="#compare" onClick={(e) => { e.preventDefault(); toggleCompareMode(); }}>
                Compare
              </a>
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

      {/* Mode Toggle */}
      <div className="mode-indicator">
        {compareMode ? '🔄 Comparison Mode' : '🔍 Single Search Mode'}
      </div>

      {!compareMode ? (
        <>
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
        </>
      ) : (
        <>
          <form id="compare" className="compare-form" onSubmit={handleCompare}>
            <div className="compare-inputs">
              <div className="compare-input-group">
                <label htmlFor="city1" className="compare-label">
                  First City
                </label>
                <input
                  id="city1"
                  type="text"
                  value={city1Query}
                  placeholder="Enter first city"
                  onChange={(event) => setCity1Query(event.target.value)}
                  disabled={compareStatus === 'loading'}
                />
              </div>
              <div className="compare-vs">VS</div>
              <div className="compare-input-group">
                <label htmlFor="city2" className="compare-label">
                  Second City
                </label>
                <input
                  id="city2"
                  type="text"
                  value={city2Query}
                  placeholder="Enter second city"
                  onChange={(event) => setCity2Query(event.target.value)}
                  disabled={compareStatus === 'loading'}
                />
              </div>
            </div>
            <button type="submit" disabled={compareStatus === 'loading'}>
              {compareStatus === 'loading' ? 'Comparing…' : 'Compare Weather'}
            </button>
          </form>
        </>
      )}

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

      {!compareMode && error && <p className="message error">{error}</p>}
      {compareMode && compareError && <p className="message error">{compareError}</p>}

      {/* Comparison Results */}
      {compareMode && compareStatus === 'success' && compareResults.city1 && compareResults.city2 && (
        <section className="comparison-section">
          <h2 className="comparison-title">Weather Comparison</h2>
          <div className="comparison-grid">
            {/* City 1 */}
            <div className="comparison-card">
              <header>
                <h3>{compareResults.city1.location}</h3>
                <p className="timestamp">
                  {new Date(compareResults.city1.timestamp).toLocaleString()}
                </p>
              </header>
              <div className="primary">
                <p className="temperature">{Math.round(compareResults.city1.temperature)}°C</p>
                <p className="condition">
                  {WEATHER_CODES[compareResults.city1.code] ?? 'Unknown conditions'}
                </p>
              </div>
              <dl className="details">
                <div>
                  <dt>Feels like</dt>
                  <dd>{Math.round(compareResults.city1.feelsLike)}°C</dd>
                </div>
                <div>
                  <dt>Humidity</dt>
                  <dd>{Math.round(compareResults.city1.humidity)}%</dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>{Math.round(compareResults.city1.windSpeed)} km/h</dd>
                </div>
              </dl>
            </div>

            {/* Comparison Stats */}
            <div className="comparison-stats">
              <h4>Difference</h4>
              <div className="stat-item">
                <span className="stat-label">Temperature</span>
                <span className="stat-value">
                  {Math.abs(compareResults.city1.temperature - compareResults.city2.temperature).toFixed(1)}°C
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Humidity</span>
                <span className="stat-value">
                  {Math.abs(compareResults.city1.humidity - compareResults.city2.humidity).toFixed(1)}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Wind Speed</span>
                <span className="stat-value">
                  {Math.abs(compareResults.city1.windSpeed - compareResults.city2.windSpeed).toFixed(1)} km/h
                </span>
              </div>
              <div className="stat-highlight">
                {compareResults.city1.temperature > compareResults.city2.temperature
                  ? `${compareResults.city1.location.split(',')[0]} is warmer`
                  : compareResults.city1.temperature < compareResults.city2.temperature
                  ? `${compareResults.city2.location.split(',')[0]} is warmer`
                  : 'Same temperature'}
              </div>
            </div>

            {/* City 2 */}
            <div className="comparison-card">
              <header>
                <h3>{compareResults.city2.location}</h3>
                <p className="timestamp">
                  {new Date(compareResults.city2.timestamp).toLocaleString()}
                </p>
              </header>
              <div className="primary">
                <p className="temperature">{Math.round(compareResults.city2.temperature)}°C</p>
                <p className="condition">
                  {WEATHER_CODES[compareResults.city2.code] ?? 'Unknown conditions'}
                </p>
              </div>
              <dl className="details">
                <div>
                  <dt>Feels like</dt>
                  <dd>{Math.round(compareResults.city2.feelsLike)}°C</dd>
                </div>
                <div>
                  <dt>Humidity</dt>
                  <dd>{Math.round(compareResults.city2.humidity)}%</dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>{Math.round(compareResults.city2.windSpeed)} km/h</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      )}

      {!compareMode && status === 'success' && result && (
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

      {!compareMode && status === 'success' && forecast && forecast.length > 0 && (
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

      {!compareMode && status === 'idle' && !result && !error && (
        <p className="message">Look up any city to see its current conditions.</p>
      )}

      {compareMode && compareStatus === 'idle' && !compareResults.city1 && !compareError && (
        <p className="message">Enter two cities to compare their weather conditions.</p>
      )}
    </div>
  );
}

export default App;
