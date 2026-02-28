(function() {
    'use strict';

    // предотвращаем повторную инициализацию
    if (window.russianContent) return;
    window.russianContent = true;

    // конфигурация плагина
    const CONFIG = {
        runtime: {
            minMovies: 71,    // минимальная длительность фильмов (убираем короткометражки)
            minCartoons: 70   // минимальная длительность мультфильмов (убираем короткометражки)
        },
        display: {
            mainPageItems: 20  // количество элементов в линии на главной
        },
        cacheLifeTime: 1440,    // время жизни кэша в минутах (24 часа)
        pages: {
            maxTotal: 500,      // максимальное количество страниц в кнопке ЕЩЁ
            concurrentLimit: 2   // одновременная загрузка разделов
        }
    };

    // сетевой клиент
    const network = new Lampa.Reguest();

    // форматирование дат
    const DateUtils = (() => {
        const today = new Date();
        
        const formatDate = (date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };

        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);

        return {
            now: formatDate(today),
            month: formatDate(monthAgo),
            year: formatDate(yearAgo)
        };
    })();

    // формирование URL для TMDB API
    const buildUrl = (query) => {
        return Lampa.TMDB.api(query + '&api_key=' + Lampa.TMDB.key() + '&language=ru');
    };

    // функции сортировки
    const sortFunctions = {
        popularity: (a, b) => (b.popularity || 0) - (a.popularity || 0),
        date: (a, b) => {
            const dateA = a.release_date || a.first_air_date || '';
            const dateB = b.release_date || b.first_air_date || '';
            return dateB.localeCompare(dateA);
        }
    };

    // загрузка данных
    const loadData = (queries, title, callback, sortFunction) => {
        const queryArray = Array.isArray(queries) ? queries : [queries];
        let results = [];
        let completedCount = 0;

        const onComplete = () => {
            completedCount++;
            if (completedCount === queryArray.length) {
                if (sortFunction) {
                    results.sort(sortFunction);
                }

                const responseData = {
                    results: results.slice(0, CONFIG.display.mainPageItems),
                    title: title,
                    source: 'tmdb',
                    total_pages: 2,
                    params: {
                        card: {
                            card_small: true
                        }
                    }
                };

                callback(Lampa.Utils.addSource(responseData, 'tmdb'));
            }
        };

        for (let i = 0; i < queryArray.length; i++) {
            network.silent(
                buildUrl(queryArray[i]),
                (json) => {
                    results = results.concat(json.results || []);
                    onComplete();
                },
                onComplete,
                false,
                { cache: { life: CONFIG.cacheLifeTime } }
            );
        }
    };

    // запросы к API
    const API_QUERIES = {
        // сейчас смотрят (фильмы + сериалы за месяц)
        nowPlaying: [
            `discover/movie?with_original_language=ru&with_runtime.gte=${CONFIG.runtime.minMovies}&primary_release_date.gte=${DateUtils.month}&primary_release_date.lte=${DateUtils.now}&sort_by=popularity.desc&page=1`,
            `discover/tv?with_original_language=ru&first_air_date.gte=${DateUtils.month}&first_air_date.lte=${DateUtils.now}&sort_by=popularity.desc&page=1`
        ],
        
        // популярное за год (фильмы + сериалы за год)
        yearlyPopular: [
            `discover/movie?with_original_language=ru&with_runtime.gte=${CONFIG.runtime.minMovies}&primary_release_date.gte=${DateUtils.year}&primary_release_date.lte=${DateUtils.now}&sort_by=popularity.desc&page=1`,
            `discover/tv?with_original_language=ru&first_air_date.gte=${DateUtils.year}&first_air_date.lte=${DateUtils.now}&sort_by=popularity.desc&page=1`
        ],
        
        // русские фильмы (исключаем мультфильмы, документальные)
        movies: `discover/movie?with_original_language=ru&with_runtime.gte=${CONFIG.runtime.minMovies}&without_genres=16,99&primary_release_date.lte=${DateUtils.now}&sort_by=primary_release_date.desc`,
        
        // русские сериалы (исключаем мультсериалы, реалити, ток-шоу, документальные)
        series: `discover/tv?with_original_language=ru&without_genres=16,10764,10767,99&first_air_date.lte=${DateUtils.now}&sort_by=first_air_date.desc`,
        
        // русские мультфильмы
        cartoons: `discover/movie?with_original_language=ru&with_genres=16&with_runtime.gte=${CONFIG.runtime.minCartoons}&primary_release_date.lte=${DateUtils.now}&sort_by=primary_release_date.desc`,
        
        // русские мультсериалы
        cartoonSeries: `discover/tv?with_original_language=ru&with_genres=16&first_air_date.lte=${DateUtils.now}&sort_by=first_air_date.desc`,
        
        // русские реалити-шоу
        reality: `discover/tv?with_original_language=ru&with_genres=10764&first_air_date.lte=${DateUtils.now}&sort_by=first_air_date.desc`,
        
        // русские ток-шоу
        talkShows: `discover/tv?with_original_language=ru&with_genres=10767&first_air_date.lte=${DateUtils.now}&sort_by=first_air_date.desc`,
        
        // русские документальные (фильмы + сериалы)
        documentary: [
            `discover/movie?with_original_language=ru&with_genres=99&primary_release_date.lte=${DateUtils.now}&sort_by=primary_release_date.desc&page=1`,
            `discover/tv?with_original_language=ru&with_genres=99&first_air_date.lte=${DateUtils.now}&sort_by=first_air_date.desc&page=1`
        ]
    };

    // основной компонент главной страницы
    Lampa.Component.add('russian_category', function(params) {
        const component = Lampa.Utils.createInstance(Lampa.Maker.get('Main'), params);

        // список разделов с функциями загрузки
        const sections = [
            (callback) => loadData(API_QUERIES.nowPlaying, 'Сейчас смотрят', callback, sortFunctions.popularity),
            (callback) => loadData(API_QUERIES.yearlyPopular, 'Популярное за год', callback, sortFunctions.popularity),
            (callback) => loadData(API_QUERIES.movies, 'Русские фильмы', callback, sortFunctions.date),
            (callback) => loadData(API_QUERIES.series, 'Русские сериалы', callback, sortFunctions.date),
            (callback) => loadData(API_QUERIES.cartoons, 'Русские мультфильмы', callback, sortFunctions.date),
            (callback) => loadData(API_QUERIES.cartoonSeries, 'Русские мультсериалы', callback, sortFunctions.date),
            (callback) => loadData(API_QUERIES.reality, 'Русские реалити-шоу', callback, sortFunctions.date),
            (callback) => loadData(API_QUERIES.talkShows, 'Русские ток-шоу', callback, sortFunctions.date),
            (callback) => loadData(API_QUERIES.documentary, 'Русские документальные', callback, sortFunctions.date)
        ];

        // маршруты для страниц с полным списком
        const routes = {
            'Сейчас смотрят': { component: 'russian_now_full', url: '' },
            'Популярное за год': { component: 'russian_year_full', url: '' },
            'Русские фильмы': { component: 'category_full', url: API_QUERIES.movies },
            'Русские сериалы': { component: 'category_full', url: API_QUERIES.series },
            'Русские мультфильмы': { component: 'category_full', url: API_QUERIES.cartoons },
            'Русские мультсериалы': { component: 'category_full', url: API_QUERIES.cartoonSeries },
            'Русские реалити-шоу': { component: 'category_full', url: API_QUERIES.reality },
            'Русские ток-шоу': { component: 'category_full', url: API_QUERIES.talkShows },
            'Русские документальные': { component: 'russian_documentary_full', url: '' }
        };

        component.use({
            onCreate() {
                this.activity.loader(true);
                
                Lampa.Api.partNext(
                    sections,
                    CONFIG.pages.concurrentLimit,
                    (data) => {
                        this.build(data);
                        this.activity.loader(false);
                        this.activity.toggle();
                    },
                    () => {
                        this.empty();
                        this.activity.loader(false);
                    }
                );
            },

            onNext(resolve, reject) {
                let hasRemainingSections = false;
                
                for (let i = 0; i < sections.length; i++) {
                    if (typeof sections[i] === 'function') {
                        hasRemainingSections = true;
                        break;
                    }
                }

                if (hasRemainingSections) {
                    Lampa.Api.partNext(sections, CONFIG.pages.concurrentLimit, resolve, reject);
                } else {
                    reject();
                }
            },

            onInstance(item, itemData) {
                item.use({
                    onMore() {
                        const route = routes[itemData.title];
                        if (route) {
                            Lampa.Activity.push({
                                url: route.url,
                                title: itemData.title,
                                component: route.component,
                                page: 1,
                                source: 'tmdb'
                            });
                        }
                    },

                    onInstance(card, cardData) {
                        card.use({
                            onEnter: () => Lampa.Router.call('full', cardData),
                            onFocus: () => Lampa.Background.change(Lampa.Utils.cardImgBackground(cardData))
                        });
                    }
                });
            }
        });

        return component;
    });

    // компоненты для полных списков (сейчас смотрят, популярное за год, документальные)
    ['now', 'year', 'documentary'].forEach((type) => {
        Lampa.Component.add(`russian_${type}_full`, function(params) {
            const component = Lampa.Utils.createInstance(Lampa.Maker.get('Category'), params);
            const pageCache = new Map();

            const loadPage = (pageNum, callback) => {
                const cacheKey = `${type}_${pageNum}`;
                
                if (pageCache.has(cacheKey)) {
                    callback(pageCache.get(cacheKey));
                    return;
                }

                let queries;
                if (type === 'now') queries = API_QUERIES.nowPlaying;
                else if (type === 'year') queries = API_QUERIES.yearlyPopular;
                else queries = API_QUERIES.documentary;
                
                const apiPage = Math.ceil(pageNum / 2);
                
                let results = [];
                let completedCount = 0;

                const onComplete = () => {
                    completedCount++;
                    if (completedCount === 2) {
                        const sortFn = type === 'documentary' ? sortFunctions.date : sortFunctions.popularity;
                        const pageData = {
                            results: results.sort(sortFn),
                            total_pages: CONFIG.pages.maxTotal,
                            source: 'tmdb'
                        };
                        pageCache.set(cacheKey, pageData);
                        callback(pageData);
                    }
                };

                const loadFromApi = (index) => {
                    network.silent(
                        buildUrl(queries[index].replace(/page=1/, `page=${apiPage}`)),
                        (json) => {
                            results = results.concat(json.results || []);
                            onComplete();
                        },
                        onComplete,
                        false,
                        { cache: { life: CONFIG.cacheLifeTime } }
                    );
                };

                loadFromApi(0);
                loadFromApi(1);
            };

            component.use({
                onCreate() {
                    this.activity.loader(true);
                    
                    loadPage(params.page || 1, (data) => {
                        this.build(data);
                        this.render().find('.category-full').addClass('cols--6');
                        this.activity.loader(false);
                        this.activity.toggle();
                    });
                },

                onNext(resolve) {
                    params.page = (params.page || 1) + 1;
                    loadPage(params.page, resolve);
                },

                onInstance(card, cardData) {
                    card.use({
                        onEnter: () => Lampa.Router.call('full', cardData),
                        onFocus: () => Lampa.Background.change(Lampa.Utils.cardImgBackground(cardData))
                    });
                }
            });

            return component;
        });
    });

    // добавление пункта в меню
    const addRussianMenu = () => {
        const menuList = $('.menu .menu__list').first();
        
        if (!menuList[0] || menuList.find('[data-plugin="russian-content"]').length > 0) return;

        const menuItem = $(`
            <li class="menu__item selector" data-plugin="russian-content">
                <div class="menu__ico">
                    <svg width="36" height="36" viewBox="0 0 35 35">
                        <path d="M7.486,33.076a3.164,3.164,0,0,1-3.164-3.165V5.089A3.164,3.164,0,0,1,9.249,2.461L27.754,14.872a3.165,3.165,0,0,1,0,5.256L9.249,32.539h0A3.156,3.156,0,0,1,7.486,33.076ZM8.552,31.5h0ZM7.491,4.422a.7.7,0,0,0-.317.08.652.652,0,0,0-.352.587V29.911a.664.664,0,0,0,1.034.552L26.362,18.052a.66.66,0,0,0,.294-.553.646.646,0,0,0-.294-.55L7.856,4.537A.649.649,0,0,0,7.491,4.422Z" fill="currentColor"/>
                    </svg>
                </div>
                <div class="menu__text">Русское</div>
            </li>
        `);

        menuItem.on('hover:enter', () => {
            Lampa.Activity.push({
                url: '',
                title: 'Русский контент',
                component: 'russian_category',
                page: 1
            });
        });

        menuList.append(menuItem);
    };

    // инициализация после загрузки приложения
    if (window.appready) {
        addRussianMenu();
    } else {
        Lampa.Listener.follow('app', (event) => {
            if (event.type === 'ready') {
                addRussianMenu();
            }
        });
    }
})();
