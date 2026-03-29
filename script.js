// FilmFlip - Movie Randomizer for GitHub Pages
// Uses TMDb API for movie data

// ============================================
// 🔑 ВСТАВЬТЕ ВАШ API КЛЮЧ НИЖЕ
// ============================================
const API_KEY = 'YOUR_TMDB_API_KEY_HERE'; // Замените на ваш API ключ от TMDb
// ============================================

// Configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const LANGUAGE = 'ru-RU';
const REGION = 'RU';

// TMDb Genre IDs mapping (Russian -> ID)
const GENRE_IDS = {
    'Боевик': 28,
    'Приключения': 12,
    'Анимация': 16,
    'Комедия': 35,
    'Криминал': 80,
    'Документальный': 99,
    'Драма': 18,
    'Семейный': 10751,
    'Фэнтези': 14,
    'История': 36,
    'Ужасы': 27,
    'Музыка': 10402,
    'Мистика': 9648,
    'Мелодрама': 10749,
    'Фантастика': 878,
    'Триллер': 53,
    'Военный': 10752,
    'Вестерн': 37
};

// State
let apiKey = API_KEY !== 'YOUR_TMDB_API_KEY_HERE' ? API_KEY : (localStorage.getItem('tmdb_api_key') || '');
let genres = [];
let currentMovie = null;

// DOM Elements
const elements = {
    genreSelect: document.getElementById('genreSelect'),
    decadeSelect: document.getElementById('decadeSelect'),
    ratingSlider: document.getElementById('ratingSlider'),
    ratingValue: document.getElementById('ratingValue'),
    findMovieBtn: document.getElementById('findMovieBtn'),
    luckyBtn: document.getElementById('luckyBtn'),
    filtersSection: document.getElementById('filtersSection'),
    loader: document.getElementById('loader'),
    errorMessage: document.getElementById('errorMessage'),
    movieCard: document.getElementById('movieCard'),
    moviePoster: document.getElementById('moviePoster'),
    movieRating: document.getElementById('movieRating'),
    movieTitle: document.getElementById('movieTitle'),
    movieOriginalTitle: document.getElementById('movieOriginalTitle'),
    movieYear: document.getElementById('movieYear'),
    movieGenres: document.getElementById('movieGenres'),
    movieOverview: document.getElementById('movieOverview'),
    expandOverviewBtn: document.getElementById('expandOverviewBtn'),
    watchProviders: document.getElementById('watchProviders'),
    providersList: document.getElementById('providersList'),
    trailerBtn: document.getElementById('trailerBtn'),
    anotherMovieBtn: document.getElementById('anotherMovieBtn'),
    shareBtn: document.getElementById('shareBtn'),
    shareToast: document.getElementById('shareToast')
};

// Initialize app
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Check if API key exists
    if (!apiKey) {
        showApiInstructions();
    } else {
        await loadGenres();
    }

    // Setup event listeners
    setupEventListeners();
}

function showApiInstructions() {
    // Show message that API key is needed
    elements.filtersSection.classList.add('hidden');
    showError('⚠️ Для работы сайта нужен API ключ от TMDb. Откройте script.js и вставьте ваш ключ в переменную API_KEY.<br><br><a href="https://www.themoviedb.org/settings/api" target="_blank" style="color: var(--accent-primary);">Получить API ключ</a>');
}

function setupEventListeners() {
    // Rating slider
    elements.ratingSlider.addEventListener('input', (e) => {
        elements.ratingValue.textContent = e.target.value;
    });

    // Find movie buttons
    elements.findMovieBtn.addEventListener('click', () => findMovie(false));
    elements.luckyBtn.addEventListener('click', () => findMovie(true));
    elements.anotherMovieBtn.addEventListener('click', () => findMovie(false));

    // Movie card actions
    elements.trailerBtn.addEventListener('click', openTrailer);
    elements.expandOverviewBtn.addEventListener('click', toggleOverview);
    elements.shareBtn.addEventListener('click', shareMovie);
}

async function loadGenres() {
    try {
        const response = await fetch(`${TMDB_BASE_URL}/genre/movie/list?api_key=${apiKey}&language=${LANGUAGE}`);
        const data = await response.json();
        
        if (data.genres) {
            genres = data.genres;
            populateGenreSelect();
        }
    } catch (error) {
        console.error('Error loading genres:', error);
        showError('Ошибка загрузки жанров. Проверьте API ключ.');
    }
}

function populateGenreSelect() {
    elements.genreSelect.innerHTML = '<option value="">Любой жанр</option>';
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.id;
        option.textContent = genre.name;
        elements.genreSelect.appendChild(option);
    });
}

async function findMovie(isLucky = false) {
    if (!apiKey) {
        showApiInstructions();
        return;
    }

    // Show loader, hide previous results
    showLoader();
    hideError();
    elements.movieCard.classList.add('hidden');

    try {
        let movieId;
        
        if (isLucky) {
            // Completely random movie - try multiple pages to find something
            for (let attempt = 0; attempt < 3; attempt++) {
                const randomPage = Math.floor(Math.random() * 100) + 1;
                const discoverUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&language=${LANGUAGE}&sort_by=popularity.desc&page=${randomPage}`;
                const response = await fetch(discoverUrl);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const randomIndex = Math.floor(Math.random() * data.results.length);
                    movieId = data.results[randomIndex].id;
                    break;
                }
            }
        } else {
            // Filtered random movie with 3 attempts expanding filters
            movieId = await findMovieWithFilterExpansion();
        }

        if (movieId) {
            await loadMovieDetails(movieId);
        } else {
            // Fallback: show popular movies
            await showFallbackPopularMovies();
        }

    } catch (error) {
        console.error('Error finding movie:', error);
        showError(error.message || 'Произошла ошибка при поиске фильма');
    }
}

/**
 * Поиск фильма с постепенным расширением фильтров (3 попытки)
 */
async function findMovieWithFilterExpansion() {
    const selectedGenre = elements.genreSelect.value;
    const selectedDecade = elements.decadeSelect.value;
    const minRating = parseFloat(elements.ratingSlider.value);
    
    // Попытка 1: С точными фильтрами
    let movieId = await searchMovieWithFilters(selectedGenre, selectedDecade, minRating, true);
    if (movieId) return movieId;
    
    // Попытка 2: Без ограничения по рейтингу
    movieId = await searchMovieWithFilters(selectedGenre, selectedDecade, 0, true);
    if (movieId) return movieId;
    
    // Попытка 3: Только по жанру (игнорируя год)
    if (selectedGenre) {
        movieId = await searchMovieWithFilters(selectedGenre, '', 0, true);
        if (movieId) return movieId;
    }
    
    // Если ничего не найдено - возвращаем null для показа fallback
    return null;
}

/**
 * Поиск фильма с указанными фильтрами
 * @param {string} genre - ID жанра
 * @param {string} decade - Десятилетие
 * @param {number} minRating - Минимальный рейтинг
 * @param {boolean} useGenreMapping - Использовать маппинг русских названий в ID
 */
async function searchMovieWithFilters(genre, decade, minRating, useGenreMapping = false) {
    const params = new URLSearchParams({
        api_key: apiKey,
        language: LANGUAGE,
        sort_by: 'popularity.desc',
        'vote_count.gte': '50', // Минимальное количество голосов
        include_adult: 'false'
    });

    // Add genre filter
    if (genre) {
        let genreId = genre;
        // If using Russian genre names, convert to ID
        if (useGenreMapping && GENRE_IDS[genre]) {
            genreId = GENRE_IDS[genre];
        }
        params.append('with_genres', genreId);
    }

    // Add decade filter
    if (decade) {
        const startYear = decade;
        const endYear = parseInt(decade) + 9;
        params.append('primary_release_date.gte', `${startYear}-01-01`);
        params.append('primary_release_date.lte', `${endYear}-12-31`);
    }

    // Add rating filter
    if (minRating > 0) {
        params.append('vote_average.gte', minRating);
    }

    // Get random page from 1 to 100
    const randomPage = Math.floor(Math.random() * 100) + 1;
    params.append('page', randomPage);

    const discoverUrl = `${TMDB_BASE_URL}/discover/movie?${params.toString()}`;
    const response = await fetch(discoverUrl);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.results.length);
        return data.results[randomIndex].id;
    }
    
    return null;
}

/**
 * Показывает 5 случайных популярных фильмов как fallback
 */
async function showFallbackPopularMovies() {
    hideLoader();
    
    const popularUrl = `${TMDB_BASE_URL}/movie/popular?api_key=${apiKey}&language=${LANGUAGE}&page=1`;
    const response = await fetch(popularUrl);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
        // Pick random movie from popular
        const randomIndex = Math.floor(Math.random() * Math.min(5, data.results.length));
        const movieId = data.results[randomIndex].id;
        await loadMovieDetails(movieId);
    } else {
        showError('😕 К сожалению, ничего не найдено.<br><br><strong>Советы:</strong><br>• Попробуйте выбрать другой жанр<br>• Расширьте диапазон лет<br>• Уменьшите минимальный рейтинг');
    }
}

async function loadMovieDetails(movieId) {
    try {
        // Fetch movie details
        const detailsResponse = await fetch(
            `${TMDB_BASE_URL}/movie/${movieId}?api_key=${apiKey}&language=${LANGUAGE}&append_to_response=videos,watch/providers`
        );
        const movie = await detailsResponse.json();

        if (movie.success === false) {
            throw new Error(movie.status_message || 'Фильм не найден');
        }

        currentMovie = movie;
        displayMovie(movie);

    } catch (error) {
        console.error('Error loading movie details:', error);
        showError('Ошибка загрузки информации о фильме');
    }
}

function displayMovie(movie) {
    // Hide loader
    hideLoader();

    // Poster
    const posterPath = movie.poster_path 
        ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}`
        : 'https://via.placeholder.com/500x750?text=No+Poster';
    elements.moviePoster.src = posterPath;
    elements.moviePoster.alt = movie.title || 'Постер фильма';

    // Rating
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    elements.movieRating.textContent = `⭐ ${rating}`;

    // Title
    elements.movieTitle.textContent = movie.title || 'Без названия';
    
    // Original title (if different)
    if (movie.original_title && movie.original_title !== movie.title) {
        elements.movieOriginalTitle.textContent = movie.original_title;
        elements.movieOriginalTitle.classList.remove('hidden');
    } else {
        elements.movieOriginalTitle.classList.add('hidden');
    }

    // Year
    const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
    elements.movieYear.textContent = year;

    // Genres
    elements.movieGenres.innerHTML = '';
    if (movie.genres && movie.genres.length > 0) {
        movie.genres.forEach(genre => {
            const tag = document.createElement('span');
            tag.className = 'genre-tag';
            tag.textContent = genre.name;
            elements.movieGenres.appendChild(tag);
        });
    }

    // Overview
    elements.movieOverview.textContent = movie.overview || 'Описание отсутствует';
    elements.movieOverview.classList.remove('expanded');
    elements.expandOverviewBtn.textContent = 'Читать полностью';

    // Watch providers
    displayWatchProviders(movie);

    // Store trailer info
    currentMovie.videos = movie.videos;

    // Show card
    elements.movieCard.classList.remove('hidden');
    
    // Scroll to card
    elements.movieCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function displayWatchProviders(movie) {
    const providers = movie.watch_providers?.results?.[REGION];
    
    if (providers && (providers.flatrate || providers.rent || providers.buy)) {
        elements.watchProviders.classList.remove('hidden');
        elements.providersList.innerHTML = '';

        const allProviders = [
            ...(providers.flatrate || []),
            ...(providers.rent || []),
            ...(providers.buy || [])
        ];

        // Remove duplicates
        const uniqueProviders = allProviders.filter((provider, index, self) =>
            index === self.findIndex(p => p.provider_id === provider.provider_id)
        );

        // Limit to 6 providers
        uniqueProviders.slice(0, 6).forEach(provider => {
            const item = document.createElement('div');
            item.className = 'provider-item';
            
            const logo = document.createElement('img');
            logo.className = 'provider-logo';
            logo.src = `${TMDB_IMAGE_BASE}/w92${provider.logo_path}`;
            logo.alt = provider.provider_name;
            
            const name = document.createElement('span');
            name.className = 'provider-name';
            name.textContent = provider.provider_name;

            item.appendChild(logo);
            item.appendChild(name);
            elements.providersList.appendChild(item);
        });
    } else {
        elements.watchProviders.classList.add('hidden');
    }
}

function openTrailer() {
    if (currentMovie && currentMovie.videos && currentMovie.videos.results) {
        const trailers = currentMovie.videos.results.filter(
            video => video.type === 'Trailer' && video.site === 'YouTube'
        );
        
        if (trailers.length > 0) {
            const trailerKey = trailers[0].key;
            window.open(`https://www.youtube.com/watch?v=${trailerKey}`, '_blank');
        } else {
            alert('Трейлер не найден');
        }
    } else {
        alert('Информация о трейлере недоступна');
    }
}

function toggleOverview() {
    const overview = elements.movieOverview;
    const isExpanded = overview.classList.contains('expanded');
    
    if (isExpanded) {
        overview.classList.remove('expanded');
        elements.expandOverviewBtn.textContent = 'Читать полностью';
    } else {
        overview.classList.add('expanded');
        elements.expandOverviewBtn.textContent = 'Свернуть';
    }
}

function shareMovie() {
    if (!currentMovie) return;

    const title = currentMovie.title || 'Фильм';
    const year = currentMovie.release_date ? currentMovie.release_date.split('-')[0] : '';
    const rating = currentMovie.vote_average ? currentMovie.vote_average.toFixed(1) : 'N/A';
    const siteUrl = window.location.href;

    const shareText = `🎬 FilmFlip предложил мне посмотреть '${title}' (${year})!\n⭐ Рейтинг: ${rating}/10\nПопробуй сам: ${siteUrl}`;

    // Copy to clipboard
    navigator.clipboard.writeText(shareText).then(() => {
        showShareToast();
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showShareToast();
    });
}

function showShareToast() {
    elements.shareToast.classList.remove('hidden');
    setTimeout(() => {
        elements.shareToast.classList.add('hidden');
    }, 3000);
}

function showLoader() {
    elements.loader.classList.remove('hidden');
}

function hideLoader() {
    elements.loader.classList.add('hidden');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    hideLoader();
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}
