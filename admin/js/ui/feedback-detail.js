var FeedbackDetail = (function() {
  var _feedbackId = null;
  var _feedback = null;
  var _container = null;
  var _reviewsContainer = null;
  var _commentsContainer = null;
  var _commentInput = null;
  var _realtimeChannels = [];

  async function render(container, feedbackId) {
    _cleanup();
    _feedbackId = feedbackId;
    _container = container;
    container.innerHTML = '';

    // Back button
    var backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary btn-sm mb-md';
    backBtn.innerHTML = '&larr; Volver';
    backBtn.addEventListener('click', function() {
      history.back();
    });
    container.appendChild(backBtn);

    // Loading state
    var loadingEl = document.createElement('div');
    loadingEl.className = 'neu-flat-card p-lg';
    loadingEl.appendChild(Components.shimmerLines(6));
    container.appendChild(loadingEl);

    try {
      _feedback = await Api.feedback.get(feedbackId);
      if (!_feedback) {
        loadingEl.remove();
        container.appendChild(
          Components.emptyState('No encontrado', 'El feedback solicitado no existe.')
        );
        return;
      }

      loadingEl.remove();
      _renderContent(container);
      _setupRealtime();
    } catch (err) {
      console.error('[FeedbackDetail] Render error:', err);
      loadingEl.remove();
      container.appendChild(
        Components.emptyState('Error', 'No se pudo cargar el detalle del feedback.')
      );
    }
  }

  function _renderContent(container) {
    // Main info card
    var mainCard = document.createElement('div');
    mainCard.className = 'neu-flat-card p-lg mb-lg animate-fade-in';
    _renderMainInfo(mainCard);
    container.appendChild(mainCard);

    // Audit log section (for AI feedback with request_id)
    if (_feedback.request_id) {
      var auditCard = document.createElement('div');
      auditCard.className = 'neu-flat-card p-lg mb-lg';
      auditCard.id = 'audit-section';
      var auditTitle = document.createElement('h3');
      auditTitle.className = 'mb-md';
      auditTitle.textContent = 'Registro de Auditor\u00eda AI';
      auditCard.appendChild(auditTitle);
      auditCard.appendChild(Components.shimmerLines(3));
      container.appendChild(auditCard);
      _loadAuditLog(auditCard);
    }

    // Actions card (status change + assignment)
    var actionsCard = document.createElement('div');
    actionsCard.className = 'neu-flat-card p-lg mb-lg';
    _renderActions(actionsCard);
    container.appendChild(actionsCard);

    // Reviews history
    var reviewsCard = document.createElement('div');
    reviewsCard.className = 'neu-flat-card p-lg mb-lg';
    var reviewsTitle = document.createElement('h3');
    reviewsTitle.className = 'mb-md';
    reviewsTitle.textContent = 'Historial de Revisiones';
    reviewsCard.appendChild(reviewsTitle);
    _reviewsContainer = document.createElement('div');
    _reviewsContainer.id = 'reviews-list';
    reviewsCard.appendChild(_reviewsContainer);
    container.appendChild(reviewsCard);
    _loadReviews();

    // Comments section
    var commentsCard = document.createElement('div');
    commentsCard.className = 'neu-flat-card p-lg mb-lg';
    var commentsTitle = document.createElement('h3');
    commentsTitle.className = 'mb-md';
    commentsTitle.textContent = 'Comentarios';
    commentsCard.appendChild(commentsTitle);
    _commentsContainer = document.createElement('div');
    _commentsContainer.id = 'comments-list';
    commentsCard.appendChild(_commentsContainer);
    _renderCommentInput(commentsCard);
    container.appendChild(commentsCard);
    _loadComments();
  }

  function _renderMainInfo(card) {
    var fb = _feedback;

    // Header with type badge and date
    var headerRow = document.createElement('div');
    headerRow.className = 'flex items-center justify-between mb-md flex-wrap gap-sm';

    var badgesGroup = document.createElement('div');
    badgesGroup.className = 'flex items-center gap-sm flex-wrap';
    badgesGroup.appendChild(Components.typeBadge(fb.feedback_type));
    if (fb.platform) {
      badgesGroup.appendChild(Components.platformBadge(fb.platform));
    }
    if (fb.is_auto_feedback) {
      var autoBadge = document.createElement('span');
      autoBadge.className = 'type-badge';
      autoBadge.style.backgroundColor = '#FDAA5E1A';
      autoBadge.style.color = '#FDAA5E';
      autoBadge.textContent = 'Autom\u00e1tico';
      badgesGroup.appendChild(autoBadge);
    }
    headerRow.appendChild(badgesGroup);

    var dateEl = document.createElement('span');
    dateEl.className = 'text-secondary';
    dateEl.textContent = Components.formatDateTime(fb.created_at);
    headerRow.appendChild(dateEl);
    card.appendChild(headerRow);

    // Subject
    if (fb.subject) {
      var subjectEl = document.createElement('h3');
      subjectEl.className = 'mb-sm';
      subjectEl.textContent = fb.subject;
      card.appendChild(subjectEl);
    }

    // Body
    if (fb.body) {
      var bodyEl = document.createElement('div');
      bodyEl.className = 'feedback-body mb-md';
      bodyEl.textContent = fb.body;
      card.appendChild(bodyEl);
    }

    // Metadata grid
    var metaGrid = document.createElement('div');
    metaGrid.className = 'detail-meta-grid';

    _addMetaItem(metaGrid, 'Usuario', fb.user_display_name || fb.user_id || '-');
    _addMetaItem(metaGrid, 'Versi\u00f3n App', fb.app_version || '-');
    _addMetaItem(metaGrid, 'Plataforma', fb.platform || '-');
    _addMetaItem(metaGrid, 'Auto-feedback', fb.is_auto_feedback ? 'S\u00ed' : 'No');

    if (fb.request_id) {
      _addMetaItem(metaGrid, 'Request ID', fb.request_id);
    }

    // Datos adicionales de context_data si existen
    if (fb.context_data) {
      var ctx = fb.context_data;
      if (ctx.device_model) _addMetaItem(metaGrid, 'Dispositivo', ctx.device_model);
      if (ctx.os_version) _addMetaItem(metaGrid, 'Versi\u00f3n OS', ctx.os_version);
      if (ctx.locale) _addMetaItem(metaGrid, 'Idioma', ctx.locale);
      if (ctx.email) _addMetaItem(metaGrid, 'Email', ctx.email);
    }

    card.appendChild(metaGrid);

    // Context data (JSON)
    if (fb.context_data && Object.keys(fb.context_data).length > 0) {
      var contextSection = document.createElement('div');
      contextSection.className = 'mt-md';
      var contextTitle = document.createElement('h4');
      contextTitle.className = 'mb-sm';
      contextTitle.textContent = 'Datos de Contexto';
      contextSection.appendChild(contextTitle);

      var pre = document.createElement('pre');
      pre.className = 'code-block';
      pre.textContent = JSON.stringify(fb.context_data, null, 2);
      contextSection.appendChild(pre);
      card.appendChild(contextSection);
    }
  }

  function _addMetaItem(container, label, value) {
    var item = document.createElement('div');
    item.className = 'detail-meta-item';

    var labelEl = document.createElement('span');
    labelEl.className = 'detail-meta-label';
    labelEl.textContent = label;

    var valueEl = document.createElement('span');
    valueEl.className = 'detail-meta-value';
    valueEl.textContent = Components.sanitize(String(value));

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    container.appendChild(item);
  }

  async function _loadAuditLog(card) {
    try {
      var audit = await Api.auditLog.getByRequestId(_feedback.request_id);
      // Clear shimmer
      var shimmer = card.querySelector('.shimmer-container');
      if (shimmer) shimmer.remove();

      if (!audit) {
        var noData = document.createElement('p');
        noData.className = 'text-secondary';
        noData.textContent = 'No se encontr\u00f3 registro de auditor\u00eda para este request.';
        card.appendChild(noData);
        return;
      }

      var grid = document.createElement('div');
      grid.className = 'detail-meta-grid';

      if (audit.user_question) {
        _addMetaItem(grid, 'Pregunta del usuario', audit.user_question);
      }
      if (audit.generated_sql) {
        var sqlSection = document.createElement('div');
        sqlSection.className = 'mt-sm';
        var sqlLabel = document.createElement('span');
        sqlLabel.className = 'detail-meta-label';
        sqlLabel.textContent = 'SQL Generado';
        sqlSection.appendChild(sqlLabel);
        var sqlPre = document.createElement('pre');
        sqlPre.className = 'code-block mt-xs';
        sqlPre.textContent = audit.generated_sql;
        sqlSection.appendChild(sqlPre);
        card.appendChild(grid);
        card.appendChild(sqlSection);
      } else {
        card.appendChild(grid);
      }

      var statsRow = document.createElement('div');
      statsRow.className = 'flex gap-md mt-md flex-wrap';

      if (audit.row_count !== null && audit.row_count !== undefined) {
        var rowEl = document.createElement('span');
        rowEl.className = 'type-badge';
        rowEl.textContent = 'Filas: ' + audit.row_count;
        statsRow.appendChild(rowEl);
      }
      if (audit.execution_time_ms !== null && audit.execution_time_ms !== undefined) {
        var timeEl = document.createElement('span');
        timeEl.className = 'type-badge';
        timeEl.textContent = 'Tiempo: ' + audit.execution_time_ms + 'ms';
        statsRow.appendChild(timeEl);
      }
      if (audit.error_message) {
        var errEl = document.createElement('span');
        errEl.className = 'type-badge';
        errEl.style.backgroundColor = '#D630311A';
        errEl.style.color = '#D63031';
        errEl.textContent = 'Error: ' + Components.truncate(audit.error_message, 80);
        errEl.title = audit.error_message;
        statsRow.appendChild(errEl);
      }

      if (statsRow.children.length > 0) {
        card.appendChild(statsRow);
      }
    } catch (err) {
      console.error('[FeedbackDetail] Audit log error:', err);
    }
  }

  async function _renderActions(card) {
    card.innerHTML = '';
    var actionsTitle = document.createElement('h3');
    actionsTitle.className = 'mb-md';
    actionsTitle.textContent = 'Acciones';
    card.appendChild(actionsTitle);

    var form = document.createElement('div');
    form.className = 'actions-form';

    // Status selector
    var statusGroup = document.createElement('div');
    statusGroup.className = 'form-group';
    var statusLabel = document.createElement('label');
    statusLabel.className = 'form-label';
    statusLabel.textContent = 'Cambiar Estado';
    statusGroup.appendChild(statusLabel);

    var statusSelect = document.createElement('select');
    statusSelect.className = 'input';
    statusSelect.id = 'action-status';
    statusSelect.innerHTML = '<option value="">-- Seleccionar estado --</option>';

    var statuses = await Api.statuses.list();
    statuses.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.display_name;
      if (_feedback.current_status_id === s.id) {
        opt.selected = true;
      }
      statusSelect.appendChild(opt);
    });

    statusGroup.appendChild(statusSelect);
    form.appendChild(statusGroup);

    // Assigned to selector
    var assignGroup = document.createElement('div');
    assignGroup.className = 'form-group';
    var assignLabel = document.createElement('label');
    assignLabel.className = 'form-label';
    assignLabel.textContent = 'Asignar a';
    assignGroup.appendChild(assignLabel);

    var assignSelect = document.createElement('select');
    assignSelect.className = 'input';
    assignSelect.id = 'action-assign';
    assignSelect.innerHTML = '<option value="">-- Sin asignar --</option>';

    var allAdmins = Api.admins.getAll();
    allAdmins.forEach(function(a) {
      var opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.display_name;
      if (_feedback.current_assigned_to === a.id) {
        opt.selected = true;
      }
      assignSelect.appendChild(opt);
    });

    assignGroup.appendChild(assignSelect);
    form.appendChild(assignGroup);

    // Notes
    var notesGroup = document.createElement('div');
    notesGroup.className = 'form-group';
    var notesLabel = document.createElement('label');
    notesLabel.className = 'form-label';
    notesLabel.textContent = 'Notas (opcional)';
    notesGroup.appendChild(notesLabel);
    var notesInput = document.createElement('textarea');
    notesInput.className = 'input';
    notesInput.id = 'action-notes';
    notesInput.rows = 2;
    notesInput.maxLength = 1000;
    notesInput.placeholder = 'Agregar una nota sobre este cambio...';
    notesGroup.appendChild(notesInput);
    form.appendChild(notesGroup);

    // Submit button
    var submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Guardar Cambios';
    submitBtn.addEventListener('click', _handleStatusChange);
    form.appendChild(submitBtn);

    card.appendChild(form);
  }

  async function _handleStatusChange() {
    var statusSelect = document.getElementById('action-status');
    var assignSelect = document.getElementById('action-assign');
    var notesInput = document.getElementById('action-notes');

    var statusId = statusSelect ? statusSelect.value : null;
    var assignedTo = assignSelect ? assignSelect.value || null : null;
    var notes = notesInput ? notesInput.value.trim() : null;

    if (!statusId) {
      Components.toast('Selecciona un estado', 'warning');
      return;
    }

    try {
      var result = await Api.reviews.create(
        _feedbackId,
        statusId,
        assignedTo,
        notes
      );

      if (result.success) {
        Components.toast('Estado actualizado correctamente', 'success');
        if (notesInput) notesInput.value = '';
        // Refresh feedback data and reviews
        _feedback = await Api.feedback.get(_feedbackId);
        _loadReviews();
      } else {
        Components.toast('Error: ' + (result.error || 'No se pudo guardar'), 'error');
      }
    } catch (err) {
      console.error('[FeedbackDetail] Status change error:', err);
      Components.toast('Error al actualizar el estado', 'error');
    }
  }

  async function _loadReviews() {
    if (!_reviewsContainer) return;
    _reviewsContainer.innerHTML = '';
    _reviewsContainer.appendChild(Components.shimmerLines(3));

    try {
      var reviews = await Api.reviews.listByFeedback(_feedbackId);
      _reviewsContainer.innerHTML = '';

      if (reviews.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'text-secondary';
        empty.textContent = 'Sin revisiones a\u00fan.';
        _reviewsContainer.appendChild(empty);
        return;
      }

      reviews.forEach(function(review) {
        _reviewsContainer.appendChild(_createReviewItem(review));
      });
    } catch (err) {
      console.error('[FeedbackDetail] Reviews load error:', err);
      _reviewsContainer.innerHTML = '';
      var errorEl = document.createElement('p');
      errorEl.className = 'text-secondary';
      errorEl.textContent = 'Error al cargar revisiones.';
      _reviewsContainer.appendChild(errorEl);
    }
  }

  function _createReviewItem(review) {
    var item = document.createElement('div');
    item.className = 'review-item animate-fade-in';

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-xs';

    var leftGroup = document.createElement('div');
    leftGroup.className = 'flex items-center gap-sm';

    var adminName = review.admin
      ? review.admin.display_name
      : 'Admin';
    leftGroup.appendChild(Components.avatar(adminName, 'sm'));

    var nameEl = document.createElement('strong');
    nameEl.textContent = adminName;
    leftGroup.appendChild(nameEl);

    if (review.status) {
      var badge = document.createElement('span');
      badge.className = 'status-badge';
      badge.style.backgroundColor = (review.status.color_hex || '#636E72') + '1A';
      badge.style.color = review.status.color_hex || '#636E72';
      badge.textContent = review.status.display_name;
      leftGroup.appendChild(badge);
    }

    if (review.assigned_admin && review.assigned_admin.display_name) {
      var assignEl = document.createElement('span');
      assignEl.className = 'text-secondary';
      assignEl.textContent = '-> ' + review.assigned_admin.display_name;
      leftGroup.appendChild(assignEl);
    }

    header.appendChild(leftGroup);

    var dateEl = document.createElement('span');
    dateEl.className = 'text-secondary text-sm';
    dateEl.textContent = Components.formatDateTime(review.created_at);
    header.appendChild(dateEl);

    item.appendChild(header);

    if (review.notes) {
      var notesEl = document.createElement('p');
      notesEl.className = 'review-notes text-secondary';
      notesEl.textContent = review.notes;
      item.appendChild(notesEl);
    }

    return item;
  }

  async function _loadComments() {
    if (!_commentsContainer) return;
    _commentsContainer.innerHTML = '';
    _commentsContainer.appendChild(Components.shimmerLines(2));

    try {
      var comments = await Api.comments.listByFeedback(_feedbackId);
      _commentsContainer.innerHTML = '';

      if (comments.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'text-secondary';
        empty.textContent = 'Sin comentarios a\u00fan.';
        _commentsContainer.appendChild(empty);
        return;
      }

      comments.forEach(function(comment) {
        _commentsContainer.appendChild(_createCommentItem(comment));
      });
    } catch (err) {
      console.error('[FeedbackDetail] Comments load error:', err);
      _commentsContainer.innerHTML = '';
      var errorEl = document.createElement('p');
      errorEl.className = 'text-secondary';
      errorEl.textContent = 'Error al cargar comentarios.';
      _commentsContainer.appendChild(errorEl);
    }
  }

  function _createCommentItem(comment) {
    var item = document.createElement('div');
    item.className = 'comment-item animate-fade-in';

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-xs';

    var leftGroup = document.createElement('div');
    leftGroup.className = 'flex items-center gap-sm';

    var adminName = comment.admin
      ? comment.admin.display_name
      : 'Admin';
    leftGroup.appendChild(Components.avatar(adminName, 'sm'));

    var nameEl = document.createElement('strong');
    nameEl.textContent = adminName;
    leftGroup.appendChild(nameEl);

    header.appendChild(leftGroup);

    var dateEl = document.createElement('span');
    dateEl.className = 'text-secondary text-sm';
    dateEl.textContent = Components.formatDateTime(comment.created_at);
    header.appendChild(dateEl);

    item.appendChild(header);

    var bodyEl = document.createElement('p');
    bodyEl.className = 'comment-body';
    bodyEl.textContent = comment.body;
    item.appendChild(bodyEl);

    return item;
  }

  function _renderCommentInput(card) {
    var inputGroup = document.createElement('div');
    inputGroup.className = 'comment-input-group mt-md';

    _commentInput = document.createElement('textarea');
    _commentInput.className = 'input';
    _commentInput.rows = 2;
    _commentInput.maxLength = 5000;
    _commentInput.placeholder = 'Escribe un comentario...';

    var sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-primary mt-sm';
    sendBtn.textContent = 'Enviar Comentario';
    sendBtn.addEventListener('click', _handleSendComment);

    _commentInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        _handleSendComment();
      }
    });

    inputGroup.appendChild(_commentInput);
    inputGroup.appendChild(sendBtn);
    card.appendChild(inputGroup);
  }

  async function _handleSendComment() {
    if (!_commentInput) return;
    var body = _commentInput.value.trim();
    if (!body) return;

    _commentInput.disabled = true;

    try {
      var result = await Api.comments.create(_feedbackId, body);
      if (result.success) {
        _commentInput.value = '';
        _commentsContainer.appendChild(_createCommentItem(result.data));
        // Remove empty state text if present
        var emptyEl = _commentsContainer.querySelector('.text-secondary');
        if (emptyEl && emptyEl.textContent.indexOf('Sin comentarios') !== -1) {
          emptyEl.remove();
        }
      } else {
        Components.toast('Error al enviar comentario: ' + (result.error || ''), 'error');
      }
    } catch (err) {
      console.error('[FeedbackDetail] Comment send error:', err);
      Components.toast('Error al enviar el comentario', 'error');
    }

    _commentInput.disabled = false;
    _commentInput.focus();
  }

  function _setupRealtime() {
    // Subscribe to new reviews for this feedback
    var reviewChannel = Config.getClient()
      .channel('detail-reviews-' + _feedbackId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_reviews',
          filter: 'feedback_id=eq.' + _feedbackId
        },
        function() {
          _loadReviews();
        }
      )
      .subscribe();
    _realtimeChannels.push(reviewChannel);

    // Subscribe to new comments for this feedback
    var commentChannel = Config.getClient()
      .channel('detail-comments-' + _feedbackId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback_comments',
          filter: 'feedback_id=eq.' + _feedbackId
        },
        function(payload) {
          // Only add if not from current admin (to avoid duplicates)
          var currentAdmin = Auth.getCurrentAdmin();
          if (payload.new && payload.new.admin_user_id !== currentAdmin.id) {
            _loadComments();
          }
        }
      )
      .subscribe();
    _realtimeChannels.push(commentChannel);
  }

  function _cleanup() {
    _realtimeChannels.forEach(function(ch) {
      try { ch.unsubscribe(); } catch (e) { /* ignore */ }
    });
    _realtimeChannels = [];
    _feedbackId = null;
    _feedback = null;
    _reviewsContainer = null;
    _commentsContainer = null;
    _commentInput = null;
  }

  return { render: render };
})();
