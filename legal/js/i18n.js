/**
 * Tikky Privacy Policy - Internationalization (i18n) Module
 * Handles dynamic language switching and content rendering
 */

const I18n = (function() {
  'use strict';

  const STORAGE_KEY = 'tikky_privacy_lang';
  const THEME_STORAGE_KEY = 'tikky_privacy_theme';
  const DEFAULT_LANG = 'es';
  const SUPPORTED_LANGS = ['es', 'en', 'ar', 'zh'];
  const THEMES = { LIGHT: 'light', DARK: 'dark' };

  let currentLang = DEFAULT_LANG;
  let currentTheme = THEMES.LIGHT;
  let translations = null;
  let tocObserver = null;

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
  // TOC Functions
  // =========================================================================

  /**
   * Generates the table of contents from sections
   */
  function generateToc() {
    const tocList = document.getElementById('toc-list');
    const tocTitle = document.getElementById('toc-title');
    if (!tocList || !translations?.sections) return;

    // Update TOC title based on current language
    if (tocTitle) {
      tocTitle.textContent = translations.meta?.tocTitle || 'Contents';
    }

    const items = translations.sections.map(section => {
      const title = section.title.length > 25
        ? section.title.substring(0, 25) + '...'
        : section.title;
      const linkText = `${section.number}. ${title}`;
      return `
        <li class="toc-item">
          <a class="toc-link" href="#${section.id}" data-section="${section.id}" data-text="${linkText}">
            ${linkText}
          </a>
        </li>
      `;
    }).join('');

    tocList.innerHTML = items;

    // Attach click handlers for smooth scrolling
    tocList.querySelectorAll('.toc-link').forEach(link => {
      link.addEventListener('click', handleTocClick);
    });

    // Setup intersection observer
    setupTocObserver();
  }

  /**
   * Handles TOC link clicks for smooth scrolling
   */
  function handleTocClick(e) {
    e.preventDefault();
    const sectionId = e.currentTarget.dataset.section;
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Stores the scroll handler reference for cleanup
   */
  let scrollHandler = null;

  /**
   * Checks if user has scrolled to the bottom of the page
   */
  function isAtPageBottom() {
    const threshold = 50;
    return window.scrollY + window.innerHeight >= document.body.scrollHeight - threshold;
  }

  /**
   * Gets the last section ID from the TOC
   */
  function getLastSectionId() {
    const sections = document.querySelectorAll('.policy-section');
    if (sections.length === 0) return null;
    return sections[sections.length - 1].id;
  }

  /**
   * Handles scroll events to detect page bottom
   */
  function handleScrollEnd() {
    if (isAtPageBottom()) {
      const lastSectionId = getLastSectionId();
      if (lastSectionId) {
        updateActiveTocItem(lastSectionId);
      }
    }
  }

  /**
   * Sets up Intersection Observer to track current section
   */
  function setupTocObserver() {
    // Clean up previous observer
    if (tocObserver) {
      tocObserver.disconnect();
    }

    // Clean up previous scroll handler
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
    }

    const sections = document.querySelectorAll('.policy-section');
    if (sections.length === 0) return;

    // Track visible sections to select the one closest to top
    let visibleSections = new Map();

    tocObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        // Select the section closest to the top of the detection zone
        if (visibleSections.size > 0 && !isAtPageBottom()) {
          let closestSection = null;
          let closestDistance = Infinity;

          visibleSections.forEach((top, id) => {
            const distance = Math.abs(top);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestSection = id;
            }
          });

          if (closestSection) {
            updateActiveTocItem(closestSection);
          }
        }
      },
      {
        rootMargin: '-10% 0px -60% 0px',
        threshold: [0, 0.25, 0.5]
      }
    );

    sections.forEach(section => {
      tocObserver.observe(section);
    });

    // Add scroll listener for page bottom detection
    scrollHandler = handleScrollEnd;
    window.addEventListener('scroll', scrollHandler, { passive: true });
  }

  /**
   * Updates the active state on TOC items
   */
  function updateActiveTocItem(sectionId) {
    document.querySelectorAll('.toc-link').forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionId);
    });
  }

  // =========================================================================
  // Direction Change Animation Functions
  // =========================================================================

  /**
   * Animates TOC and theme switcher when direction changes (LTR <-> RTL)
   * Controls the full sequence: exit animation -> direction change -> render -> enter animation
   * @param {string} oldDir - Old direction ('ltr' or 'rtl')
   * @param {string} newDir - New direction ('ltr' or 'rtl')
   */
  function animateDirectionChange(oldDir, newDir) {
    const toc = document.querySelector('.toc');
    const themeSwitcher = document.getElementById('theme-switcher');
    const exitClass = oldDir === 'ltr' ? 'exiting-ltr' : 'exiting-rtl';
    const enterClass = newDir === 'ltr' ? 'entering-ltr' : 'entering-rtl';

    // 1. Exit animation in current position
    if (toc) toc.classList.add(exitClass);
    if (themeSwitcher) themeSwitcher.classList.add(exitClass);

    // 2. After exit: change direction, render, then enter animation
    setTimeout(() => {
      // Change direction (elements move but are invisible)
      document.documentElement.dir = newDir;

      // Render content
      renderPage(translations);

      // Clean up exit class
      if (toc) toc.classList.remove(exitClass);
      if (themeSwitcher) themeSwitcher.classList.remove(exitClass);

      // 3. Enter animation in new position
      if (toc) {
        toc.classList.add('entering');
        void toc.offsetWidth;
        toc.classList.remove('entering');
      }
      if (themeSwitcher) {
        themeSwitcher.classList.add(enterClass);
        setTimeout(() => {
          themeSwitcher.classList.remove(enterClass);
        }, 300);
      }
    }, 300);
  }

  // =========================================================================
  // Language Functions
  // =========================================================================

  /**
   * Detects the preferred language from various sources
   * Priority: localStorage > URL param > browser > default
   */
  function getPreferredLanguage() {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) {
      return stored;
    }

    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
      return urlLang;
    }

    // Check browser language
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
      const response = await fetch(`locales/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load ${lang}.json`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading translations:', error);
      // Fallback to default language if different
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

  /**
   * Renders a paragraph element
   */
  function renderParagraph(item) {
    return `<p class="content-paragraph">${item.text}</p>`;
  }

  /**
   * Renders a list element
   */
  function renderList(item) {
    const items = item.items.map(text => `<li>${text}</li>`).join('');
    return `<ul class="content-list">${items}</ul>`;
  }

  /**
   * Renders a table element
   */
  function renderTable(item) {
    const headers = item.headers.map(h => `<th>${h}</th>`).join('');
    const rows = item.rows.map(row => {
      const cells = row.map(cell => `<td>${cell}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <div class="table-wrapper">
        <table class="content-table">
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  /**
   * Renders an info box element
   */
  function renderInfoBox(item) {
    return `
      <div class="info-box">
        <div class="info-box-title">${item.title}</div>
        <div class="info-box-text">${item.text}</div>
      </div>
    `;
  }

  /**
   * Renders a warning box element
   */
  function renderWarningBox(item) {
    return `
      <div class="warning-box">
        <div class="warning-box-title">${item.title}</div>
        <div class="warning-box-text">${item.text}</div>
      </div>
    `;
  }

  /**
   * Renders a contact card element
   */
  function renderContactCard(item) {
    const { data, labels } = item;
    let html = '<div class="contact-card">';

    // Render in specific order if available
    const order = ['company', 'owner', 'email'];
    order.forEach(key => {
      if (data[key] && labels[key]) {
        const value = key === 'email'
          ? `<a href="mailto:${data[key]}">${data[key]}</a>`
          : data[key];
        html += `<p class="contact-card-item"><span class="contact-card-label">${labels[key]}</span> ${value}</p>`;
      }
    });

    html += '</div>';
    return html;
  }

  /**
   * Renders content items based on type
   */
  function renderContent(content) {
    if (!content || !Array.isArray(content)) return '';

    return content.map(item => {
      switch (item.type) {
        case 'paragraph':
          return renderParagraph(item);
        case 'list':
          return renderList(item);
        case 'table':
          return renderTable(item);
        case 'info-box':
          return renderInfoBox(item);
        case 'warning-box':
          return renderWarningBox(item);
        case 'contact-card':
          return renderContactCard(item);
        default:
          return '';
      }
    }).join('');
  }

  /**
   * Renders subsections
   */
  function renderSubsections(subsections) {
    if (!subsections || !Array.isArray(subsections)) return '';

    return subsections.map(sub => `
      <div class="subsection" id="${sub.id}">
        <h3 class="subsection-title">${sub.number} ${sub.title}</h3>
        ${renderContent(sub.content)}
      </div>
    `).join('');
  }

  /**
   * Renders all sections
   */
  function renderSections(sections) {
    if (!sections || !Array.isArray(sections)) return '';

    return sections.map(section => `
      <section class="policy-section" id="${section.id}">
        <div class="section-header">
          <span class="section-number">${section.number}</span>
          <h2 class="section-title">${section.title}</h2>
        </div>
        ${renderContent(section.content)}
        ${renderSubsections(section.subsections)}
      </section>
    `).join('');
  }

  /**
   * Renders the complete page
   */
  function renderPage(data) {
    const container = document.getElementById('content-container');
    if (!container || !data) return;

    const html = `
      <header class="policy-header">
        <h1 class="policy-title">${data.meta.title}</h1>
        <p class="policy-subtitle">${data.meta.subtitle}</p>
        <p class="policy-date">${data.meta.lastUpdated}</p>
      </header>

      <main class="policy-content">
        ${renderSections(data.sections)}
      </main>

      <footer class="policy-footer">
        <p class="footer-company">${data.footer.company}</p>
        <p class="footer-effective">${data.footer.effective}</p>
      </footer>
    `;

    container.innerHTML = html;

    // Generate TOC after rendering content
    generateToc();
  }

  /**
   * Updates language switcher UI
   */
  function updateLanguageSwitcher(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      const btnLang = btn.dataset.lang;
      btn.classList.toggle('active', btnLang === lang);
    });
  }

  /**
   * Switches to a new language
   */
  async function switchLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;

    const data = await loadTranslations(lang);
    if (data) {
      const oldDirection = document.documentElement.dir || 'ltr';
      const newDirection = data.meta?.direction || 'ltr';
      const directionChanged = oldDirection !== newDirection;

      currentLang = lang;
      translations = data;
      saveLanguagePreference(lang);
      updateUrl(lang);
      updateLanguageSwitcher(lang);
      document.documentElement.lang = lang;

      // If direction changes: animate exit, change direction, animate enter
      if (directionChanged) {
        animateDirectionChange(oldDirection, newDirection);
      } else {
        // No direction change: update immediately
        renderPage(data);
      }
    }
  }

  /**
   * Initializes the i18n module
   */
  async function init() {
    // Initialize theme first (before content loads to prevent flash)
    currentTheme = getPreferredTheme();
    applyTheme(currentTheme);

    // Initialize language
    currentLang = getPreferredLanguage();
    translations = await loadTranslations(currentLang);

    if (translations) {
      updateLanguageSwitcher(currentLang);
      renderPage(translations);
      document.documentElement.lang = currentLang;
      const direction = translations.meta?.direction || 'ltr';
      document.documentElement.dir = direction;
    }

    // Attach click handlers to language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        switchLanguage(lang);
      });
    });

    // Attach click handler to theme switcher
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) {
      themeSwitcher.addEventListener('click', toggleTheme);
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only auto-switch if user hasn't set a preference
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) {
          applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
        }
      });
    }
  }

  // Public API
  return {
    init,
    switchLanguage,
    getCurrentLang: () => currentLang,
    getTranslations: () => translations,
    toggleTheme,
    getCurrentTheme: () => currentTheme
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  I18n.init();
});
