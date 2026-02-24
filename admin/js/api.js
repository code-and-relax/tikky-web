var Api = (function() {
  function _client() { return Config.getClient(); }

  // ==================== FEEDBACK ====================

  var feedback = {
    async list(filters, cursor, pageSize) {
      pageSize = pageSize || 25;
      var query = _client()
        .from('admin_feedback_overview')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(pageSize + 1);

      if (filters.types && filters.types.length > 0) {
        query = query.in('feedback_type', filters.types);
      }
      if (filters.statusId) {
        query = query.eq('current_status_id', filters.statusId);
      }
      if (filters.assignedTo) {
        query = query.eq('current_assigned_to', filters.assignedTo);
      }
      if (filters.platform) {
        query = query.eq('platform', filters.platform);
      }
      if (filters.isAuto !== undefined && filters.isAuto !== null) {
        query = query.eq('is_auto_feedback', filters.isAuto);
      }
      if (filters.search) {
        var sanitized = filters.search.replace(/[,.()"\\%_*]/g, '');
        if (sanitized.length > 0) {
          query = query.or(
            'subject.ilike.%' + sanitized + '%,body.ilike.%' + sanitized + '%'
          );
        }
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      var result = await query;
      if (result.error) {
        console.error('[Api] feedback.list error:', result.error);
        return { data: [], nextCursor: null };
      }

      var data = result.data || [];
      var hasMore = data.length > pageSize;
      if (hasMore) data = data.slice(0, pageSize);
      var nextCursor = hasMore && data.length > 0
        ? data[data.length - 1].created_at
        : null;

      return { data: data, nextCursor: nextCursor };
    },

    async get(id) {
      var result = await _client()
        .from('admin_feedback_overview')
        .select('*')
        .eq('id', id)
        .single();
      if (result.error) {
        console.error('[Api] feedback.get error:', result.error);
        return null;
      }
      return result.data;
    }
  };

  // ==================== REVIEWS ====================

  var reviews = {
    async listByFeedback(feedbackId) {
      var result = await _client()
        .from('feedback_reviews')
        .select(
          '*, admin:admin_users!feedback_reviews_admin_user_id_fkey(display_name), '
          + 'status:feedback_status_definitions(display_name, color_hex), '
          + 'assigned_admin:admin_users!feedback_reviews_assigned_to_fkey(display_name)'
        )
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: false });
      if (result.error) {
        console.error('[Api] reviews.list error:', result.error);
        return [];
      }
      return result.data || [];
    },

    async create(feedbackId, statusId, assignedTo, notes) {
      var admin = Auth.getCurrentAdmin();
      if (!admin) return { success: false, error: 'Not authenticated' };

      var payload = {
        feedback_id: feedbackId,
        admin_user_id: admin.id,
        status_id: statusId
      };
      if (assignedTo !== undefined) payload.assigned_to = assignedTo;
      if (notes) payload.notes = notes;

      var result = await _client()
        .from('feedback_reviews')
        .insert(payload)
        .select()
        .single();

      if (result.error) {
        console.error('[Api] reviews.create error:', result.error);
        return { success: false, error: result.error.message };
      }
      return { success: true, data: result.data };
    }
  };

  // ==================== COMMENTS ====================

  var comments = {
    async listByFeedback(feedbackId) {
      var result = await _client()
        .from('feedback_comments')
        .select('*, admin:admin_users(display_name)')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });
      if (result.error) {
        console.error('[Api] comments.list error:', result.error);
        return [];
      }
      return result.data || [];
    },

    async create(feedbackId, body) {
      var admin = Auth.getCurrentAdmin();
      if (!admin) return { success: false, error: 'Not authenticated' };

      var result = await _client()
        .from('feedback_comments')
        .insert({
          feedback_id: feedbackId,
          admin_user_id: admin.id,
          body: body
        })
        .select('*, admin:admin_users(display_name)')
        .single();

      if (result.error) {
        console.error('[Api] comments.create error:', result.error);
        return { success: false, error: result.error.message };
      }
      return { success: true, data: result.data };
    }
  };

  // ==================== CHAT ====================

  var chat = {
    async list(limit) {
      limit = limit || 50;
      var result = await _client()
        .from('admin_chat_messages')
        .select('*, admin:admin_users(display_name)')
        .order('created_at', { ascending: true })
        .limit(limit);
      if (result.error) {
        console.error('[Api] chat.list error:', result.error);
        return [];
      }
      return result.data || [];
    },

    async send(body, feedbackId) {
      var admin = Auth.getCurrentAdmin();
      if (!admin) return { success: false, error: 'Not authenticated' };

      var payload = {
        admin_user_id: admin.id,
        body: body
      };
      if (feedbackId) payload.feedback_id = feedbackId;

      var result = await _client()
        .from('admin_chat_messages')
        .insert(payload)
        .select('*, admin:admin_users(display_name)')
        .single();

      if (result.error) {
        console.error('[Api] chat.send error:', result.error);
        return { success: false, error: result.error.message };
      }
      return { success: true, data: result.data };
    },

    subscribe(callback) {
      return _client()
        .channel('admin-chat')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'admin_chat_messages' },
          function(payload) { callback(payload.new); }
        )
        .subscribe();
    }
  };

  // ==================== AUDIT LOG ====================

  var auditLog = {
    async getByRequestId(requestId) {
      if (!requestId) return null;
      var result = await _client()
        .from('ai_chat_audit_log')
        .select('*')
        .eq('request_id', requestId)
        .single();
      if (result.error) {
        console.error('[Api] auditLog.get error:', result.error);
        return null;
      }
      return result.data;
    }
  };

  // ==================== STATUS DEFINITIONS ====================

  var statuses = {
    _cache: null,

    async list() {
      if (this._cache) return this._cache;
      var result = await _client()
        .from('feedback_status_definitions')
        .select('*')
        .order('display_order', { ascending: true });
      if (result.error) {
        console.error('[Api] statuses.list error:', result.error);
        return [];
      }
      this._cache = result.data || [];
      return this._cache;
    },

    getColorForStatus(statusId) {
      if (!this._cache) return '#636E72';
      var status = this._cache.find(function(s) { return s.id === statusId; });
      return status ? status.color_hex : '#636E72';
    },

    getNameForStatus(statusId) {
      if (!this._cache) return statusId;
      var status = this._cache.find(function(s) { return s.id === statusId; });
      return status ? status.display_name : statusId;
    }
  };

  // ==================== ADMIN USERS ====================

  var admins = {
    _known: {},

    register(adminData) {
      if (adminData && adminData.id) {
        this._known[adminData.id] = adminData;
      }
    },

    getAll() {
      return Object.values(this._known);
    },

    getName(adminId) {
      var admin = this._known[adminId];
      return admin ? admin.display_name : 'Desconocido';
    }
  };

  // ==================== STATS ====================

  var stats = {
    async getSummary() {
      var client = _client();

      var types = [
        'ai_chat_error',
        'ai_chat_message_feedback',
        'general_feedback',
        'bug_report',
        'suggestion',
        'other'
      ];
      var counts = {};
      var total = 0;

      for (var i = 0; i < types.length; i++) {
        var typeResult = await client
          .from('app_feedback')
          .select('*', { count: 'exact', head: true })
          .eq('feedback_type', types[i]);
        var c = typeResult.error ? 0 : (typeResult.count || 0);
        counts[types[i]] = c;
        total += c;
      }

      var statusList = await statuses.list();
      var statusCounts = {};

      var unreviewedResult = await client
        .from('admin_feedback_overview')
        .select('*', { count: 'exact', head: true })
        .is('current_status_id', null);
      statusCounts['unreviewed'] = unreviewedResult.count || 0;

      for (var j = 0; j < statusList.length; j++) {
        var statusResult = await client
          .from('admin_feedback_overview')
          .select('*', { count: 'exact', head: true })
          .eq('current_status_id', statusList[j].id);
        statusCounts[statusList[j].id] = statusResult.count || 0;
      }

      return { total: total, byType: counts, byStatus: statusCounts };
    }
  };

  // ==================== REALTIME ====================

  var realtime = {
    _channels: [],

    subscribeToReviews(callback) {
      var ch = _client()
        .channel('admin-reviews')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feedback_reviews' },
          function(payload) { callback(payload.new); }
        )
        .subscribe();
      this._channels.push(ch);
      return ch;
    },

    subscribeToComments(callback) {
      var ch = _client()
        .channel('admin-comments')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feedback_comments' },
          function(payload) { callback(payload.new); }
        )
        .subscribe();
      this._channels.push(ch);
      return ch;
    },

    unsubscribeAll() {
      this._channels.forEach(function(ch) { ch.unsubscribe(); });
      this._channels = [];
    }
  };

  return {
    feedback: feedback,
    reviews: reviews,
    comments: comments,
    chat: chat,
    auditLog: auditLog,
    statuses: statuses,
    admins: admins,
    stats: stats,
    realtime: realtime
  };
})();
