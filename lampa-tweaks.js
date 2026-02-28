(function() {
    'use strict';

    // глобальные настройки
    if (!window.lampaTweaks) window.lampaTweaks = {};
    
    Object.assign(window.lampa_settings, {
        disable_features: {
            dmca: true,
            ai: true,
            subscribe: true,
            blacklist: true,
            persons: true,
            ads: true,
            install_proxy: true
        },
        feed: false,
        services: false,
        geo: false,
        lang_use: false,
        dcma: false
    });

    window.plugin_shots_ready = true; // блокируем shots

    // основная функция
    function run() {
        // убираем рекламу где она есть в начале фильма
        Lampa.AdManager?.destroy();
        $('.ad-video-block, [class*="ad-"], .ad_plugin').remove();

        // плеер (убираем VAST)
        if (Lampa.Player?.play) {
            const originalPlay = Lampa.Player.play;
            Lampa.Player.play = function(o) {
                o.iptv = true;
                delete o.vast_url;
                delete o.vast_msg;
                return originalPlay.call(this, o);
            };
        }

        // кнопка опций ЕЩЁ в полной карточке, т.к она пустая из-за предыдущих отключений
        Lampa.Listener.follow('full', e => {
            if (e.type === 'complite') {
                $('.button--options').remove();
            }
        });

        // уведомления (колокольчик) в шапке - отключить 
        $('.head__action.open--notice, .head__action.notice--icon').remove();
        if (Lampa.Notice?.drawCount) Lampa.Notice.drawCount = () => {};

        // кнопки в шапке - отключить 
        $('.head__action.open--premium, .head__action.open--feed, .head__action.open--broadcast, .black-friday__button').remove();

        // убрать блок история в торрентах и восстановить фокус
        const removeHistory = () => {
            $('.watched-history').remove();
            // восстановить фокус на первый торрент, если он есть
            const first = $('.torrent-item').first();
            if (first.length) {
                Lampa.Controller.collectionFocus(first, $('.scroll').first());
            }
        };
        removeHistory();
        new MutationObserver(removeHistory).observe(document.body, {
            childList: true,
            subtree: true
        });

        // стили для раздают/качают в торрентах 
        $('body').append(`
            <style>
                .torrent-item__seeds span {
                    background-color: #007D34;
                    color: #fff;
                    border-radius: .3em;
                    padding: .2em .6em;
                    font-weight: 600;
                    font-size: .85em;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .torrent-item__grabs span {
                    background-color: #1565C0;
                    color: #fff;
                    border-radius: .3em;
                    padding: .2em .6em;
                    font-weight: 600;
                    font-size: .85em;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .torrent-item__seeds, .torrent-item__grabs {
                    margin-right: .3em;
                }
            </style>
        `);
    }

    // запуск после готовности приложения
    if (window.appready) {
        run();
    } else {
        Lampa.Listener.follow('app', e => {
            if (e.type === 'ready') run();
        });
    }
})();
