var Auth = (function() {
  var _currentAdmin = null;
  var _session = null;

  async function init() {
    var client = Config.getClient();
    if (!client) return false;

    var sessionResult = await client.auth.getSession();
    var session = sessionResult.data.session;
    if (session) {
      _session = session;
      return await _verifyAdmin(session);
    }

    if (window.location.hash && window.location.hash.includes('access_token')) {
      var refreshResult = await client.auth.getSession();
      var newSession = refreshResult.data.session;
      if (newSession) {
        _session = newSession;
        history.replaceState(null, '', window.location.pathname + window.location.search);
        return await _verifyAdmin(newSession);
      }
    }

    client.auth.onAuthStateChange(async function(event, session) {
      if (event === 'SIGNED_IN' && session) {
        _session = session;
        var verified = await _verifyAdmin(session);
        if (verified) {
          _showApp();
        } else {
          _showAccessDenied();
        }
      } else if (event === 'SIGNED_OUT') {
        _currentAdmin = null;
        _session = null;
        _showLogin();
      }
    });

    return false;
  }

  async function _verifyAdmin(session) {
    var client = Config.getClient();
    var email = session.user.email;

    var result = await client
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (result.error || !result.data) {
      console.warn('[Auth] Not an authorized admin:', email);
      return false;
    }

    _currentAdmin = result.data;

    if (!result.data.user_id) {
      await client
        .from('admin_users')
        .update({ user_id: session.user.id })
        .eq('id', result.data.id);
      _currentAdmin.user_id = session.user.id;
    }

    return true;
  }

  async function signIn(email) {
    var client = Config.getClient();
    var result = await client.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin + '/tikky-web/admin/'
      }
    });
    return {
      success: !result.error,
      error: result.error ? result.error.message : null
    };
  }

  async function signOut() {
    var client = Config.getClient();
    if (client) await client.auth.signOut();
    _currentAdmin = null;
    _session = null;
    _showLogin();
  }

  function getCurrentAdmin() { return _currentAdmin; }
  function getSession() { return _session; }
  function isAuthenticated() { return _currentAdmin !== null && _session !== null; }

  function _showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('login-loading').classList.add('hidden');
    document.getElementById('login-error').classList.add('hidden');
  }

  function _showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    App.onAuthenticated();
  }

  function _showAccessDenied() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('login-loading').classList.add('hidden');
    document.getElementById('login-error').classList.remove('hidden');
    document.getElementById('login-error-text').textContent =
      'Acceso denegado. Esta cuenta no tiene permisos de administrador.';
  }

  return {
    init: init,
    signIn: signIn,
    signOut: signOut,
    getCurrentAdmin: getCurrentAdmin,
    getSession: getSession,
    isAuthenticated: isAuthenticated
  };
})();
