(function(){'use strict';
  // Адрес для получения случайного TorrServer
  const ENDPOINT = 'http://185.87.48.42:8090/random_torr';
  
  // Иконка для кнопки
  const ICON = '<img src="./img/icons/settings/server.svg" />';
  
  // Тексты уведомлений
  const MSG_SUCCESS = (ip) => `TorrServer изменён http://${ip}:8090`;
  const MSG_ERROR = 'TorrServer недоступен';

  // Запрос нового сервера
  const fetchServer = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', ENDPOINT);
    
    xhr.onload = () => {
      // Если статус 200 и есть IP - успех, иначе ошибка
      const ip = xhr.status === 200 ? xhr.responseText?.trim() : '';
      if (ip) {
        Lampa.Storage.set('torrserver_url_two', `http://${ip}:8090`);
        Lampa.Noty.show(MSG_SUCCESS(ip));
      } else {
        Lampa.Noty.show(MSG_ERROR);
      }
    };
    
    // Ошибка сети
    xhr.onerror = () => Lampa.Noty.show(MSG_ERROR);
    xhr.send();
  };

  // Инициализация плагина
  const init = () => {
    // Проверка условий: включён торрент-клиент и выбрана доп. ссылка
    if (!Lampa.Storage.field('internal_torrclient') || 
        Lampa.Storage.get('torrserver_use_link') !== 'two') return;
    
    // Добавляем кнопку в шапку
    const icon = Lampa.Head.addIcon(ICON, fetchServer).addClass('switch-server');
    
    // Показываем кнопку только в разделе торрентов
    const update = () => icon.toggle(Lampa.Activity.active()?.component === 'torrents');
    
    // Следим за сменой разделов
    Lampa.Storage.listener.follow('change', e => {
      if (e.name === 'activity') {
        update();
        // Автоматический запрос при входе в торренты
        if (Lampa.Activity.active()?.component === 'torrents') fetchServer();
      }
    });
    
    // Первоначальная проверка видимости
    update();
  };

  // Запуск после готовности приложения
  window.appready ? init() : Lampa.Listener.follow('app', e => e.type === 'ready' && init());
})();
