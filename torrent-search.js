(function() {
    'use strict';

    // Защита от повторной загрузки
    if (window.torrentSearch) return;
    window.torrentSearch = true;

    function startPlugin() {
        // Регистрация в меню "Действие"
        Lampa.Manifest.plugins.unshift({
            type: 'video',
            name: 'Парсер',
            subtitle: 'Смотреть торрент',
            onContextMenu: () => {},
            onContextLauch: (object) => {
                Lampa.Activity.push({
                    component: 'torrents',
                    search: object.title,
                    movie: object,
                    clarification: true
                });
            }
        });

        // Список Jackett серверов
        const JACKETT_SERVERS = [
            'jacred.xyz',
            'jr.maxvol.pro',
            'jac.red',
            'jacred.pro',
            'jac-red.ru',
            'jacblack.ru:9117'
        ];

        let icon = null;         // Иконка в шапке
        let restoreTimer = null; // Таймер восстановления

        // Временное переключение сервера на 3 секунды
        function switchServer(url) {
            const activity = Lampa.Activity.active();
            if (!activity) return;

            const originalUrl = Lampa.Storage.get('jackett_url', '');
            
            Lampa.Storage.set('jackett_url', url);
            Lampa.Storage.set('jackett_interview', 'healthy');
            
            // Перезапуск активности с новым сервером
            Lampa.Activity.replace({
                url: '',
                title: `Торренты - ${url}`,
                component: 'torrents',
                search: activity.search,
                movie: activity.movie,
                page: 1
            });

            if (restoreTimer) clearTimeout(restoreTimer);
            
            restoreTimer = setTimeout(() => {
                Lampa.Storage.set('jackett_url', originalUrl);
                restoreTimer = null;
            }, 3000);
        }

        // Установка основного сервера
        function setMainServer(url) {
            Lampa.Storage.set('jackett_url', url);
            Lampa.Storage.set('jackett_main_server', url);
        }

        // Отображение списка серверов для выбора
        function showServerSelector() {
            const currentUrl = Lampa.Storage.get('jackett_url', '');
            const mainServer = Lampa.Storage.get('jackett_main_server', '');
            
            const items = [
                { title: 'Короткий тап - поиск | Долгий тап - сделать основным', separator: true }
            ];

            JACKETT_SERVERS.forEach(url => {
                items.push({
                    title: url + (mainServer === url ? ' ★' : ''),
                    selected: currentUrl === url,
                    url
                });
            });

            Lampa.Select.show({
                items,
                onSelect: (selected) => {
                    if (selected?.url) switchServer(selected.url);
                },
                onLong: (selected) => {
                    if (selected?.url) {
                        setMainServer(selected.url);
                        showServerSelector(); 
                    }
                },
                onBack: () => Lampa.Controller.toggle('head')
            });
        }

        // Добавление кнопки переключения в шапку
        function addHeaderButton() {
            icon = Lampa.Head.addIcon(
                '<svg><use xlink:href="#sprite-torrent"></use></svg>',
                showServerSelector
            );
            
            icon.addClass('jackett-servers-selector');
            icon.hide(); // По умолчанию скрыта

            // Показываем иконку только в разделе торрентов
            Lampa.Listener.follow('activity', (e) => {
                if (e.type === 'start') {
                    icon[e.component === 'torrents' ? 'show' : 'hide']();
                }
            });
        }

        // Инициализация плагина
        if (window.appready) {
            addHeaderButton();
        } else {
            Lampa.Listener.follow('app', (e) => {
                if (e.type === 'ready') addHeaderButton();
            });
        }
    }

    startPlugin();
})();
