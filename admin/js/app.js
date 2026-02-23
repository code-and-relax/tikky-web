var App = (function() {

  async function init() {
    _initTheme();
    _verifyDependencies();

    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', _toggleTheme);
    }

    _setupLoginForm();
    _setupLoginErrorBack();

    var configOk = await Config.init();
    if (!configOk) {
      _showConfigError();
      return;
    }

    var loginForm = document.getElementById('login-form');
    var loginLoading = document.getElementById('login-loading');
    if (loginForm) loginForm.classList.add('hidden');
    if (loginLoading) loginLoading.classList.remove('hidden');

    var authenticated = await Auth.init();

    if (authenticated) {
      onAuthenticated();
    } else {
      if (loginLoading) loginLoading.classList.add('hidden');
      if (loginForm) loginForm.classList.remove('hidden');
    }
  }

  async function onAuthenticated() {
    var loginScreen = document.getElementById('login-screen');
    var appShell = document.getElementById('app-shell');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');

    var admin = Auth.getCurrentAdmin();
    Api.admins.register(admin);

    await Api.statuses.list();

    Sidebar.init();
    ChatPanel.init();

    _setupRealtime();

    Router.init();
  }

  function _setupLoginForm() {
    var emailInput = document.getElementById('login-email');
    var loginBtn = document.getElementById('login-btn');
    var loginMessage = document.getElementById('login-message');

    if (!loginBtn || !emailInput) return;

    loginBtn.addEventListener('click', async function() {
      var email = emailInput.value.trim();
      if (!email) return;

      loginBtn.disabled = true;
      loginBtn.textContent = 'Enviando...';
      if (loginMessage) {
        loginMessage.textContent = '';
        loginMessage.className = 'login-message';
      }

      var result = await Auth.signIn(email);

      if (result.success) {
        if (loginMessage) {
          loginMessage.textContent = 'Enlace enviado. Revisa tu correo electr\u00f3nico.';
          loginMessage.className = 'login-message success';
        }
      } else {
        if (loginMessage) {
          loginMessage.textContent = 'Error: ' + (result.error || 'No se pudo enviar el enlace.');
          loginMessage.className = 'login-message error';
        }
      }

      loginBtn.disabled = false;
      loginBtn.textContent = 'Enviar enlace m\u00e1gico';
    });

    emailInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') loginBtn.click();
    });
  }

  function _setupRealtime() {
    Api.chat.subscribe(function(message) {
      ChatPanel.onNewMessage(message);
    });

    Api.realtime.subscribeToReviews(function() {
      // Reviews handled by FeedbackDetail's own subscriptions when active
    });

    Api.realtime.subscribeToComments(function() {
      // Comments handled by FeedbackDetail's own subscriptions when active
    });
  }

  function _initTheme() {
    var saved = localStorage.getItem('tikky-admin-theme');
    if (saved === 'dark') {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      _updateThemeIcons(true);
    }
  }

  function _toggleTheme() {
    var isDark = document.body.classList.contains('theme-dark');
    document.body.classList.toggle('theme-dark');
    document.body.classList.toggle('theme-light');
    _updateThemeIcons(!isDark);
    localStorage.setItem('tikky-admin-theme', isDark ? 'light' : 'dark');
  }

  function _updateThemeIcons(isDark) {
    var lightIcon = document.getElementById('theme-icon-light');
    var darkIcon = document.getElementById('theme-icon-dark');
    if (lightIcon) lightIcon.classList.toggle('hidden', isDark);
    if (darkIcon) darkIcon.classList.toggle('hidden', !isDark);
  }

  function _setupLoginErrorBack() {
    var backBtn = document.getElementById('login-error-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        Auth.signOut();
      });
    }
  }

  function _showConfigError() {
    var loginLoading = document.getElementById('login-loading');
    var loginError = document.getElementById('login-error');
    var loginErrorText = document.getElementById('login-error-text');
    if (loginLoading) loginLoading.classList.add('hidden');
    if (loginError) loginError.classList.remove('hidden');
    if (loginErrorText) {
      loginErrorText.textContent =
        'Error de configuraci\u00f3n. No se pudo conectar con el servidor.';
    }
  }

  function _verifyDependencies() {
    if (typeof DOMPurify === 'undefined') {
      console.warn('[App] DOMPurify no disponible. Sanitizacion HTML deshabilitada - se usara textContent como fallback.');
    }
    if (typeof supabase === 'undefined') {
      console.warn('[App] Supabase JS no disponible. La aplicacion no funcionara correctamente.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init: init, onAuthenticated: onAuthenticated };
})();
