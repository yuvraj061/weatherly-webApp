// script.js

// --- API Keys ---
// WARNING: For a production application, NEVER expose API keys directly in client-side code.
// Use a backend proxy to securely handle API requests.
const weatherApiKey = 'e2ade7a9509fefb52d7e5e5ca3176fc4';
const geoApiKey = '2cca47f6d3msha37241d88982ae7p1f7a13jsn7f09ea023a97'; // RapidAPI key

// --- Global State Variables ---
let isFahrenheit = localStorage.getItem('weatherly-unit') === 'imperial'; // Initialize from localStorage
let currentCityDisplayed = ''; // Keep track of the city currently shown

// --- DOM Elements ---
const cityInput = document.getElementById('cityInput');
const cityList = document.getElementById('cityList');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const unitToggle = document.getElementById('unitToggle');
const darkModeToggle = document.getElementById('darkModeToggle');
const weatherResultDiv = document.getElementById('weatherResult');
const forecastDiv = document.getElementById('forecast');
const recentSearchesDiv = document.getElementById('recentSearches');
const toastDiv = document.getElementById('toast');
const currentYearSpan = document.getElementById('currentYear'); // Added for footer year

// --- Autocomplete Functionality ---
let debounceTimer; // For debouncing city input

cityInput.addEventListener('input', () => {
    const query = cityInput.value.trim();
    if (query.length < 2) {
        cityList.innerHTML = ''; // Clear datalist if query is too short
        return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchCities(query), 300); // Debounce API calls
});

async function fetchCities(query) {
    try {
        const response = await fetch(`https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(query)}&limit=5`, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': geoApiKey,
                'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
            }
        });
        if (!response.ok) {
            throw new Error(`GeoDB API error: ${response.statusText}`);
        }
        const data = await response.json();
        cityList.innerHTML = ''; // Clear previous options

        if (data.data && data.data.length > 0) {
            data.data.forEach(city => {
                const option = document.createElement('option');
                // Use a format that is easily parsed back if needed, but for datalist, simpler is often better.
                // For cityInput value, we might want just city.name
                option.value = `${city.name}, ${city.countryCode}`;
                cityList.appendChild(option);
            });
        }
    } catch (err) {
        console.error("City autocomplete error:", err);
        // showToast("Failed to get city suggestions."); // Uncomment if you want user feedback for autocomplete errors
    }
}

// --- Unit Toggle Functionality ---
unitToggle.addEventListener('change', () => {
    isFahrenheit = unitToggle.checked;
    localStorage.setItem('weatherly-unit', isFahrenheit ? 'imperial' : 'metric'); // Save preference
    // If a city is currently displayed, re-fetch weather with new units
    if (currentCityDisplayed) { // Use currentCityDisplayed for re-fetch
        getWeather(currentCityDisplayed); // Pass the city name to getWeather
    } else {
        showToast(`Units switched to ${isFahrenheit ? 'Fahrenheit' : 'Celsius'}.`, 'info');
    }
});

// --- Dark Mode Functionality ---
darkModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('weatherly-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

// --- Main Weather Fetch Function ---
async function getWeather(cityToSearch = cityInput.value.trim()) {
    if (!cityToSearch) {
        showToast("Please enter a city name.");
        return;
    }

    cityInput.value = cityToSearch; // Ensure input field shows the city being searched

    // Show loading spinner and hide previous results
    weatherResultDiv.innerHTML = `<div class="spinner"></div>`;
    forecastDiv.innerHTML = '';
    weatherResultDiv.classList.remove('hidden'); // Ensure result div is visible
    forecastDiv.classList.remove('hidden'); // Ensure forecast div is visible

    try {
        const unit = isFahrenheit ? 'imperial' : 'metric';
        const unitSymbol = isFahrenheit ? '°F' : '°C';
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityToSearch)}&appid=${weatherApiKey}&units=${unit}`;

        const response = await fetch(weatherUrl);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("City not found. Please check the spelling.");
            } else {
                throw new Error(`Weather API error: ${response.statusText}`);
            }
        }

        const data = await response.json();
        const { name: cityNameActual, main, wind, weather, sys } = data;
        const { temp, feels_like, humidity, pressure } = main;
        const { speed: windSpeed } = wind;
        const { icon, description } = weather[0];

        // OpenWeatherMap wind speed for metric is m/s. Convert to km/h for display.
        const displayWindSpeed = isFahrenheit ? windSpeed.toFixed(1) : (windSpeed * 3.6).toFixed(1);
        const windUnit = isFahrenheit ? 'mph' : 'km/h';

        weatherResultDiv.innerHTML = `
            <div class="weather-card">
                <div class="weather-main">
                    <h2>${cityNameActual}</h2>
                    <img class="weather-icon" src="https://openweathermap.org/img/wn/${icon}@4x.png" alt="${description}">
                    <p class="temperature">${temp.toFixed(1)}${unitSymbol}</p>
                    <p class="description">${capitalize(description)}</p>
                </div>
                <div class="weather-details">
                    <div class="detail-item">
                        <span class="detail-label">Feels Like</span>
                        <span class="detail-value">${feels_like.toFixed(1)}${unitSymbol}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Humidity</span>
                        <span class="detail-value">${humidity}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Wind</span>
                        <span class="detail-value">${displayWindSpeed} ${windUnit}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Pressure</span>
                        <span class="detail-value">${pressure} hPa</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Visibility</span>
                        <span class="detail-value">${(data.visibility / 1000).toFixed(1)} km</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Sunrise</span>
                        <span class="detail-value">${new Date(sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Sunset</span>
                        <span class="detail-value">${new Date(sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>
        `;

        await getForecast(cityNameActual); // Fetch forecast after main weather
        updateRecentSearches(cityNameActual); // Update recent searches with the successful city name
        currentCityDisplayed = cityNameActual; // Set the currently displayed city

    } catch (err) {
        console.error("Error fetching weather:", err);
        weatherResultDiv.innerHTML = `<p class="error-message">${err.message}</p>`;
        forecastDiv.innerHTML = '';
        showToast(`Error: ${err.message}`, 'error');
        currentCityDisplayed = ''; // Clear current displayed city on error
    }
}

// --- 5-Day Forecast Function ---
async function getForecast(city) {
    const unit = isFahrenheit ? 'imperial' : 'metric';
    const unitSymbol = isFahrenheit ? '°F' : '°C';
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${weatherApiKey}&units=${unit}`;

    try {
        const response = await fetch(forecastUrl);
        if (!response.ok) {
            throw new Error(`Forecast API error: ${response.statusText}`);
        }
        const data = await response.json();

        // Group forecast data by day (noon entry for simplicity)
        const dailyForecasts = {};
        data.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const day = date.toISOString().split('T')[0]; // YYYY-MM-DD
            // If it's the first entry for the day, or it's closer to noon than previous, store it
            if (!dailyForecasts[day] || (date.getHours() >= 12 && date.getHours() <= 15)) {
                dailyForecasts[day] = item;
            }
        });

        // Get the next 5 days
        const dayKeys = Object.keys(dailyForecasts).sort().slice(0, 5); // Ensure correct order and limit to 5

        forecastDiv.innerHTML = `<h3 class="forecast-header">5-Day Forecast</h3><div class="forecast-grid"></div>`;
        const forecastGrid = forecastDiv.querySelector('.forecast-grid');

        dayKeys.forEach(day => {
            const item = dailyForecasts[day];
            if (!item) return;

            // To get min/max for the day, you'd need to iterate through all entries for that day again.
            // For simplicity, we'll use the temp from the selected 'item' for now,
            // or modify 'dailyForecasts' to store min/max directly if needed.
            // For robust min/max, you'd want to go back to `groupedForecast` as in previous suggestion.
            // For now, let's keep it simple and just display the temp from `item`.
            const dateString = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const icon = item.weather[0].icon;
            const description = capitalize(item.weather[0].description);
            const temp = item.main.temp.toFixed(1);


            forecastGrid.innerHTML += `
                <div class="forecast-card">
                    <p class="forecast-date">${dateString}</p>
                    <img class="forecast-icon" src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${description}">
                    <p class="forecast-description">${description}</p>
                    <p class="forecast-temp">${temp}${unitSymbol}</p>
                </div>
            `;
        });

    } catch (err) {
        console.error("Forecast error:", err);
        forecastDiv.innerHTML = `<p class="error-message">Could not load 5-day forecast.</p>`;
        showToast("Could not load forecast.", 'error');
    }
}

// --- Geolocation Functionality ---
locationBtn.addEventListener('click', getWeatherByLocation);

async function getWeatherByLocation() {
    if (!navigator.geolocation) {
        showToast("Geolocation not supported by your browser.", 'error');
        return;
    }

    // Show loading spinner
    weatherResultDiv.innerHTML = `<div class="spinner"></div>`;
    forecastDiv.innerHTML = '';
    weatherResultDiv.classList.remove('hidden');
    forecastDiv.classList.remove('hidden');

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const unit = isFahrenheit ? 'imperial' : 'metric';
        const unitSymbol = isFahrenheit ? '°F' : '°C';
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${weatherApiKey}&units=${unit}`;

        try {
            const response = await fetch(weatherUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch weather for your location: ${response.statusText}`);
            }
            const data = await response.json();

            const { name: cityNameActual, main, wind, weather, sys } = data;
            const { temp, feels_like, humidity, pressure } = main;
            const { speed: windSpeed } = wind;
            const { icon, description } = weather[0];

            const displayWindSpeed = isFahrenheit ? windSpeed.toFixed(1) : (windSpeed * 3.6).toFixed(1);
            const windUnit = isFahrenheit ? 'mph' : 'km/h';

            weatherResultDiv.innerHTML = `
                <div class="weather-card">
                    <div class="weather-main">
                        <h2>${cityNameActual}</h2>
                        <img class="weather-icon" src="https://openweathermap.org/img/wn/${icon}@4x.png" alt="${description}">
                        <p class="temperature">${temp.toFixed(1)}${unitSymbol}</p>
                        <p class="description">${capitalize(description)}</p>
                    </div>
                    <div class="weather-details">
                        <div class="detail-item">
                            <span class="detail-label">Feels Like</span>
                            <span class="detail-value">${feels_like.toFixed(1)}${unitSymbol}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Humidity</span>
                            <span class="detail-value">${humidity}%</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Wind</span>
                            <span class="detail-value">${displayWindSpeed} ${windUnit}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Pressure</span>
                            <span class="detail-value">${pressure} hPa</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Visibility</span>
                            <span class="detail-value">${(data.visibility / 1000).toFixed(1)} km</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Sunrise</span>
                            <span class="detail-value">${new Date(sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Sunset</span>
                            <span class="detail-value">${new Date(sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                </div>
            `;
            cityInput.value = cityNameActual; // Populate input with detected city name
            await getForecast(cityNameActual);
            updateRecentSearches(cityNameActual);
            currentCityDisplayed = cityNameActual; // Set the currently displayed city

        } catch (err) {
            console.error("Error fetching weather by location:", err);
            weatherResultDiv.innerHTML = `<p class="error-message">${err.message}</p>`;
            forecastDiv.innerHTML = '';
            showToast(`Error: ${err.message}`, 'error');
            currentCityDisplayed = ''; // Clear current displayed city on error
        }
    }, (error) => {
        // Geolocation error handler
        console.error("Geolocation error:", error);
        weatherResultDiv.innerHTML = '';
        forecastDiv.innerHTML = '';
        let errorMessage = "Location access denied.";
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = "Location access denied. Please enable location services in your browser settings.";
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = "Location information is unavailable.";
                break;
            case error.TIMEOUT:
                errorMessage = "The request to get user location timed out.";
                break;
        }
        showToast(errorMessage, 'error');
        currentCityDisplayed = ''; // Clear current displayed city on error
    }, {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 0 // No cached position
    });
}

// --- Recent Searches Functionality ---
const RECENT_SEARCHES_KEY = 'weatherly-recent-searches'; // A more specific key

function getStoredRecentSearches() {
    try {
        const searches = localStorage.getItem(RECENT_SEARCHES_KEY);
        return searches ? JSON.parse(searches) : [];
    } catch (e) {
        console.error("Error parsing recent searches from localStorage:", e);
        return []; // Return empty array if parsing fails
    }
}

function saveRecentSearches(searches) {
    try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch (e) {
        console.error("Error saving recent searches to localStorage:", e);
    }
}

function updateRecentSearches(city) {
    let searches = getStoredRecentSearches();

    // Remove existing entry for the same city (case-insensitive)
    searches = searches.filter(c => c.toLowerCase() !== city.toLowerCase());

    // Add new city to the beginning
    searches.unshift(city);

    // Limit to 5 recent searches
    if (searches.length > 5) {
        searches = searches.slice(0, 5);
    }
    saveRecentSearches(searches);
    renderRecentSearches();
}

function removeRecentSearch(cityToRemove) {
    let searches = getStoredRecentSearches();
    const initialLength = searches.length;
    
    // Filter out the city to remove (case-insensitive)
    searches = searches.filter(city => city.toLowerCase() !== cityToRemove.toLowerCase());

    if (searches.length < initialLength) { // Only save and re-render if something was removed
        saveRecentSearches(searches);
        renderRecentSearches(); // Re-render the list
        showToast(`'${cityToRemove}' removed from recent searches.`, 'success');
    } else {
        showToast(`Could not find '${cityToRemove}' in recent searches.`, 'error');
    }
}

function clearAllRecentSearches() {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    renderRecentSearches(); // Re-render to clear display
    showToast('All recent searches cleared.', 'success');
}

function renderRecentSearches() {
    const searches = getStoredRecentSearches();
    recentSearchesDiv.innerHTML = ''; // Clear previous content

    if (searches.length === 0) {
        recentSearchesDiv.classList.add('hidden'); // ADDED: Ensure entire section is hidden
        return;
    }

    recentSearchesDiv.classList.remove('hidden'); // Ensure section is visible if there are searches

    const title = document.createElement('h3');
    title.textContent = 'Recent Searches';
    title.classList.add('recent-header');
    recentSearchesDiv.appendChild(title);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('recent-buttons');

    searches.forEach(city => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('recent-item-wrapper');

        const cityBtn = document.createElement('button');
        cityBtn.textContent = city;
        cityBtn.className = 'recent-btn';
        cityBtn.dataset.city = city;
        cityBtn.onclick = () => {
            cityInput.value = city;
            getWeather(city);
        };
        wrapper.appendChild(cityBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.className = 'recent-delete-btn';
        deleteBtn.title = `Remove ${city}`;
        deleteBtn.dataset.cityToDelete = city;
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            removeRecentSearch(e.target.dataset.cityToDelete);
        };
        wrapper.appendChild(deleteBtn);

        buttonsContainer.appendChild(wrapper);
    });
    recentSearchesDiv.appendChild(buttonsContainer);

    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = 'Clear All';
    clearAllBtn.className = 'clear-btn';
    clearAllBtn.onclick = clearAllRecentSearches;
    recentSearchesDiv.appendChild(clearAllBtn);
}


// --- Toast Notification Function ---
function showToast(message, type = 'info') {
    toastDiv.textContent = message;
    toastDiv.className = `toast show ${type}`; // Add type class for styling (e.g., 'error', 'success')

    // Automatically hide after 3 seconds
    setTimeout(() => {
        toastDiv.classList.remove('show');
        // A small delay before adding 'hidden' to allow fade-out animation if any
        setTimeout(() => toastDiv.classList.add('hidden'), 300);
    }, 3000);
}

// --- Helper Functions ---
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Initial Setup and Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // Check for dark mode preference from localStorage
    if (localStorage.getItem('weatherly-theme') === 'dark') {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    } else {
        darkModeToggle.checked = false; // Ensure toggle reflects actual state
    }

    // Initialize unit toggle based on localStorage
    unitToggle.checked = isFahrenheit; // Reflects the `isFahrenheit` state

    // Render recent searches on page load
    renderRecentSearches();

    // Event listener for Search button
    searchBtn.addEventListener('click', () => getWeather()); // Call getWeather without arguments, it will use cityInput.value

    // Allow pressing Enter in the city input to trigger search
    cityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            getWeather();
        }
    });

    // Make sure weather and forecast divs are initially hidden by default, unless content is present
    // These classes are added when content is rendered
    weatherResultDiv.classList.add('hidden');
    forecastDiv.classList.add('hidden');
});