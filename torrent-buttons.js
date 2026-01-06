function startPlugin() {  
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
  
    const jackett_servers = ['jacred.xyz', 'jr.maxvol.pro', 'jacred.pro', 'jac-red.ru', 'jacblack.ru:9117'];  
    let icon, activityListener, restoreTimeout;  
  
    function switchServer(url) {  
        const original_url = Lampa.Storage.get('jackett_url', '');  
        Lampa.Storage.set('jackett_url', url);  
        Lampa.Storage.set('jackett_interview', 'healthy');  
          
        Lampa.Activity.replace({  
            url: '',  
            title: 'Торренты - ' + url,  
            component: 'torrents',  
            search: Lampa.Activity.active().search,  
            movie: Lampa.Activity.active().movie,  
            page: 1  
        });  
  
        clearTimeout(restoreTimeout);  
        restoreTimeout = setTimeout(() => Lampa.Storage.set('jackett_url', original_url), 3000);  
    }  
  
    function setMainServer(url) {  
        Lampa.Storage.set('jackett_url', url);  
        Lampa.Storage.set('jackett_main_server', url);  
    }  
  
    function showServerSelector() {  
        const current_url = Lampa.Storage.get('jackett_url', '');  
        const main_server = Lampa.Storage.get('jackett_main_server', '');  
          
        const items = [{title: 'Короткий тап - поиск | Долгий тап - сделать основным', separator: true}];  
          
        jackett_servers.forEach(url => {  
            items.push({  
                title: url + (main_server.indexOf(url) >= 0 ? ' ★' : ''),  
                selected: current_url.indexOf(url) >= 0,  
                url: url  
            });  
        });  
  
        Lampa.Select.show({  
            title: '',  
            items: items,  
            onSelect: selected => selected.url && switchServer(selected.url),  
            onLong: selected => {  
                if (selected.url) {  
                    setMainServer(selected.url);  
                    showServerSelector();  
                }  
            },  
            onBack: () => Lampa.Controller.toggle('head')  
        });  
    }  
  
    function addHeaderButton() {  
        icon = Lampa.Head.addIcon('<svg><use xlink:href="#sprite-torrent"></use></svg>', showServerSelector);  
        icon.addClass('jackett-servers-selector').hide();  
          
        activityListener = e => {  
            if (e.type === 'start') {  
                e.component === 'torrents' ? icon.show() : icon.hide();  
            }  
        };  
          
        Lampa.Listener.follow('activity', activityListener);  
    }  
  
    window.appready ? addHeaderButton() : Lampa.Listener.follow('app', e => {  
        if (e.type === 'ready') addHeaderButton();  
    });  
}  
  
!window.parser_search_plugin_ready && (window.parser_search_plugin_ready = true, startPlugin());
