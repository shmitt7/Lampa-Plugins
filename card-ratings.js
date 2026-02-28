(function() {
    'use strict';

    // Конфигурация
    const CONFIG = {
        CACHE_TIME_SUCCESS: 15 * 24 * 60 * 60 * 1000, // 15 дней для найденных рейтингов
        CACHE_TIME_ERROR: 1 * 24 * 60 * 60 * 1000,    // 1 день для ошибок/не найдено
        SEARCH_CACHE_TIME: 3 * 60 * 60 * 1000,        // 3 часа для ID поиска
        API_KEY: 'XXXXXXXXXXXXXXXXXXXX', 
        OBSERVER_MARGIN: 100
    };

    const network = new Lampa.Reguest();
    const cache = Lampa.Storage.cache('kp_rating', 500, {});

    // Нормализация названия: убираем спецсимволы, лишние пробелы
    function normalizeTitle(str) {
        return str ? str.toLowerCase().replace(/[^\wа-яё\s]/gi, ' ').replace(/\s+/g, ' ').trim() : '';
    }

    // Получение из кэша с разным временем для успехов и ошибок
    function getCache(id, type = 'rating') {
        const key = type === 'search' ? `search_${id}` : id;
        const item = cache[key];
        if (!item) return null;
        
        // Выбираем время жизни в зависимости от типа и наличия рейтинга
        let cacheTime = type === 'search' ? CONFIG.SEARCH_CACHE_TIME :
                       item.kp === 0 ? CONFIG.CACHE_TIME_ERROR : CONFIG.CACHE_TIME_SUCCESS;
        
        return (Date.now() - item.timestamp) < cacheTime ? item : null;
    }

    // Сохранение в кэш
    function setCache(id, data, type = 'rating') {
        const key = type === 'search' ? `search_${id}` : id;
        cache[key] = { ...data, timestamp: Date.now() };
        Lampa.Storage.set('kp_rating', cache);
    }

    // Отображение в полной карточке
    function showFullRating(kp, tmdb) {
        try {
            const render = Lampa.Activity.active().activity.render();
            $('.wait_rating', render).remove();
            if (kp > 0) $('.rate--kp', render).removeClass('hide').find('> div').eq(0).text(kp.toFixed(1));
            if (tmdb > 0) $('.rate--tmdb', render).removeClass('hide').find('> div').eq(0).text(tmdb.toFixed(1));
        } catch (e) {}
    }

    // Отображение на карточке
    function updateCardVote(card, kp, tmdb) {
        let el = card.querySelector('.card__vote');
        if (!el) {
            el = document.createElement('div');
            el.className = 'card__vote';
            card.querySelector('.card__view')?.appendChild(el);
        }

        const rating = kp > 0 ? kp : tmdb;
        if (rating > 0) {
            const icon = kp > 0 ? '<span class="source--name"></span>' : '';
            el.innerHTML = `<span style="display:flex;align-items:center;gap:0.1em">${rating.toFixed(1)}${icon}</span>`;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    }

    // Получение рейтинга по ID (XML -> API)
    function getRatingById(id, card, onSuccess, onError) {
        const tmdbRating = card.vote_average || 0;
        
        // Сначала XML (не тратит лимит API)
        network.timeout(1000);
        network.native(`https://rating.kinopoisk.ru/${id}.xml`,
            (str) => {
                if (str?.includes('<rating>')) {
                    try {
                        const kp = parseFloat($($.parseXML(str)).find('kp_rating').text()) || 0;
                        if (kp > 0) {
                            setCache(card.id, { kp, tmdb: tmdbRating });
                            onSuccess(kp, tmdbRating);
                            return;
                        }
                    } catch (e) {}
                }
                // XML не сработал — пробуем API
                network.timeout(3000);
                network.silent(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${id}`,
                    (data) => {
                        const kp = data.ratingKinopoisk || 0;
                        setCache(card.id, { kp, tmdb: tmdbRating });
                        onSuccess(kp, tmdbRating);
                    },
                    () => {
                        setCache(card.id, { kp: 0, tmdb: tmdbRating });
                        onError(0, tmdbRating);
                    },
                    false,
                    { headers: { 'X-API-KEY': CONFIG.API_KEY } }
                );
            },
            () => {
                // XML недоступен — сразу в API
                network.timeout(3000);
                network.silent(`https://kinopoiskapiunofficial.tech/api/v2.2/films/${id}`,
                    (data) => {
                        const kp = data.ratingKinopoisk || 0;
                        setCache(card.id, { kp, tmdb: tmdbRating });
                        onSuccess(kp, tmdbRating);
                    },
                    () => {
                        setCache(card.id, { kp: 0, tmdb: tmdbRating });
                        onError(0, tmdbRating);
                    },
                    false,
                    { headers: { 'X-API-KEY': CONFIG.API_KEY } }
                );
            },
            false,
            { dataType: 'text' }
        );
    }

    // Поиск фильма и получение рейтинга
    function fetchRating(card, callback) {
        // 1. Проверяем кэш рейтинга
        const cached = getCache(card.id);
        if (cached) {
            callback(cached.kp, cached.tmdb);
            return;
        }

        // 2. Проверяем кэш поиска (уже знаем ID)
        const searchCached = getCache(card.id, 'search');
        if (searchCached) {
            getRatingById(searchCached.kp_id, card, callback, callback);
            return;
        }

        const year = parseInt(((card.release_date || card.first_air_date || '0000') + '').slice(0, 4));
        const title = card.title || card.name;
        const tmdbRating = card.vote_average || 0;

        function processResult(kp) {
            setCache(card.id, { kp, tmdb: tmdbRating });
            callback(kp, tmdbRating);
        }

        function processError() {
            setCache(card.id, { kp: 0, tmdb: tmdbRating });
            callback(0, tmdbRating);
        }

        // 3. Поиск по IMDb ID (самый точный)
        if (card.imdb_id) {
            network.timeout(5000);
            network.silent(`https://kinopoiskapiunofficial.tech/api/v2.2/films?imdbId=${encodeURIComponent(card.imdb_id)}`,
                (data) => {
                    const id = data.items?.[0]?.kinopoiskId || data.items?.[0]?.filmId || data.kinopoiskId || data.filmId;
                    if (id) {
                        setCache(card.id, { kp_id: id }, 'search');
                        getRatingById(id, card, callback, callback);
                    } else {
                        searchByTitle();
                    }
                },
                searchByTitle,
                false,
                { headers: { 'X-API-KEY': CONFIG.API_KEY } }
            );
        } else {
            searchByTitle();
        }

        // 4. Поиск по названию
        function searchByTitle() {
            network.timeout(5000);
            network.silent(`https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=${encodeURIComponent(normalizeTitle(title))}`,
                (json) => {
                    if (!json.films?.length) {
                        processError();
                        return;
                    }

                    let candidates = json.films;
                    let bestMatch = null;

                    // Добавляем год для числового сравнения
                    candidates.forEach(f => {
                        f.numYear = parseInt((f.year || '0000').slice(0, 4));
                    });

                    // Сначала фильтруем по году (быстрое числовое сравнение)
                    if (year) {
                        const yearMatches = candidates.filter(f => f.numYear === year);
                        if (yearMatches.length) {
                            bestMatch = yearMatches[0];
                        } else {
                            const nearMatches = candidates.filter(f => 
                                f.numYear && f.numYear > year - 3 && f.numYear < year + 3
                            );
                            if (nearMatches.length) bestMatch = nearMatches[0];
                        }
                    }

                    // Если не нашли по году — берём первый
                    if (!bestMatch && candidates.length) {
                        bestMatch = candidates[0];
                    }

                    if (bestMatch) {
                        const id = bestMatch.filmId;
                        setCache(card.id, { kp_id: id }, 'search');
                        getRatingById(id, card, callback, callback);
                    } else {
                        processError();
                    }
                },
                () => processError(),
                false,
                { headers: { 'X-API-KEY': CONFIG.API_KEY } }
            );
        }
    }

    // Обновление карточки
    function updateCard(card) {
        if (!card?.card_data?.id) return;
        const data = card.card_data;
        if (!data.release_date && !data.first_air_date) return;
        fetchRating(data, (kp, tmdb) => updateCardVote(card, kp, tmdb));
    }

    // Обновление полной карточки
    function updateFullCard(card) {
        if (!card.release_date && !card.first_air_date) return;
        const cached = getCache(card.id);
        if (cached) {
            showFullRating(cached.kp, cached.tmdb);
            return;
        }

        try {
            const render = Lampa.Activity.active().activity.render();
            if ($('.rate--kp', render).hasClass('hide') && !$('.wait_rating', render).length) {
                $('.info__rate', render).after('<div style="width:2em;margin-top:1em;margin-right:1em" class="wait_rating"><div class="broadcast__scan"><div></div></div><div>');
                fetchRating(card, showFullRating);
            }
        } catch (e) {}
    }

    // Наблюдение за видимыми карточками
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                updateCard(entry.target);
                observer.unobserve(entry.target); // Отписываемся после обработки
            }
        });
    }, { rootMargin: CONFIG.OBSERVER_MARGIN + 'px' });

    function observeCards() {
        document.querySelectorAll('.card:not([data-kp])').forEach(card => {
            if (!card.card_data?.id) return;
            const data = card.card_data;
            if (!data.release_date && !data.first_air_date) return;
            card.dataset.kp = 'true';
            observer.observe(card);
        });
    }

    // Инициализация
    function start() {
        // Стили для иконки Кинопоиска
        const style = document.createElement('style');
        style.textContent = `
            .card__vote { display: flex !important; align-items: center !important; }
            .card__vote .source--name {
                font-size: 0; color: transparent; width: 12px; height: 12px;
                background-repeat: no-repeat; background-position: center; background-size: contain;
                margin-left: 2px; flex-shrink: 0;
                background-image: url("data:image/svg+xml,%3Csvg width='300' height='300' viewBox='0 0 300 300' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cmask id='mask0_1_69' style='mask-type:alpha' maskUnits='userSpaceOnUse' x='0' y='0' width='300' height='300'%3E%3Ccircle cx='150' cy='150' r='150' fill='white'/%3E%3C/mask%3E%3Cg mask='url(%23mask0_1_69)'%3E%3Ccircle cx='150' cy='150' r='150' fill='black'/%3E%3Cpath d='M300 45L145.26 127.827L225.9 45H181.2L126.3 121.203V45H89.9999V255H126.3V178.92L181.2 255H225.9L147.354 174.777L300 255V216L160.776 160.146L300 169.5V130.5L161.658 139.494L300 84V45Z' fill='url(%23paint0_radial_1_69)'/%3E%3C/g%3E%3Cdefs%3E%3CradialGradient id='paint0_radial_1_69' cx='0' cy='0' r='1' gradientUnits='userSpaceOnUse' gradientTransform='translate(89.9999 45) rotate(45) scale(296.985)'%3E%3Cstop offset='0.5' stop-color='%23FF5500'/%3E%3Cstop offset='1' stop-color='%23BBFF00'/%3E%3C/radialGradient%3E%3C/defs%3E%3C/svg%3E");
            }
            @media (min-width: 481px) {
                .card__vote .source--name { width: 14px; height: 14px; margin-left: 3px; }
            }
        `;
        document.head.appendChild(style);

        observeCards();

        // Следим за появлением новых карточек (с debounce)
        let timer;
        new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(observeCards, 100);
        }).observe(document.querySelector('.content--scroll') || document.body, 
            { childList: true, subtree: true });

        // События Lampa
        Lampa.Listener.follow('card', (e) => {
            if (e.type === 'build' && e.object.card) {
                setTimeout(() => {
                    if (e.object.card.card_data?.id) updateCard(e.object.card);
                }, 200);
            }
        });

        Lampa.Listener.follow('full', (e) => {
            if (e.type === 'complite') {
                setTimeout(() => updateFullCard(e.data.movie), 200);
            }
        });

        // Очистка при закрытии
        Lampa.Listener.follow('app', (e) => {
            if (e.type === 'destroy') {
                observer.disconnect();
            }
        });
    }

    // Запуск
    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', (e) => {
            if (e.type === 'ready') start();
        });
    }
})();
