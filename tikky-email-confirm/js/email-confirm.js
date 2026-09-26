/**
 * Tikky - Email Confirmation page.
 *
 * Mirrors tikky-password-reset (states, language/theme switchers, Supabase
 * config via getSupabaseWebConfig) without the password form: the token in
 * the URL is verified on load and the page lands on success or error.
 *
 * Accepted URL params: ?token_hash=...&type=signup (account activation) or
 * type=email_change (address change confirmation). Any other combination is
 * an invalid link.
 */
const EmailConfirm = (function () {
  'use strict';

  const LANG_STORAGE_KEY = 'tikky_confirm_lang';
  const THEME_STORAGE_KEY = 'tikky_confirm_theme';
  const RETRY_STORAGE_KEY = 'tikky_retry_ts';
  const RETRY_COOLDOWN_MS = 3000;
  const DEFAULT_LANG = 'es';
  const SUPPORTED_LANGS = ['es', 'en', 'de', 'hi', 'zh', 'ar'];
  const SUPPORTED_TYPES = ['signup', 'email_change'];
  const THEMES = { LIGHT: 'light', DARK: 'dark' };
  const STATES = { LOADING: 'loading', SUCCESS: 'success', ERROR: 'error' };
  const CONFIG_URL =
    'https://europe-west1-tikky-nekki.cloudfunctions.net/getSupabaseWebConfig';

  let currentLang = DEFAULT_LANG;
  let currentTheme = THEMES.LIGHT;
  let currentState = STATES.LOADING;
  let translations = null;
  let supabaseClient = null;
  let errorKey = null;
  let verifiedType = 'signup';

  // --- Theme -------------------------------------------------------------

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  function toggleTheme() {
    applyTheme(currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT);
  }

  function initialTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && Object.values(THEMES).includes(stored)) return stored;
    const prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? THEMES.DARK : THEMES.LIGHT;
  }

  // --- Language ----------------------------------------------------------

  async function loadTranslations(lang) {
    try {
      const response = await fetch('locales/' + lang + '.json');
      if (!response.ok) throw new Error('Failed to load ' + lang + '.json');
      return await response.json();
    } catch (error) {
      return lang !== DEFAULT_LANG ? loadTranslations(DEFAULT_LANG) : null;
    }
  }

  function markActiveLangButton(lang) {
    document.querySelectorAll('.lang-btn').forEach(function (button) {
      button.classList.toggle('active', button.dataset.lang === lang);
    });
  }

  function applyDocumentLang() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir =
      (translations && translations.meta.direction) || 'ltr';
  }

  async function switchLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
    const loaded = await loadTranslations(lang);
    if (!loaded) return;
    currentLang = lang;
    translations = loaded;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    markActiveLangButton(lang);
    applyDocumentLang();
    render();
  }

  function initialLang() {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
    const fromQuery = new URLSearchParams(window.location.search).get('lang');
    if (fromQuery && SUPPORTED_LANGS.includes(fromQuery)) return fromQuery;
    const fromBrowser = navigator.language.split('-')[0];
    return SUPPORTED_LANGS.includes(fromBrowser) ? fromBrowser : DEFAULT_LANG;
  }

  // --- Supabase ----------------------------------------------------------

  async function initSupabase() {
    let config = null;
    try {
      const response = await fetch(CONFIG_URL);
      if (!response.ok) throw new Error('Failed to fetch config');
      config = await response.json();
    } catch (error) {
      return false;
    }
    if (!config || !config.url || !config.anonKey) return false;
    try {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function verifyTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || !SUPPORTED_TYPES.includes(type)) {
      errorKey = 'invalidLink';
      return false;
    }
    verifiedType = type;
    try {
      const { error } = await supabaseClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: type,
      });
      if (!error) {
        // Hygiene: the page does not need the session verifyOtp creates;
        // drop it so no credentials linger in the browser (best-effort).
        try {
          await supabaseClient.auth.signOut();
        } catch (signOutError) {
          // Ignored: the confirmation itself already succeeded.
        }
        return true;
      }
      errorKey = error.message.includes('expired')
        ? 'tokenExpired'
        : 'verificationFailed';
      return false;
    } catch (error) {
      errorKey = 'verificationFailed';
      return false;
    }
  }

  // --- Rendering ---------------------------------------------------------

  function footerHtml() {
    return (
      '<footer class="reset-footer">' +
      '<p class="footer-company">' + translations.footer.company + '</p>' +
      '<p class="footer-contact">' + translations.footer.contact + '</p>' +
      '</footer>'
    );
  }

  function loadingHtml() {
    return (
      '<div class="loading-container">' +
      '<div class="spinner"></div>' +
      '<p class="loading-text">' + translations.states.loading.message + '</p>' +
      '</div>'
    );
  }

  function successHtml() {
    const base = translations.states.success;
    // email_change reuses the approved success copy until its dedicated
    // strings (states.success.emailChange) are approved and added to the
    // locales; the key is read defensively so adding it needs no JS change.
    const specific =
      verifiedType === 'email_change' && base.emailChange
        ? base.emailChange
        : base;
    return (
      '<div class="success-container">' +
      '<div class="success-icon">' +
      '<svg viewBox="0 0 24 24">' +
      '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>' +
      '</svg>' +
      '</div>' +
      '<h2 class="success-title">' + (specific.title || base.title) + '</h2>' +
      '<p class="success-message">' + (specific.message || base.message) + '</p>' +
      '<p class="success-instruction">' +
      (specific.instruction || base.instruction) +
      '</p>' +
      '<a href="tikky://" class="open-app-btn">' + base.openApp + '</a>' +
      '</div>' +
      footerHtml()
    );
  }

  function errorHtml() {
    const error = translations.states.error;
    const message = error[errorKey] || error.verificationFailed;
    return (
      '<div class="error-container">' +
      '<div class="error-icon">' +
      '<svg viewBox="0 0 24 24">' +
      '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>' +
      '</svg>' +
      '</div>' +
      '<h2 class="error-title">' + error.title + '</h2>' +
      '<p class="error-message">' + message + '</p>' +
      '<button class="retry-btn" id="retry-btn">' + error.retry + '</button>' +
      '</div>' +
      footerHtml()
    );
  }

  function render() {
    const container = document.getElementById('content-container');
    if (!container || !translations) return;
    let html = '';
    switch (currentState) {
      case STATES.LOADING:
        html = loadingHtml();
        break;
      case STATES.SUCCESS:
        html = successHtml();
        break;
      case STATES.ERROR:
        html = errorHtml();
        break;
    }
    container.innerHTML = html;
    if (currentState === STATES.ERROR) bindRetryButton();
  }

  // --- Retry (rate limited reload, mirrors the reset page) ---------------

  function retryCooldownRemaining() {
    const stamp = sessionStorage.getItem(RETRY_STORAGE_KEY);
    if (!stamp) return 0;
    const remaining = RETRY_COOLDOWN_MS - (Date.now() - parseInt(stamp, 10));
    return remaining > 0 ? remaining : 0;
  }

  function bindRetryButton() {
    const button = document.getElementById('retry-btn');
    if (!button) return;
    const idleLabel = translations.states.error.retry;
    let timer = null;

    function refresh() {
      const remaining = retryCooldownRemaining();
      if (remaining > 0) {
        const seconds = Math.ceil(remaining / 1000);
        button.textContent = translations.states.error.retryWait.replace(
          '{seconds}',
          seconds
        );
        button.disabled = true;
        return true;
      }
      button.textContent = idleLabel;
      button.disabled = false;
      return false;
    }

    function tick() {
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        if (!refresh()) {
          clearInterval(timer);
          timer = null;
        }
      }, 200);
    }

    if (refresh()) tick();
    button.addEventListener('click', function () {
      if (retryCooldownRemaining() > 0) return;
      sessionStorage.setItem(RETRY_STORAGE_KEY, Date.now().toString());
      location.reload();
    });
  }

  // --- Entry point ---------------------------------------------------------

  async function init() {
    applyTheme(initialTheme());

    currentLang = initialLang();
    translations = await loadTranslations(currentLang);
    if (translations) {
      markActiveLangButton(currentLang);
      applyDocumentLang();
      currentState = STATES.LOADING;
      render();
    }

    document.querySelectorAll('.lang-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        switchLanguage(button.dataset.lang);
      });
    });
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) themeSwitcher.addEventListener('click', toggleTheme);
    if (window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', function (event) {
          if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            applyTheme(event.matches ? THEMES.DARK : THEMES.LIGHT);
          }
        });
    }

    if (!(await initSupabase())) {
      errorKey = 'verificationFailed';
      currentState = STATES.ERROR;
      render();
      return;
    }

    const verified = await verifyTokenFromUrl();
    currentState = verified ? STATES.SUCCESS : STATES.ERROR;
    render();
  }

  return {
    init: init,
    switchLanguage: switchLanguage,
    toggleTheme: toggleTheme,
  };
})();

EmailConfirm.init();
