/**
 * Tikky Landing Page - Internationalization (i18n) Module
 * Handles dynamic language switching, content rendering, and theme management
 */

const I18n = (function() {
  'use strict';

  const STORAGE_KEY = 'tikky_landing_lang';
  const THEME_STORAGE_KEY = 'tikky_landing_theme';
  const DEFAULT_LANG = 'es';
  const SUPPORTED_LANGS = ['es', 'en', 'ar', 'zh'];
  const THEMES = { LIGHT: 'light', DARK: 'dark' };

  let currentLang = DEFAULT_LANG;
  let currentTheme = THEMES.LIGHT;
  let translations = null;

  // =========================================================================
  // Theme Functions
  // =========================================================================

  /**
   * Gets the preferred theme from localStorage or system preference
   */
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

  /**
   * Applies the theme to the document
   */
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  /**
   * Toggles between light and dark theme
   */
  function toggleTheme() {
    const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    applyTheme(newTheme);
  }

  // =========================================================================
  // Language Functions
  // =========================================================================

  /**
   * Detects the preferred language from various sources
   * Priority: localStorage > URL param > browser > default
   */
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

  /**
   * Loads translations from JSON file
   */
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

  /**
   * Saves language preference to localStorage
   */
  function saveLanguagePreference(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  /**
   * Updates URL without page reload
   */
  function updateUrl(lang) {
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url);
  }

  // =========================================================================
  // SVG Icon Definitions
  // =========================================================================

  const ICONS = {
    scanner: '<svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>',
    expenses: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 8h20"/><path d="M6 14h2"/><path d="M12 14h6"/></svg>',
    export: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l3-3 3 3"/><line x1="12" y1="12" x2="12" y2="18"/></svg>',
    currency: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9.354a4 4 0 1 0 0 5.292"/><line x1="9" y1="7" x2="9" y2="17"/></svg>'
  };

  // =========================================================================
  // Render Functions
  // =========================================================================

  /**
   * Renders the Google Play Store badge based on language
   */
  function getPlayBadgeUrl(lang) {
    var langMap = {
      es: 'es-419',
      en: 'en_US',
      ar: 'ar',
      zh: 'zh-CN'
    };
    var locale = langMap[lang] || 'en_US';
    return 'https://play.google.com/intl/' + locale + '/badges/static/images/badges/' + locale + '_badge_web_generic.png';
  }

  /**
   * Renders the complete page
   */
  function renderPage(data) {
    var container = document.getElementById('content-container');
    if (!container || !data) return;

    var featureCards = data.features.items.map(function(feature, index) {
      var iconKeys = ['scanner', 'expenses', 'export', 'currency'];
      var iconKey = iconKeys[index] || 'scanner';
      return '' +
        '<div class="feature-card fade-in">' +
          '<div class="feature-icon">' + ICONS[iconKey] + '</div>' +
          '<h3 class="feature-title">' + feature.title + '</h3>' +
          '<p class="feature-description">' + feature.description + '</p>' +
        '</div>';
    }).join('');

    var playStoreUrl = 'https://play.google.com/store/apps/details?id=com.nekki.tikky';
    var badgeUrl = getPlayBadgeUrl(currentLang);

    var html = '' +
      '<section class="hero">' +
        '<img class="hero-logo" src="assets/tikky-logo.webp" alt="Tikky Logo" width="128" height="128">' +
        '<h1 class="hero-title">Tikky</h1>' +
        '<p class="hero-tagline">' + data.hero.tagline + '</p>' +
        '<p class="hero-description">' + data.hero.description + '</p>' +
      '</section>' +

      '<section class="features fade-in">' +
        '<h2 class="features-title">' + data.features.title + '</h2>' +
        '<div class="features-grid">' + featureCards + '</div>' +
      '</section>' +

      '<section class="download fade-in">' +
        '<h2 class="download-title">' + data.download.title + '</h2>' +
        '<p class="download-subtitle">' + data.download.subtitle + '</p>' +
        '<a class="download-badge" href="' + playStoreUrl + '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' + badgeUrl + '" alt="' + data.download.badgeAlt + '" height="56">' +
        '</a>' +
      '</section>' +

      '<footer class="landing-footer">' +
        '<div class="footer-links">' +
          '<a class="footer-link" href="legal/">' + data.footer.privacy + '</a>' +
          '<a class="footer-link" href="account-deletion/">' + data.footer.accountDeletion + '</a>' +
        '</div>' +
        '<p class="footer-contact">' + data.footer.contact + ' <a href="mailto:tikky.oficialt@gmail.com">tikky.oficialt@gmail.com</a></p>' +
        '<p class="footer-copyright">' + data.footer.copyright + '</p>' +
      '</footer>';

    container.innerHTML = html;

    // Trigger fade-in animations
    requestAnimationFrame(function() {
      var fadeElements = document.querySelectorAll('.fade-in');
      fadeElements.forEach(function(el, i) {
        setTimeout(function() {
          el.classList.add('visible');
        }, i * 100);
      });
    });
  }

  /**
   * Updates language switcher UI
   */
  function updateLanguageSwitcher(lang) {
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
      var btnLang = btn.dataset.lang;
      btn.classList.toggle('active', btnLang === lang);
    });
  }

  /**
   * Switches to a new language
   */
  async function switchLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;

    var data = await loadTranslations(lang);
    if (data) {
      var newDirection = data.meta && data.meta.direction ? data.meta.direction : 'ltr';

      currentLang = lang;
      translations = data;
      saveLanguagePreference(lang);
      updateUrl(lang);
      updateLanguageSwitcher(lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = newDirection;

      renderPage(data);
    }
  }

  /**
   * Initializes the i18n module
   */
  async function init() {
    // Initialize theme first (prevent flash)
    currentTheme = getPreferredTheme();
    applyTheme(currentTheme);

    // Initialize language
    currentLang = getPreferredLanguage();
    translations = await loadTranslations(currentLang);

    if (translations) {
      updateLanguageSwitcher(currentLang);
      renderPage(translations);
      document.documentElement.lang = currentLang;
      var direction = translations.meta && translations.meta.direction ? translations.meta.direction : 'ltr';
      document.documentElement.dir = direction;
    }

    // Attach click handlers to language buttons
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var lang = btn.dataset.lang;
        switchLanguage(lang);
      });
    });

    // Attach click handler to theme switcher
    var themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) {
      themeSwitcher.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        var stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) {
          applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
        }
      });
    }
  }

  return {
    init: init,
    switchLanguage: switchLanguage,
    getCurrentLang: function() { return currentLang; },
    getTranslations: function() { return translations; },
    toggleTheme: toggleTheme,
    getCurrentTheme: function() { return currentTheme; }
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  I18n.init();
});
