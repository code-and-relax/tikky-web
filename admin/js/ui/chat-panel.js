var ChatPanel = (function() {
  var _isVisible = false;
  var _isInitialized = false;
  var _messages = [];
  var _messagesContainer = null;
  var _chatInput = null;
  var _panelEl = null;

  function init() {
    if (_isInitialized) return;
    _isInitialized = true;

    _panelEl = document.getElementById('chat-panel');
    if (!_panelEl) {
      _createPanel();
    }

    _createFab();
  }

  function _createPanel() {
    _panelEl = document.createElement('div');
    _panelEl.id = 'chat-panel';
    _panelEl.className = 'chat-panel hidden';

    // Header
    var header = document.createElement('div');
    header.className = 'chat-panel-header';
    var headerTitle = document.createElement('h4');
    headerTitle.textContent = 'Chat Administrativo';
    header.appendChild(headerTitle);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-icon btn-sm';
    closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18">'
      + '</line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.addEventListener('click', hide);
    header.appendChild(closeBtn);

    _panelEl.appendChild(header);

    // Messages container
    _messagesContainer = document.createElement('div');
    _messagesContainer.className = 'chat-messages';
    _panelEl.appendChild(_messagesContainer);

    // Input area
    var inputArea = document.createElement('div');
    inputArea.className = 'chat-input-area';

    _chatInput = document.createElement('textarea');
    _chatInput.className = 'input chat-textarea';
    _chatInput.rows = 1;
    _chatInput.maxLength = 2000;
    _chatInput.placeholder = 'Escribe un mensaje...';
    _chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleSend();
      }
    });
    _chatInput.addEventListener('input', function() {
      _chatInput.style.height = 'auto';
      var maxHeight = 80;
      _chatInput.style.height = Math.min(_chatInput.scrollHeight, maxHeight) + 'px';
    });

    var sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-primary btn-sm';
    sendBtn.textContent = 'Enviar';
    sendBtn.addEventListener('click', _handleSend);

    inputArea.appendChild(_chatInput);
    inputArea.appendChild(sendBtn);
    _panelEl.appendChild(inputArea);

    document.body.appendChild(_panelEl);
  }

  function _createFab() {
    var existing = document.getElementById('chat-fab');
    if (existing) return;

    var fab = document.createElement('button');
    fab.id = 'chat-fab';
    fab.className = 'chat-fab';
    fab.title = 'Chat Administrativo';
    fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    fab.addEventListener('click', toggle);
    document.body.appendChild(fab);
  }

  async function _loadMessages() {
    if (!_messagesContainer) return;
    _messagesContainer.innerHTML = '';
    _messagesContainer.appendChild(Components.shimmerLines(4));

    try {
      _messages = await Api.chat.list();
      _messagesContainer.innerHTML = '';

      if (_messages.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'text-secondary text-center py-lg';
        empty.textContent = 'Sin mensajes a\u00fan. Inicia la conversaci\u00f3n.';
        _messagesContainer.appendChild(empty);
        return;
      }

      _messages.forEach(function(msg) {
        _messagesContainer.appendChild(_createMessageBubble(msg));
      });

      _scrollToBottom();
    } catch (err) {
      console.error('[ChatPanel] Load messages error:', err);
      _messagesContainer.innerHTML = '';
      var errorEl = document.createElement('p');
      errorEl.className = 'text-secondary text-center';
      errorEl.textContent = 'Error al cargar mensajes.';
      _messagesContainer.appendChild(errorEl);
    }
  }

  function _createMessageBubble(msg) {
    var currentAdmin = Auth.getCurrentAdmin();
    var isOwn = currentAdmin && msg.admin_user_id === currentAdmin.id;
    var adminName = msg.admin ? msg.admin.display_name : 'Admin';

    var wrapper = document.createElement('div');
    wrapper.className = 'chat-message' + (isOwn ? ' chat-message-own' : '');

    if (!isOwn) {
      wrapper.appendChild(Components.avatar(adminName, 'sm'));
    }

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble' + (isOwn ? ' chat-bubble-own' : '');

    if (!isOwn) {
      var nameEl = document.createElement('div');
      nameEl.className = 'chat-sender';
      nameEl.textContent = adminName;
      bubble.appendChild(nameEl);
    }

    var bodyEl = document.createElement('div');
    bodyEl.className = 'chat-body';
    bodyEl.textContent = msg.body;
    bubble.appendChild(bodyEl);

    var timeEl = document.createElement('div');
    timeEl.className = 'chat-time';
    timeEl.textContent = Components.formatDate(msg.created_at);
    timeEl.title = Components.formatDateTime(msg.created_at);
    bubble.appendChild(timeEl);

    wrapper.appendChild(bubble);
    return wrapper;
  }

  async function _handleSend() {
    if (!_chatInput) return;
    var body = _chatInput.value.trim();
    if (!body) return;

    _chatInput.disabled = true;
    _chatInput.value = '';
    _chatInput.style.height = 'auto';

    try {
      var result = await Api.chat.send(body);
      if (result.success) {
        // Remove empty state if present
        var emptyEl = _messagesContainer.querySelector('.text-secondary');
        if (emptyEl) emptyEl.remove();

        _messagesContainer.appendChild(_createMessageBubble(result.data));
        _scrollToBottom();
      } else {
        Components.toast('Error al enviar mensaje: ' + (result.error || ''), 'error');
        _chatInput.value = body;
      }
    } catch (err) {
      console.error('[ChatPanel] Send error:', err);
      Components.toast('Error al enviar el mensaje', 'error');
      _chatInput.value = body;
    }

    _chatInput.disabled = false;
    _chatInput.focus();
  }

  function onNewMessage(msg) {
    if (!_messagesContainer) return;
    var currentAdmin = Auth.getCurrentAdmin();
    // Avoid duplicating own messages (already added on send)
    if (currentAdmin && msg.admin_user_id === currentAdmin.id) return;

    // Need to fetch the full message with admin info
    _appendRealtimeMessage(msg);
  }

  async function _appendRealtimeMessage(msg) {
    try {
      // The realtime payload might not include admin join data,
      // so we build what we can
      var adminName = Api.admins.getName(msg.admin_user_id);
      var displayMsg = {
        admin_user_id: msg.admin_user_id,
        body: msg.body,
        created_at: msg.created_at,
        admin: { display_name: adminName }
      };

      // Remove empty state if present
      var emptyEl = _messagesContainer.querySelector('.text-secondary');
      if (emptyEl) emptyEl.remove();

      _messagesContainer.appendChild(_createMessageBubble(displayMsg));
      _scrollToBottom();
    } catch (err) {
      console.error('[ChatPanel] Realtime message error:', err);
    }
  }

  function _scrollToBottom() {
    if (_messagesContainer) {
      _messagesContainer.scrollTop = _messagesContainer.scrollHeight;
    }
  }

  function toggle() {
    if (_isVisible) {
      hide();
    } else {
      show();
    }
  }

  function show() {
    if (!_panelEl) return;
    _panelEl.classList.remove('hidden');
    _isVisible = true;
    _loadMessages();

    var fab = document.getElementById('chat-fab');
    if (fab) fab.classList.add('active');
  }

  function hide() {
    if (!_panelEl) return;
    _panelEl.classList.add('hidden');
    _isVisible = false;

    var fab = document.getElementById('chat-fab');
    if (fab) fab.classList.remove('active');
  }

  // Full page view for #/chat route
  function renderFullView(container) {
    container.innerHTML = '';

    var fullChat = document.createElement('div');
    fullChat.className = 'chat-full-view';

    // Header
    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-md';
    var fullTitle = document.createElement('h2');
    fullTitle.textContent = 'Chat Administrativo';
    header.appendChild(fullTitle);
    fullChat.appendChild(header);

    // Messages area
    var messagesArea = document.createElement('div');
    messagesArea.className = 'chat-full-messages neu-flat-card';
    messagesArea.id = 'chat-full-messages';
    fullChat.appendChild(messagesArea);

    // Input area
    var inputArea = document.createElement('div');
    inputArea.className = 'chat-full-input mt-md';

    var textarea = document.createElement('textarea');
    textarea.className = 'input';
    textarea.rows = 2;
    textarea.maxLength = 2000;
    textarea.placeholder = 'Escribe un mensaje...';
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleFullSend(textarea, messagesArea);
      }
    });

    var sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-primary mt-sm';
    sendBtn.textContent = 'Enviar';
    sendBtn.addEventListener('click', function() {
      _handleFullSend(textarea, messagesArea);
    });

    inputArea.appendChild(textarea);
    inputArea.appendChild(sendBtn);
    fullChat.appendChild(inputArea);

    container.appendChild(fullChat);

    _loadFullMessages(messagesArea);
  }

  async function _loadFullMessages(messagesArea) {
    messagesArea.innerHTML = '';
    messagesArea.appendChild(Components.shimmerLines(6));

    try {
      var messages = await Api.chat.list(100);
      messagesArea.innerHTML = '';

      if (messages.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'text-secondary text-center py-xl';
        empty.textContent = 'Sin mensajes a\u00fan. Inicia la conversaci\u00f3n.';
        messagesArea.appendChild(empty);
        return;
      }

      messages.forEach(function(msg) {
        messagesArea.appendChild(_createMessageBubble(msg));
      });

      messagesArea.scrollTop = messagesArea.scrollHeight;
    } catch (err) {
      console.error('[ChatPanel] Full view load error:', err);
      messagesArea.innerHTML = '';
      var errorEl = document.createElement('p');
      errorEl.className = 'text-secondary text-center';
      errorEl.textContent = 'Error al cargar mensajes.';
      messagesArea.appendChild(errorEl);
    }
  }

  async function _handleFullSend(textarea, messagesArea) {
    var body = textarea.value.trim();
    if (!body) return;

    textarea.disabled = true;
    textarea.value = '';

    try {
      var result = await Api.chat.send(body);
      if (result.success) {
        var emptyEl = messagesArea.querySelector('.text-secondary');
        if (emptyEl) emptyEl.remove();

        messagesArea.appendChild(_createMessageBubble(result.data));
        messagesArea.scrollTop = messagesArea.scrollHeight;
      } else {
        Components.toast('Error al enviar mensaje', 'error');
        textarea.value = body;
      }
    } catch (err) {
      console.error('[ChatPanel] Full send error:', err);
      Components.toast('Error al enviar el mensaje', 'error');
      textarea.value = body;
    }

    textarea.disabled = false;
    textarea.focus();
  }

  return {
    init: init,
    toggle: toggle,
    show: show,
    hide: hide,
    onNewMessage: onNewMessage,
    renderFullView: renderFullView
  };
})();
