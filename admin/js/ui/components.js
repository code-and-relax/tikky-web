var Components = (function() {

  function sanitize(html) {
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(html);
    var div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function statusBadge(statusId) {
    var name = Api.statuses.getNameForStatus(statusId);
    var color = Api.statuses.getColorForStatus(statusId);
    var badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.style.backgroundColor = color + '1A';
    badge.style.color = color;
    badge.style.borderColor = color + '33';
    badge.textContent = name || 'Sin estado';
    return badge;
  }

  function typeBadge(feedbackType) {
    var config = _typeConfig(feedbackType);
    var badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.style.backgroundColor = config.color + '1A';
    badge.style.color = config.color;
    badge.textContent = config.label;
    return badge;
  }

  function _typeConfig(type) {
    var configs = {
      'ai_chat_error': { label: 'Error AI Chat', color: '#D63031' },
      'ai_chat_message_feedback': { label: 'Feedback Mensaje AI', color: '#6C5CE7' },
      'general_feedback': { label: 'Feedback General', color: '#00CEC9' },
      'bug_report': { label: 'Reporte de Bug', color: '#FF6B35' },
      'suggestion': { label: 'Sugerencia', color: '#00B894' },
      'other': { label: 'Otro', color: '#636E72' }
    };
    return configs[type] || configs['other'];
  }

  function platformBadge(platform) {
    if (!platform) return null;
    var badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.style.backgroundColor = 'var(--bg-soft)';
    badge.style.color = 'var(--text-secondary)';
    badge.textContent = platform;
    return badge;
  }

  function avatar(name, size) {
    size = size || 'md';
    var el = document.createElement('div');
    el.className = 'avatar avatar-initials avatar-' + size;
    el.textContent = name ? name.charAt(0).toUpperCase() : '?';
    el.title = name || '';
    return el;
  }

  function dropdown(options, selectedValue, onChange) {
    var container = document.createElement('div');
    container.className = 'dropdown-container';

    var button = document.createElement('button');
    button.className = 'btn btn-secondary btn-sm dropdown-trigger';
    var selected = options.find(function(o) { return o.value === selectedValue; });
    button.textContent = selected ? selected.label : 'Seleccionar';

    var menu = document.createElement('div');
    menu.className = 'dropdown-menu hidden';

    options.forEach(function(opt) {
      var item = document.createElement('button');
      item.className = 'dropdown-item' + (opt.value === selectedValue ? ' active' : '');
      item.textContent = opt.label;
      if (opt.color) {
        var dot = document.createElement('span');
        dot.className = 'dropdown-dot';
        dot.style.backgroundColor = opt.color;
        item.prepend(dot);
      }
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        button.textContent = opt.label;
        menu.classList.add('hidden');
        if (onChange) onChange(opt.value);
      });
      menu.appendChild(item);
    });

    button.addEventListener('click', function(e) {
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu').forEach(function(m) {
        if (m !== menu) m.classList.add('hidden');
      });
      menu.classList.toggle('hidden');
    });

    document.addEventListener('click', function() { menu.classList.add('hidden'); });

    container.appendChild(button);
    container.appendChild(menu);
    return container;
  }

  function shimmerLines(count) {
    var container = document.createElement('div');
    container.className = 'shimmer-container';
    for (var i = 0; i < count; i++) {
      var line = document.createElement('div');
      line.className = 'shimmer shimmer-line';
      line.style.width = (60 + Math.random() * 40) + '%';
      container.appendChild(line);
    }
    return container;
  }

  function emptyState(title, description) {
    var el = document.createElement('div');
    el.className = 'empty-state';
    el.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" '
      + 'stroke="var(--text-disabled)" stroke-width="1.5">'
      + '<path d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7"></path>'
      + '<path d="M2 17h20"></path>'
      + '<path d="M12 14v3"></path></svg>'
      + '<h3 class="empty-state-title">' + sanitize(title) + '</h3>'
      + '<p class="empty-state-description">' + sanitize(description) + '</p>';
    return el;
  }

  function toast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + type + ' animate-slide-up';
    el.textContent = message;
    el.style.pointerEvents = 'auto';
    container.appendChild(el);

    setTimeout(function() {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(function() { el.remove(); }, 300);
    }, 3000);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    var date = new Date(dateStr);
    var now = new Date();
    var diffMs = now - date;
    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);
    var diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return diffMins + ' min';
    if (diffHours < 24) return diffHours + 'h';
    if (diffDays < 7) return diffDays + 'd';

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    var date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function confirm(title, message, confirmLabel) {
    return new Promise(function(resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay animate-fade-in';

      var modal = document.createElement('div');
      modal.className = 'modal-content neu-flat-card animate-slide-up';
      modal.innerHTML = '<h3 class="mb-md">' + sanitize(title) + '</h3>'
        + '<p class="text-secondary mb-lg">' + sanitize(message) + '</p>'
        + '<div class="flex justify-end gap-sm">'
        + '<button class="btn btn-secondary" id="modal-cancel">Cancelar</button>'
        + '<button class="btn btn-primary" id="modal-confirm">'
        + sanitize(confirmLabel || 'Confirmar') + '</button>'
        + '</div>';

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      modal.querySelector('#modal-cancel').addEventListener('click', function() {
        overlay.remove();
        resolve(false);
      });
      modal.querySelector('#modal-confirm').addEventListener('click', function() {
        overlay.remove();
        resolve(true);
      });
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) { overlay.remove(); resolve(false); }
      });
    });
  }

  return {
    sanitize: sanitize,
    statusBadge: statusBadge,
    typeBadge: typeBadge,
    platformBadge: platformBadge,
    avatar: avatar,
    dropdown: dropdown,
    shimmerLines: shimmerLines,
    emptyState: emptyState,
    toast: toast,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    truncate: truncate,
    confirm: confirm
  };
})();
