(function() {
    'use strict';

    // предотвращаем повторную инициализацию
    if (window.contentLabels) return;
    window.contentLabels = true;

    // стили: синий для фильмов (красный для сериалов уже есть в core)
    const style = document.createElement('style');
    style.textContent = `
        .card__type--movie { background: #1565C0 !important; color: #fff !important; }
    `;
    document.head.appendChild(style);

    // удаление стандартных лейблов TV
    function removeOriginalLabels() {
        document.querySelectorAll('.card__type').forEach(el => {
            if (el.textContent === 'TV') el.remove();
        });
    }

    // определение лейбла по данным карточки
    function getLabel(cardData) {
        if (!cardData) return '';
        // Актёры: не создаём лейбл
        if (cardData.profile_path !== undefined || cardData.known_for_department) return '';
        const isTv = !!cardData.name;
        const genres = cardData.genres || cardData.genre_ids || [];
        const genreIds = Array.isArray(genres) 
            ? genres.map(g => typeof g === 'object' ? g.id : g) 
            : [];
        const firstGenreId = genreIds.length ? genreIds[0] : 0;

        // аниме (высший приоритет): жанр 16 + японский язык или источник cub
        if ((genreIds.includes(16) && cardData.original_language === 'ja') || cardData.source === 'cub') {
            return 'Аниме';
        }

        // приоритеты для сериалов
        if (isTv) {
            if (genreIds.includes(10763)) return 'Новости';
            if (genreIds.includes(10767)) return 'Ток-шоу';
            if (genreIds.includes(10764)) return 'Реалити';
            if (genreIds.includes(99)) return 'Документальный';
            if (genreIds.includes(16)) return 'Мультсериал';
            if (genreIds.includes(10766)) return 'Мыльная опера';
            if (firstGenreId === 10759) return 'Экшен';
            if (firstGenreId === 10765) return 'Фантастика';
            if (firstGenreId === 9648) return 'Детектив';
            if (firstGenreId === 10768) return 'Военный';
            if (firstGenreId === 37) return 'Вестерн';
            if (firstGenreId === 80) return 'Криминал';
            if (firstGenreId === 10751) return 'Семейный';
            if (firstGenreId === 10762) return 'Детский';
            if (firstGenreId === 35) return 'Комедия';
            if (firstGenreId === 18) return 'Драма';
            return 'Сериал';
        } else {
            // приоритеты для фильмов
            if (genreIds.includes(99)) return 'Документальный';
            if (genreIds.includes(16)) return 'Мультфильм';
            if (firstGenreId === 28) return 'Боевик';
            if (firstGenreId === 12) return 'Приключения';
            if (firstGenreId === 27) return 'Ужасы';
            if (firstGenreId === 53) return 'Триллер';
            if (firstGenreId === 878) return 'Фантастика';
            if (firstGenreId === 14) return 'Фэнтези';
            if (firstGenreId === 9648) return 'Детектив';
            if (firstGenreId === 10752) return 'Военный';
            if (firstGenreId === 37) return 'Вестерн';
            if (firstGenreId === 80) return 'Криминал';
            if (firstGenreId === 36) return 'История';
            if (firstGenreId === 10402) return 'Музыка';
            if (firstGenreId === 10749) return 'Мелодрама';
            if (firstGenreId === 10751) return 'Семейный';
            if (firstGenreId === 10770) return 'Телефильм';
            if (firstGenreId === 35) return 'Комедия';
            if (firstGenreId === 18) return 'Драма';
            return 'Фильм';
        }
    }

    // обработка карточки в списке
    function processCard(card) {
        if (card.querySelector('.card__type') || !card.card_data) return;
        const viewElem = card.querySelector('.card__view');
        if (!viewElem) return;
        const label = getLabel(card.card_data);
        if (!label) return; // для актёров label пустой → элемент не создаётся

        const typeElem = document.createElement('div');
        typeElem.className = 'card__type';
        typeElem.textContent = label;
        typeElem.classList.add(card.card_data.name ? 'card__type--tv' : 'card__type--movie');
        viewElem.appendChild(typeElem);
    }

    // обработка детальной страницы
    function processDetailPage(cardData) {
        if (!cardData) return;
        const fullStart = document.querySelector('.full-start-new, .full-start');
        if (!fullStart) return;
        const poster = fullStart.querySelector('.full-start-new__poster, .full-start__poster');
        if (!poster) return;
        const oldLabel = poster.querySelector('.card__type');
        if (oldLabel) oldLabel.remove();
        const label = getLabel(cardData);
        if (!label) return; // для актёров label пустой → элемент не создаётся

        const typeElem = document.createElement('div');
        typeElem.className = 'card__type';
        typeElem.textContent = label;
        typeElem.classList.add(cardData.name ? 'card__type--tv' : 'card__type--movie');
        poster.appendChild(typeElem);
    }

    // наблюдатель за изменениями DOM (отслеживает новые карточки)
    const observer = new MutationObserver(() => {
        removeOriginalLabels();
        document.querySelectorAll('.card').forEach(processCard);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // первоначальный запуск
    removeOriginalLabels();
    document.querySelectorAll('.card').forEach(processCard);

    // подписка на события Lampa (для детальной страницы)
    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('full', e => {
            if (e.type === 'complite' || e.type === 'build') {
                if (e.data && e.data.movie) {
                    setTimeout(() => {
                        processDetailPage(e.data.movie);
                    }, 50);
                }
            }
        });
    }
})();
