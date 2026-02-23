var Router = (function() {
  var _currentRoute = '';

  function init() {
    window.addEventListener('hashchange', _handleRoute);
    _handleRoute();
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  function _handleRoute() {
    var hash = window.location.hash || '#/';
    var container = document.getElementById('main-content');
    if (!container) return;

    if (hash === '#/' || hash === '' || hash === '#') {
      _setTitle('Dashboard');
      Sidebar.setActive('dashboard');
      Stats.render(container);
    } else if (hash === '#/feedback/app') {
      _setTitle('Feedback de la App');
      Sidebar.setActive('app-feedback');
      FeedbackList.render(container, 'app');
    } else if (hash === '#/feedback/ai') {
      _setTitle('Feedback AI Chat');
      Sidebar.setActive('ai-feedback');
      FeedbackList.render(container, 'ai');
    } else if (hash.startsWith('#/feedback/')) {
      var feedbackId = hash.replace('#/feedback/', '');
      _setTitle('Detalle de Feedback');
      Sidebar.setActive(null);
      FeedbackDetail.render(container, feedbackId);
    } else if (hash === '#/chat') {
      _setTitle('Chat Administrativo');
      Sidebar.setActive('chat');
      ChatPanel.renderFullView(container);
    } else {
      _setTitle('Dashboard');
      Sidebar.setActive('dashboard');
      Stats.render(container);
    }

    Sidebar.close();
    _currentRoute = hash;
  }

  function _setTitle(title) {
    var el = document.getElementById('header-title');
    if (el) el.textContent = title;
  }

  function getCurrentRoute() { return _currentRoute; }

  return {
    init: init,
    navigate: navigate,
    getCurrentRoute: getCurrentRoute
  };
})();
