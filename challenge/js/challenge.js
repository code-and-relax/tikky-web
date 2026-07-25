/**
 * Turnstile challenge bridge for the Tikky app WebView.
 *
 * Renders the Cloudflare Turnstile widget with the site key received in the
 * query string and reports the outcome to the Flutter host through the
 * `TurnstileFlutter` JavaScript channel using prefixed messages:
 *   token:<turnstile-token>  on success
 *   error:<code>             on failure (missing-sitekey | Turnstile code)
 *
 * When opened in a plain browser (no channel injected) the widget still
 * renders but outcomes are silently dropped.
 */
(function () {
  'use strict';

  var CHANNEL_NAME = 'TurnstileFlutter';

  /**
   * App locales mapped to Turnstile language codes. Anything outside this
   * allowlist falls back to 'auto' (Turnstile picks the browser language).
   */
  var SUPPORTED_LANGS = { es: 'es', en: 'en', de: 'de', hi: 'hi', zh: 'zh-cn' };

  function notify(message) {
    var channel = window[CHANNEL_NAME];
    if (channel && typeof channel.postMessage === 'function') {
      channel.postMessage(message);
    }
  }

  function resolveLanguage(raw) {
    if (!raw) return 'auto';
    return SUPPORTED_LANGS[raw.toLowerCase()] || 'auto';
  }

  window.onloadTurnstileCallback = function () {
    var params = new URLSearchParams(window.location.search);
    var sitekey = params.get('sitekey');
    if (!sitekey) {
      notify('error:missing-sitekey');
      return;
    }

    window.turnstile.render('#turnstile-container', {
      sitekey: sitekey,
      language: resolveLanguage(params.get('lang')),
      theme: 'auto',
      callback: function (token) {
        notify('token:' + token);
      },
      'error-callback': function (code) {
        notify('error:' + (code || 'unknown'));
        return true;
      },
      'expired-callback': function () {
        // The host consumes each token immediately; resetting keeps any
        // token still to be delivered fresh.
        window.turnstile.reset();
      }
    });
  };
})();
