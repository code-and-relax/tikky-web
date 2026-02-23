var Stats = (function() {

  async function render(container) {
    container.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-lg';
    header.innerHTML = '<h2>Resumen</h2>';
    container.appendChild(header);

    var shimmer = document.createElement('div');
    shimmer.className = 'stats-grid';
    for (var i = 0; i < 6; i++) {
      var card = document.createElement('div');
      card.className = 'stat-card neu-flat-card';
      card.appendChild(Components.shimmerLines(2));
      shimmer.appendChild(card);
    }
    container.appendChild(shimmer);

    try {
      var summary = await Api.stats.getSummary();
      shimmer.remove();
      _renderCards(container, summary);
    } catch (err) {
      console.error('[Stats] Render error:', err);
      shimmer.remove();
      container.appendChild(
        Components.emptyState('Error al cargar', 'No se pudieron obtener las estad\u00edsticas.')
      );
    }
  }

  function _renderCards(container, summary) {
    var grid = document.createElement('div');
    grid.className = 'stats-grid';

    grid.appendChild(_createStatCard('Total Feedback', summary.total, '#6C5CE7'));

    var typeLabels = {
      'ai_chat_error': 'Errores AI Chat',
      'ai_chat_message_feedback': 'Feedback Mensajes AI',
      'general_feedback': 'Feedback General',
      'bug_report': 'Reportes de Bug',
      'suggestion': 'Sugerencias',
      'other': 'Otros'
    };

    var typeKeys = Object.keys(summary.byType);
    for (var i = 0; i < typeKeys.length; i++) {
      var type = typeKeys[i];
      if (summary.byType[type] > 0) {
        var label = typeLabels[type] || type;
        var color = _getTypeColor(type);
        grid.appendChild(_createStatCard(label, summary.byType[type], color));
      }
    }

    container.appendChild(grid);

    _renderStatusSection(container, summary);
  }

  async function _renderStatusSection(container, summary) {
    var statusSection = document.createElement('div');
    statusSection.className = 'mt-xl';
    statusSection.innerHTML = '<h3 class="mb-md">Estado del Feedback</h3>';

    var statusGrid = document.createElement('div');
    statusGrid.className = 'stats-grid';

    if (summary.byStatus['unreviewed'] > 0) {
      statusGrid.appendChild(
        _createStatCard('Sin revisar', summary.byStatus['unreviewed'], '#FDAA5E')
      );
    }

    var statusList = await Api.statuses.list();
    for (var j = 0; j < statusList.length; j++) {
      var status = statusList[j];
      var count = summary.byStatus[status.id] || 0;
      if (count > 0) {
        statusGrid.appendChild(
          _createStatCard(status.display_name, count, status.color_hex)
        );
      }
    }

    statusSection.appendChild(statusGrid);
    container.appendChild(statusSection);
  }

  function _createStatCard(label, value, color) {
    var card = document.createElement('div');
    card.className = 'stat-card neu-flat-card animate-slide-up';

    var number = document.createElement('div');
    number.className = 'stat-value';
    number.textContent = value.toLocaleString();
    number.style.color = color;

    var labelEl = document.createElement('div');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;

    card.appendChild(number);
    card.appendChild(labelEl);
    return card;
  }

  function _getTypeColor(type) {
    var colors = {
      'ai_chat_error': '#D63031',
      'ai_chat_message_feedback': '#6C5CE7',
      'general_feedback': '#00CEC9',
      'bug_report': '#FF6B35',
      'suggestion': '#00B894',
      'other': '#636E72'
    };
    return colors[type] || '#636E72';
  }

  return { render: render };
})();
