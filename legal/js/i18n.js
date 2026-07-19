/**
 * Tikky legal pages i18n renderer.
 *
 * Loads locales/<lang>.json relative to the current page and renders the
 * document (header, sections, footer) plus a table of contents. Shared by
 * the legal index, privacy, terms, aviso-legal and account-deletion pages.
 *
 * Supported block types inside section content: paragraph, list, table,
 * info-box, warning-box, contact-card.
 */
const I18n = (function () {
  'use strict';

  const LANG_STORAGE_KEY = 'tikky_privacy_lang';
  const THEME_STORAGE_KEY = 'tikky_privacy_theme';
  const DEFAULT_LANG = 'es';
  const SUPPORTED_LANGS = ['es', 'en', 'de', 'hi', 'zh', 'ar'];
  const THEMES = { LIGHT: 'light', DARK: 'dark' };

  let currentLang = DEFAULT_LANG;
  let currentTheme = THEMES.LIGHT;
  let translations = null;
  let sectionObserver = null;
  let scrollListener = null;

  // ---------------------------------------------------------------- theme --

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  function toggleTheme() {
    applyTheme(currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT);
  }

  function resolveInitialTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && Object.values(THEMES).includes(stored)) return stored;
    const prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? THEMES.DARK : THEMES.LIGHT;
  }

  // ----------------------------------------------------------------- data --

  async function loadTranslations(lang) {
    try {
      const response = await fetch('locales/' + lang + '.json');
      if (!response.ok) throw new Error('Failed to load ' + lang + '.json');
      return await response.json();
    } catch (error) {
      return lang !== DEFAULT_LANG ? loadTranslations(DEFAULT_LANG) : null;
    }
  }

  function resolveInitialLang() {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl && SUPPORTED_LANGS.includes(fromUrl)) return fromUrl;
    const browserLang = navigator.language.split('-')[0];
    return SUPPORTED_LANGS.includes(browserLang) ? browserLang : DEFAULT_LANG;
  }

  // -------------------------------------------------------------- renderers --

  function renderParagraph(block) {
    return '<p class="content-paragraph">' + block.text + '</p>';
  }

  function renderList(block) {
    const items = block.items.map(function (item) {
      return '<li>' + item + '</li>';
    }).join('');
    return '<ul class="content-list">' + items + '</ul>';
  }

  function renderTable(block) {
    const headers = block.headers.map(function (header) {
      return '<th>' + header + '</th>';
    }).join('');
    const rows = block.rows.map(function (row) {
      const cells = row.map(function (cell) {
        return '<td>' + cell + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');
    return '<div class="table-wrapper"><table class="content-table">' +
      '<thead><tr>' + headers + '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function renderInfoBox(block) {
    return '<div class="info-box">' +
      '<div class="info-box-title">' + block.title + '</div>' +
      '<div class="info-box-text">' + block.text + '</div></div>';
  }

  function renderWarningBox(block) {
    return '<div class="warning-box">' +
      '<div class="warning-box-title">' + block.title + '</div>' +
      '<div class="warning-box-text">' + block.text + '</div></div>';
  }

  function renderContactCard(block) {
    const data = block.data || {};
    const labels = block.labels || {};
    let html = '<div class="contact-card">';
    Object.keys(labels).forEach(function (key) {
      if (!data[key]) return;
      const value = key === 'email'
        ? '<a href="mailto:' + data[key] + '">' + data[key] + '</a>'
        : data[key];
      html += '<p class="contact-card-item">' +
        '<span class="contact-card-label">' + labels[key] + '</span> ' +
        value + '</p>';
    });
    return html + '</div>';
  }

  const BLOCK_RENDERERS = {
    'paragraph': renderParagraph,
    'list': renderList,
    'table': renderTable,
    'info-box': renderInfoBox,
    'warning-box': renderWarningBox,
    'contact-card': renderContactCard,
  };

  function renderContent(content) {
    if (!content || !Array.isArray(content)) return '';
    return content.map(function (block) {
      const renderer = BLOCK_RENDERERS[block.type];
      return renderer ? renderer(block) : '';
    }).join('');
  }

  function renderSubsections(subsections) {
    if (!subsections || !Array.isArray(subsections)) return '';
    return subsections.map(function (sub) {
      return '<div class="subsection" id="' + sub.id + '">' +
        '<h3 class="subsection-title">' + sub.number + ' ' + sub.title + '</h3>' +
        renderContent(sub.content) + '</div>';
    }).join('');
  }

  function renderSections(sections) {
    if (!sections || !Array.isArray(sections)) return '';
    return sections.map(function (section) {
      return '<section class="policy-section" id="' + section.id + '">' +
        '<div class="section-header">' +
        '<span class="section-number">' + section.number + '</span>' +
        '<h2 class="section-title">' + section.title + '</h2></div>' +
        renderContent(section.content) +
        renderSubsections(section.subsections) + '</section>';
    }).join('');
  }

  function renderDocument(data) {
    const container = document.getElementById('content-container');
    if (!container || !data) return;
    container.innerHTML =
      '<header class="policy-header">' +
      '<h1 class="policy-title">' + data.meta.title + '</h1>' +
      '<p class="policy-subtitle">' + data.meta.subtitle + '</p>' +
      '<p class="policy-date">' + data.meta.lastUpdated + '</p></header>' +
      '<main class="policy-content">' + renderSections(data.sections) + '</main>' +
      '<footer class="policy-footer">' +
      '<p class="footer-company">' + data.footer.company + '</p>' +
      '<p class="footer-effective">' + data.footer.effective + '</p></footer>';
    renderToc();
  }

  // ------------------------------------------------------------------- toc --

  function renderToc() {
    const tocList = document.getElementById('toc-list');
    const tocTitle = document.getElementById('toc-title');
    if (!tocList || !translations || !translations.sections) return;
    if (tocTitle) {
      tocTitle.textContent = (translations.meta && translations.meta.tocTitle) ||
        'Contents';
    }
    tocList.innerHTML = translations.sections.map(function (section) {
      const shortTitle = section.title.length > 25
        ? section.title.substring(0, 25) + '...'
        : section.title;
      const label = section.number + '. ' + shortTitle;
      return '<li class="toc-item">' +
        '<a class="toc-link" href="#' + section.id + '" data-section="' +
        section.id + '">' + label + '</a></li>';
    }).join('');
    tocList.querySelectorAll('.toc-link').forEach(function (link) {
      link.addEventListener('click', onTocLinkClick);
    });
    observeSections();
  }

  function onTocLinkClick(event) {
    event.preventDefault();
    const target = document.getElementById(event.currentTarget.dataset.section);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function isAtPageBottom() {
    return window.scrollY + window.innerHeight >= document.body.scrollHeight - 50;
  }

  function markActiveTocLink(sectionId) {
    document.querySelectorAll('.toc-link').forEach(function (link) {
      link.classList.toggle('active', link.dataset.section === sectionId);
    });
  }

  function observeSections() {
    if (sectionObserver) sectionObserver.disconnect();
    if (scrollListener) window.removeEventListener('scroll', scrollListener);
    const sections = document.querySelectorAll('.policy-section');
    if (sections.length === 0) return;

    const visible = new Map();
    sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visible.set(entry.target.id, entry.boundingClientRect.top);
        } else {
          visible.delete(entry.target.id);
        }
      });
      if (visible.size > 0 && !isAtPageBottom()) {
        let closestId = null;
        let closestDistance = Infinity;
        visible.forEach(function (top, id) {
          const distance = Math.abs(top);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestId = id;
          }
        });
        if (closestId) markActiveTocLink(closestId);
      }
    }, { rootMargin: '-10% 0px -60% 0px', threshold: [0, 0.25, 0.5] });

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });

    scrollListener = function () {
      if (isAtPageBottom()) {
        const last = sections[sections.length - 1];
        if (last) markActiveTocLink(last.id);
      }
    };
    window.addEventListener('scroll', scrollListener, { passive: true });
  }

  // -------------------------------------------------------------- language --

  function markActiveLangButton(lang) {
    document.querySelectorAll('.lang-btn').forEach(function (button) {
      button.classList.toggle('active', button.dataset.lang === lang);
    });
  }

  function persistLang(lang) {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url);
  }

  function animateDirectionChange(fromDir, toDir) {
    const toc = document.querySelector('.toc');
    const themeSwitcher = document.getElementById('theme-switcher');
    const exitClass = fromDir === 'ltr' ? 'exiting-ltr' : 'exiting-rtl';
    const enterClass = toDir === 'ltr' ? 'entering-ltr' : 'entering-rtl';
    if (toc) toc.classList.add(exitClass);
    if (themeSwitcher) themeSwitcher.classList.add(exitClass);
    setTimeout(function () {
      document.documentElement.dir = toDir;
      renderDocument(translations);
      if (toc) {
        toc.classList.remove(exitClass);
        toc.classList.add('entering');
        void toc.offsetWidth;
        toc.classList.remove('entering');
      }
      if (themeSwitcher) {
        themeSwitcher.classList.remove(exitClass);
        themeSwitcher.classList.add(enterClass);
        setTimeout(function () {
          themeSwitcher.classList.remove(enterClass);
        }, 300);
      }
    }, 300);
  }

  async function switchLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
    const data = await loadTranslations(lang);
    if (!data) return;
    const previousDir = document.documentElement.dir || 'ltr';
    const nextDir = (data.meta && data.meta.direction) || 'ltr';
    currentLang = lang;
    translations = data;
    persistLang(lang);
    markActiveLangButton(lang);
    document.documentElement.lang = lang;
    if (previousDir !== nextDir) {
      animateDirectionChange(previousDir, nextDir);
    } else {
      renderDocument(data);
    }
  }

  // ------------------------------------------------------------------ init --

  async function init() {
    applyTheme(resolveInitialTheme());
    currentLang = resolveInitialLang();
    translations = await loadTranslations(currentLang);
    if (translations) {
      markActiveLangButton(currentLang);
      renderDocument(translations);
      document.documentElement.lang = currentLang;
      document.documentElement.dir =
        (translations.meta && translations.meta.direction) || 'ltr';
    }
    document.querySelectorAll('.lang-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        switchLanguage(button.dataset.lang);
      });
    });
    const themeSwitcher = document.getElementById('theme-switcher');
    if (themeSwitcher) themeSwitcher.addEventListener('click', toggleTheme);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', function (event) {
          if (!localStorage.getItem(THEME_STORAGE_KEY)) {
            applyTheme(event.matches ? THEMES.DARK : THEMES.LIGHT);
          }
        });
    }
  }

  return {
    init: init,
    switchLanguage: switchLanguage,
    getCurrentLang: function () { return currentLang; },
    getTranslations: function () { return translations; },
    toggleTheme: toggleTheme,
    getCurrentTheme: function () { return currentTheme; },
  };
})();

I18n.init();
