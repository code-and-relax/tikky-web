var Config = (function() {
  var _supabase = null;
  var _url = '';
  var _anonKey = '';

  var CONFIG_URL = 'https://europe-west1-tikky-nekki.cloudfunctions.net/getSupabaseWebConfig';

  async function init() {
    try {
      var response = await fetch(CONFIG_URL, { method: 'GET' });
      if (!response.ok) throw new Error('Config fetch failed: ' + response.status);
      var data = await response.json();
      _url = data.url;
      _anonKey = data.anonKey;
      _supabase = supabase.createClient(_url, _anonKey);
      return true;
    } catch (err) {
      console.error('[Config] Init error:', err);
      return false;
    }
  }

  function getClient() { return _supabase; }
  function getUrl() { return _url; }

  return { init: init, getClient: getClient, getUrl: getUrl };
})();
