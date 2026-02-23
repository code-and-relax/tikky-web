var Sidebar = (function() {
  var _activeRoute = '';

  var NAV_ITEMS = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<rect x="3" y="3" width="7" height="7"></rect>'
        + '<rect x="14" y="3" width="7" height="7"></rect>'
        + '<rect x="3" y="14" width="7" height="7"></rect>'
        + '<rect x="14" y="14" width="7" height="7"></rect></svg>',
      route: '#/'
    },
    {
      id: 'app-feedback',
      label: 'Feedback App',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      route: '#/feedback/app'
    },
    {
      id: 'ai-feedback',
      label: 'Feedback AI Chat',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20h6v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z">'
        + '</path><line x1="9" y1="22" x2="15" y2="22"></line></svg>',
      route: '#/feedback/ai'
    },
    {
      id: 'chat',
      label: 'Chat Admin',
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z">'
        + '</path><polyline points="22,6 12,13 2,6"></polyline></svg>',
      route: '#/chat'
    }
  ];

  function init() {
    render();
    _updateUserInfo();
    _setupLogout();
    _setupMobileToggle();
  }

  function _updateUserInfo() {
    var admin = Auth.getCurrentAdmin();
    if (!admin) return;
    var userEl = document.getElementById('sidebar-user');
    if (!userEl) return;
    userEl.innerHTML = '';
    userEl.appendChild(Components.avatar(admin.display_name, 'sm'));
    var nameSpan = document.createElement('span');
    nameSpan.textContent = admin.display_name;
    userEl.appendChild(nameSpan);
  }

  function _setupLogout() {
    var logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      Auth.signOut();
    });
  }

  function _setupMobileToggle() {
    var overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', close);
    }
    var menuBtn = document.getElementById('mobile-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', toggle);
    }
  }

  function render() {
    var nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    nav.innerHTML = '';

    NAV_ITEMS.forEach(function(item) {
      var a = document.createElement('a');
      a.className = 'sidebar-item' + (item.id === _activeRoute ? ' active' : '');
      a.href = item.route;
      a.innerHTML = '<span class="icon">' + item.icon + '</span><span>' + item.label + '</span>';
      a.addEventListener('click', function(e) {
        e.preventDefault();
        Router.navigate(item.route);
      });
      nav.appendChild(a);
    });
  }

  function setActive(routeId) {
    _activeRoute = routeId;
    render();
  }

  function toggle() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('visible');
  }

  function close() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
  }

  return {
    init: init,
    render: render,
    setActive: setActive,
    toggle: toggle,
    close: close
  };
})();
