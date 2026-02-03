/**
 * Tikky Password Reset - Main Script
 * Handles password reset flow with Supabase integration
 */

const PasswordReset = (function() {
  'use strict';

  // ==========================================================================
  // Constants
  // ==========================================================================

  const STORAGE_KEY = 'tikky_reset_lang';
  const THEME_STORAGE_KEY = 'tikky_reset_theme';
  const RETRY_STORAGE_KEY = 'tikky_retry_ts';
  const RETRY_COOLDOWN = 3000;
  const DEFAULT_LANG = 'es';
  const SUPPORTED_LANGS = ['es', 'en', 'ar', 'zh'];
  const THEMES = { LIGHT: 'light', DARK: 'dark' };
  const CONFIG_URL = 'https://europe-west1-tikky-nekki.cloudfunctions.net/getSupabaseWebConfig';
  const DEEP_LINK = 'tikky://';

  // States
  const STATE = {
    LOADING: 'loading',
    FORM: 'form',
    SUCCESS: 'success',
    ERROR: 'error'
  };

  // ==========================================================================
  // State
  // ==========================================================================

  let currentLang = DEFAULT_LANG;
  let currentTheme = THEMES.LIGHT;
  let currentState = STATE.LOADING;
  let translations = null;
  let supabase = null;
  let errorType = null;

  // ==========================================================================
  // Theme Functions
  // ==========================================================================

  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && Object.values(THEMES).includes(stored)) {
      return stored;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }

    return THEMES.LIGHT;
  }

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  function toggleTheme() {
    const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    applyTheme(newTheme);
  }

  // ==========================================================================
  // Language Functions
  // ==========================================================================

  function getPreferredLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) {
      return stored;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
      return urlLang;
    }

    const browserLang = navigator.language.split('-')[0];
    if (SUPPORTED_LANGS.includes(browserLang)) {
      return browserLang;
    }

    return DEFAULT_LANG;
  }

  async function loadTranslations(lang) {
    try {
      const response = await fetch('locales/' + lang + '.json');
      if (!response.ok) {
        throw new Error('Failed to load ' + lang + '.json');
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading translations:', error);
      if (lang !== DEFAULT_LANG) {
        return loadTranslations(DEFAULT_LANG);
      }
      return null;
    }
  }

  function saveLanguagePreference(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function updateLanguageSwitcher(lang) {
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
      const btnLang = btn.dataset.lang;
      btn.classList.toggle('active', btnLang === lang);
    });
  }

  async function switchLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;

    const data = await loadTranslations(lang);
    if (data) {
      currentLang = lang;
      translations = data;
      saveLanguagePreference(lang);
      updateLanguageSwitcher(lang);
      document.documentElement.lang = lang;

      const direction = data.meta.direction || 'ltr';
      document.documentElement.dir = direction;

      renderCurrentState();
    }
  }

  // ==========================================================================
  // Supabase Functions
  // ==========================================================================

  async function fetchSupabaseConfig() {
    try {
      const response = await fetch(CONFIG_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching Supabase config:', error);
      return null;
    }
  }

  async function initSupabase() {
    const config = await fetchSupabaseConfig();
    if (!config || !config.url || !config.anonKey) {
      return false;
    }

    try {
      supabase = window.supabase.createClient(config.url, config.anonKey);
      return true;
    } catch (error) {
      console.error('Error initializing Supabase:', error);
      return false;
    }
  }

  async function verifyToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenHash = urlParams.get('token_hash');
    const type = urlParams.get('type');

    if (!tokenHash || type !== 'recovery') {
      errorType = 'invalidLink';
      return false;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery'
      });

      if (error) {
        console.error('Token verification error:', error);
        if (error.message.includes('expired')) {
          errorType = 'tokenExpired';
        } else {
          errorType = 'verificationFailed';
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token verification exception:', error);
      errorType = 'verificationFailed';
      return false;
    }
  }

  async function updatePassword(newPassword) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Password update exception:', error);
      return false;
    }
  }

  // ==========================================================================
  // Password Validation
  // ==========================================================================

  function validatePassword(password) {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password)
    };
  }

  function isPasswordValid(validation) {
    return validation.minLength &&
           validation.hasUppercase &&
           validation.hasLowercase &&
           validation.hasNumber;
  }

  // ==========================================================================
  // Render Functions
  // ==========================================================================

  function renderLoading() {
    const t = translations.states.loading;
    return '\
      <div class="loading-container">\
        <div class="spinner"></div>\
        <p class="loading-text">' + t.message + '</p>\
      </div>';
  }

  function renderForm() {
    const t = translations.states.form;
    const req = t.requirements;
    return '\
      <header class="reset-header">\
        <img src="assets/tikky-logo.png" alt="Tikky" class="logo">\
        <h1 class="reset-title">' + t.title + '</h1>\
        <p class="reset-subtitle">' + t.subtitle + '</p>\
      </header>\
      <form class="reset-form" id="reset-form">\
        <div class="form-group">\
          <label class="form-label" for="new-password">' + t.newPassword + '</label>\
          <div class="input-wrapper">\
            <input type="password" id="new-password" class="form-input" autocomplete="new-password" required>\
            <button type="button" class="password-toggle" data-target="new-password" aria-label="Toggle password visibility">\
              <svg viewBox="0 0 24 24" class="eye-icon">\
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>\
              </svg>\
            </button>\
          </div>\
          <ul class="requirements-list">\
            <li class="requirement-item" data-req="minLength">' + req.minLength + '</li>\
            <li class="requirement-item" data-req="hasUppercase">' + req.hasUppercase + '</li>\
            <li class="requirement-item" data-req="hasLowercase">' + req.hasLowercase + '</li>\
            <li class="requirement-item" data-req="hasNumber">' + req.hasNumber + '</li>\
          </ul>\
        </div>\
        <div class="form-group">\
          <label class="form-label" for="confirm-password">' + t.confirmPassword + '</label>\
          <div class="input-wrapper">\
            <input type="password" id="confirm-password" class="form-input" autocomplete="new-password" required>\
            <button type="button" class="password-toggle" data-target="confirm-password" aria-label="Toggle password visibility">\
              <svg viewBox="0 0 24 24" class="eye-icon">\
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>\
              </svg>\
            </button>\
          </div>\
          <p class="form-error" id="confirm-error" style="display: none;"></p>\
        </div>\
        <button type="submit" class="submit-btn" id="submit-btn" disabled>\
          <span class="btn-text">' + t.submit + '</span>\
        </button>\
      </form>\
      <footer class="reset-footer">\
        <p class="footer-company">' + translations.footer.company + '</p>\
        <p class="footer-contact">' + translations.footer.contact + '</p>\
      </footer>';
  }

  function renderSuccess() {
    const t = translations.states.success;
    return '\
      <div class="success-container">\
        <div class="success-icon">\
          <svg viewBox="0 0 24 24">\
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>\
          </svg>\
        </div>\
        <h2 class="success-title">' + t.title + '</h2>\
        <p class="success-message">' + t.message + '</p>\
        <p class="success-instruction">' + t.instruction + '</p>\
        <a href="' + DEEP_LINK + '" class="open-app-btn">' + t.openApp + '</a>\
      </div>\
      <footer class="reset-footer">\
        <p class="footer-company">' + translations.footer.company + '</p>\
        <p class="footer-contact">' + translations.footer.contact + '</p>\
      </footer>';
  }

  function renderError() {
    const t = translations.states.error;
    const errorMessage = t[errorType] || t.verificationFailed;
    return '\
      <div class="error-container">\
        <div class="error-icon">\
          <svg viewBox="0 0 24 24">\
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>\
          </svg>\
        </div>\
        <h2 class="error-title">' + t.title + '</h2>\
        <p class="error-message">' + errorMessage + '</p>\
        <button class="retry-btn" id="retry-btn">' + t.retry + '</button>\
      </div>\
      <footer class="reset-footer">\
        <p class="footer-company">' + translations.footer.company + '</p>\
        <p class="footer-contact">' + translations.footer.contact + '</p>\
      </footer>';
  }

  function renderCurrentState() {
    const container = document.getElementById('content-container');
    if (!container || !translations) return;

    let html = '';
    switch (currentState) {
      case STATE.LOADING:
        html = renderLoading();
        break;
      case STATE.FORM:
        html = renderForm();
        break;
      case STATE.SUCCESS:
        html = renderSuccess();
        break;
      case STATE.ERROR:
        html = renderError();
        break;
    }

    container.innerHTML = html;

    if (currentState === STATE.FORM) {
      attachFormListeners();
    }

    if (currentState === STATE.ERROR) {
      attachRetryListener();
    }
  }

  function getRemainingCooldown() {
    var lastRetry = sessionStorage.getItem(RETRY_STORAGE_KEY);
    if (!lastRetry) return 0;
    var elapsed = Date.now() - parseInt(lastRetry, 10);
    var remaining = RETRY_COOLDOWN - elapsed;
    return remaining > 0 ? remaining : 0;
  }

  function attachRetryListener() {
    var retryBtn = document.getElementById('retry-btn');
    if (!retryBtn) return;

    var countdownInterval = null;
    var originalText = translations.states.error.retry;

    function updateButtonState() {
      var remaining = getRemainingCooldown();
      if (remaining > 0) {
        var seconds = Math.ceil(remaining / 1000);
        var waitText = translations.states.error.retryWait.replace('{seconds}', seconds);
        retryBtn.textContent = waitText;
        retryBtn.disabled = true;
        return true;
      } else {
        retryBtn.textContent = originalText;
        retryBtn.disabled = false;
        return false;
      }
    }

    function startCountdown() {
      if (countdownInterval) clearInterval(countdownInterval);
      countdownInterval = setInterval(function() {
        if (!updateButtonState()) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
      }, 200);
    }

    if (updateButtonState()) {
      startCountdown();
    }

    retryBtn.addEventListener('click', function() {
      if (getRemainingCooldown() > 0) return;
      sessionStorage.setItem(RETRY_STORAGE_KEY, Date.now().toString());
      location.reload();
    });
  }

  // ==========================================================================
  // Form Event Handlers
  // ==========================================================================

  function attachFormListeners() {
    const form = document.getElementById('reset-form');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const submitBtn = document.getElementById('submit-btn');
    const confirmError = document.getElementById('confirm-error');

    // Password validation on input
    newPasswordInput.addEventListener('input', function() {
      const validation = validatePassword(this.value);
      updateRequirements(validation);
      checkFormValidity();
    });

    // Confirm password validation
    confirmPasswordInput.addEventListener('input', function() {
      checkFormValidity();
    });

    // Password toggle buttons
    document.querySelectorAll('.password-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const targetId = this.dataset.target;
        const input = document.getElementById(targetId);
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
      });
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      // Validate passwords match
      if (newPassword !== confirmPassword) {
        confirmError.textContent = translations.states.error.passwordMismatch;
        confirmError.style.display = 'block';
        confirmPasswordInput.classList.add('error');
        return;
      }

      // Show loading state on button
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div>';

      // Update password
      const success = await updatePassword(newPassword);

      if (success) {
        currentState = STATE.SUCCESS;
        renderCurrentState();
      } else {
        errorType = 'updateFailed';
        currentState = STATE.ERROR;
        renderCurrentState();
      }
    });

    function updateRequirements(validation) {
      document.querySelectorAll('.requirement-item').forEach(function(item) {
        const req = item.dataset.req;
        item.classList.toggle('valid', validation[req]);
      });
    }

    function checkFormValidity() {
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;
      const validation = validatePassword(newPassword);
      const isValid = isPasswordValid(validation);
      const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

      submitBtn.disabled = !isValid || !passwordsMatch;

      // Clear error when passwords match
      if (passwordsMatch || confirmPassword.length === 0) {
        confirmError.style.display = 'none';
        confirmPasswordInput.classList.remove('error');
      }
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  async function init() {
    // Initialize theme first
    currentTheme = getPreferredTheme();
    applyTheme(currentTheme);

    // Initialize language
    currentLang = getPreferredLanguage();
    translations = await loadTranslations(currentLang);

    if (translations) {
      updateLanguageSwitcher(currentLang);
      document.documentElement.lang = currentLang;
      const direction = translations.meta.direction || 'ltr';
      document.documentElement.dir = direction;

      // Show loading state
      currentState = STATE.LOADING;
      renderCurrentState();
    }

    // Attach language switcher handlers
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const lang = btn.dataset.lang;
        switchLanguage(lang);
      });
    });

    // Attach theme switcher handler
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) {
      themeSwitcher.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) {
          applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
        }
      });
    }

    // Initialize Supabase and verify token
    const supabaseInitialized = await initSupabase();
    if (!supabaseInitialized) {
      errorType = 'verificationFailed';
      currentState = STATE.ERROR;
      renderCurrentState();
      return;
    }

    const tokenValid = await verifyToken();
    if (tokenValid) {
      currentState = STATE.FORM;
    } else {
      currentState = STATE.ERROR;
    }
    renderCurrentState();
  }

  // Public API
  return {
    init: init,
    switchLanguage: switchLanguage,
    toggleTheme: toggleTheme
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  PasswordReset.init();
});
