var FeedbackList = (function() {
  var _mode = 'app';
  var _filters = {};
  var _nextCursor = null;
  var _isLoading = false;
  var _container = null;
  var _tableBody = null;
  var _loadMoreBtn = null;
  var _searchTimeout = null;

  var APP_TYPES = ['general_feedback', 'bug_report', 'suggestion', 'other'];
  var AI_TYPES = ['ai_chat_error', 'ai_chat_message_feedback'];

  async function render(container, mode) {
    _mode = mode || 'app';
    _container = container;
    _nextCursor = null;
    _filters = {
      types: _mode === 'app' ? APP_TYPES : AI_TYPES,
      statusId: null,
      assignedTo: null,
      platform: null,
      search: null,
      dateFrom: null,
      dateTo: null,
      isAuto: null
    };

    container.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-lg';
    var title = _mode === 'app' ? 'Feedback de la App' : 'Feedback AI Chat';
    header.innerHTML = '<h2>' + title + '</h2>';
    container.appendChild(header);

    var filterBar = _buildFilterBar();
    container.appendChild(filterBar);

    var tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper neu-flat-card';

    var table = document.createElement('table');
    table.className = 'feedback-table';

    var thead = document.createElement('thead');
    thead.innerHTML = '<tr>'
      + '<th>Tipo</th>'
      + '<th>Asunto</th>'
      + '<th>Usuario</th>'
      + '<th>Estado</th>'
      + '<th>Asignado</th>'
      + '<th>Plataforma</th>'
      + '<th>Fecha</th>'
      + '</tr>';
    table.appendChild(thead);

    _tableBody = document.createElement('tbody');
    table.appendChild(_tableBody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    _loadMoreBtn = document.createElement('button');
    _loadMoreBtn.className = 'btn btn-secondary btn-block mt-md hidden';
    _loadMoreBtn.textContent = 'Cargar m\u00e1s';
    _loadMoreBtn.addEventListener('click', _loadMore);
    container.appendChild(_loadMoreBtn);

    await _loadData(false);
  }

  function _buildFilterBar() {
    var bar = document.createElement('div');
    bar.className = 'filter-bar mb-md';

    // Search input
    var searchGroup = document.createElement('div');
    searchGroup.className = 'filter-group';
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'input input-sm';
    searchInput.placeholder = 'Buscar en asunto o contenido...';
    searchInput.addEventListener('input', function() {
      clearTimeout(_searchTimeout);
      _searchTimeout = setTimeout(function() {
        _filters.search = searchInput.value.trim() || null;
        _resetAndLoad();
      }, 400);
    });
    searchGroup.appendChild(searchInput);
    bar.appendChild(searchGroup);

    // Status filter
    _buildStatusFilter(bar);

    // Auto/Manual toggle
    var autoGroup = document.createElement('div');
    autoGroup.className = 'filter-group';
    var autoSelect = document.createElement('select');
    autoSelect.className = 'input input-sm';
    autoSelect.innerHTML = '<option value="">Todos (auto/manual)</option>'
      + '<option value="true">Autom\u00e1tico</option>'
      + '<option value="false">Manual</option>';
    autoSelect.addEventListener('change', function() {
      if (autoSelect.value === '') {
        _filters.isAuto = null;
      } else {
        _filters.isAuto = autoSelect.value === 'true';
      }
      _resetAndLoad();
    });
    autoGroup.appendChild(autoSelect);
    bar.appendChild(autoGroup);

    // Date range
    var dateGroup = document.createElement('div');
    dateGroup.className = 'filter-group filter-dates';

    var dateFrom = document.createElement('input');
    dateFrom.type = 'date';
    dateFrom.className = 'input input-sm';
    dateFrom.title = 'Desde';
    dateFrom.addEventListener('change', function() {
      _filters.dateFrom = dateFrom.value || null;
      _resetAndLoad();
    });

    var dateTo = document.createElement('input');
    dateTo.type = 'date';
    dateTo.className = 'input input-sm';
    dateTo.title = 'Hasta';
    dateTo.addEventListener('change', function() {
      _filters.dateTo = dateTo.value || null;
      _resetAndLoad();
    });

    var dateSeparator = document.createElement('span');
    dateSeparator.className = 'text-secondary';
    dateSeparator.textContent = '-';

    dateGroup.appendChild(dateFrom);
    dateGroup.appendChild(dateSeparator);
    dateGroup.appendChild(dateTo);
    bar.appendChild(dateGroup);

    return bar;
  }

  async function _buildStatusFilter(bar) {
    var statusGroup = document.createElement('div');
    statusGroup.className = 'filter-group';

    var statusSelect = document.createElement('select');
    statusSelect.className = 'input input-sm';
    statusSelect.innerHTML = '<option value="">Todos los estados</option>';

    var statuses = await Api.statuses.list();
    statuses.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.display_name;
      statusSelect.appendChild(opt);
    });

    statusSelect.addEventListener('change', function() {
      _filters.statusId = statusSelect.value || null;
      _resetAndLoad();
    });

    statusGroup.appendChild(statusSelect);
    bar.appendChild(statusGroup);
  }

  function _resetAndLoad() {
    _nextCursor = null;
    _tableBody.innerHTML = '';
    _loadData(false);
  }

  async function _loadData(append) {
    if (_isLoading) return;
    _isLoading = true;

    if (!append) {
      _tableBody.innerHTML = '';
      // Show shimmer rows
      for (var i = 0; i < 5; i++) {
        var shimmerRow = document.createElement('tr');
        shimmerRow.className = 'shimmer-row';
        for (var j = 0; j < 7; j++) {
          var td = document.createElement('td');
          td.appendChild(Components.shimmerLines(1));
          shimmerRow.appendChild(td);
        }
        _tableBody.appendChild(shimmerRow);
      }
    }

    try {
      var result = await Api.feedback.list(
        _filters,
        append ? _nextCursor : null
      );

      if (!append) {
        _tableBody.innerHTML = '';
      }

      if (result.data.length === 0 && !append) {
        var emptyRow = document.createElement('tr');
        var emptyTd = document.createElement('td');
        emptyTd.colSpan = 7;
        emptyTd.className = 'text-center py-xl';
        emptyTd.appendChild(
          Components.emptyState(
            'Sin resultados',
            'No se encontr\u00f3 feedback con los filtros seleccionados.'
          )
        );
        emptyRow.appendChild(emptyTd);
        _tableBody.appendChild(emptyRow);
        _loadMoreBtn.classList.add('hidden');
      } else {
        _renderRows(result.data);
        _nextCursor = result.nextCursor;

        if (result.nextCursor) {
          _loadMoreBtn.classList.remove('hidden');
        } else {
          _loadMoreBtn.classList.add('hidden');
        }
      }
    } catch (err) {
      console.error('[FeedbackList] Load error:', err);
      Components.toast('Error al cargar el feedback', 'error');
    }

    _isLoading = false;
  }

  function _loadMore() {
    if (_nextCursor) {
      _loadData(true);
    }
  }

  function _renderRows(items) {
    items.forEach(function(item) {
      // Collect admin info from item data
      if (item.current_assigned_to && item.assigned_to_display_name) {
        Api.admins.register({
          id: item.current_assigned_to,
          display_name: item.assigned_to_display_name
        });
      }

      var row = document.createElement('tr');
      row.className = 'feedback-row animate-fade-in';
      row.style.cursor = 'pointer';
      row.addEventListener('click', function() {
        Router.navigate('#/feedback/' + item.id);
      });

      // Type badge
      var typeTd = document.createElement('td');
      typeTd.appendChild(Components.typeBadge(item.feedback_type));
      row.appendChild(typeTd);

      // Subject / body preview
      var subjectTd = document.createElement('td');
      subjectTd.className = 'feedback-subject';
      var subjectText = item.subject || item.body || '(Sin contenido)';
      subjectTd.textContent = Components.truncate(subjectText, 60);
      subjectTd.title = subjectText;
      row.appendChild(subjectTd);

      // User display name
      var userTd = document.createElement('td');
      userTd.className = 'text-secondary';
      userTd.textContent = Components.sanitize(item.user_display_name || item.user_id || '-');
      row.appendChild(userTd);

      // Status badge
      var statusTd = document.createElement('td');
      if (item.current_status_id) {
        statusTd.appendChild(Components.statusBadge(item.current_status_id));
      } else {
        var noStatus = document.createElement('span');
        noStatus.className = 'text-disabled';
        noStatus.textContent = 'Sin estado';
        statusTd.appendChild(noStatus);
      }
      row.appendChild(statusTd);

      // Assigned to
      var assignedTd = document.createElement('td');
      assignedTd.className = 'text-secondary';
      assignedTd.textContent = item.assigned_to_display_name || '-';
      row.appendChild(assignedTd);

      // Platform
      var platformTd = document.createElement('td');
      if (item.platform) {
        platformTd.appendChild(Components.platformBadge(item.platform));
      } else {
        platformTd.textContent = '-';
      }
      row.appendChild(platformTd);

      // Date
      var dateTd = document.createElement('td');
      dateTd.className = 'text-secondary text-nowrap';
      dateTd.textContent = Components.formatDate(item.created_at);
      dateTd.title = Components.formatDateTime(item.created_at);
      row.appendChild(dateTd);

      _tableBody.appendChild(row);
    });
  }

  return { render: render };
})();
