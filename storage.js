'use strict';

/**
 * Gaze Storage & API Service
 * Handles data persistence and backend communication.
 * Includes CORS/network fallbacks for RF blocked regions.
 */
const StorageService = (() => {
  const PREFIX = 'gaze_';

  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

  function _key(n) { return PREFIX + n; }

  // ─── LOCAL STORAGE ──────────────────────────────────────────────────────────
  function get(name, defaultValue = null) {
    try {
      const raw = localStorage.getItem(_key(name));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch { return defaultValue; }
  }

  function set(name, value) {
    try { localStorage.setItem(_key(name), JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function remove(name) {
    try { localStorage.removeItem(_key(name)); } catch {}
  }

  function getUser()       { return get('user'); }
  function getOrderCount() { const n = get('order_count', 0); return typeof n === 'number' ? n : 0; }

  function incrementOrderCount() {
    const next = getOrderCount() + 1;
    set('order_count', next);
    return next;
  }

  function clearSession() {
    remove('user'); remove('cart'); remove('order_count');
  }

  // ─── API REQUEST ─────────────────────────────────────────────────────────────
  // Поддержка CORS fallback: при ошибке сети пробуем через /proxy/ relay
  async function apiRequest(endpoint, method = 'GET', body = null, timeout = 15000) {
    const attempt = async (baseUrl) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const initData = window.TelegramService?.getInitData?.() || '';
      const headers = { 'x-tg-init-data': initData };
      if (method !== 'GET' && body !== null) headers['Content-Type'] = 'application/json';

      const options = { method, headers, signal: controller.signal };
      if (body) options.body = JSON.stringify(body);

      try {
        const res = await fetch(`${baseUrl}${endpoint}`, options);
        clearTimeout(timer);

        if (!res.ok) {
          let msg = `API Error ${res.status}`;
          let data = null;
          try { data = await res.json(); msg = data?.error || msg; } catch {}
          const err = new Error(msg);
          err.status = res.status;
          err.data = data;

          if (res.status === 401 || res.status === 403) {
            if (endpoint.includes('/auth') || endpoint.includes('/user')) clearSession();
          }
          throw err;
        }
        return await res.json();
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    try {
      return await attempt(API_URL);
    } catch (e) {
      // Fallback для CORS/сетевых блокировок РФ
      if (e.name === 'TypeError' || e.message?.includes('Failed to fetch') || e.name === 'AbortError') {
        console.warn('[StorageService] Primary API unreachable, trying proxy fallback...');
        try {
          // Пробуем /proxy/ endpoint если настроен на сервере
          return await attempt(window.location.origin + '/proxy/api');
        } catch (fallbackErr) {
          console.warn('[StorageService] Proxy fallback also failed:', fallbackErr.message);
        }

        if (e.name === 'AbortError') throw new Error('Превышено время ожидания сервера');
        throw new Error('Не удалось связаться с сервером. Проверьте соединение.');
      }
      console.error(`[StorageService] API Error (${endpoint}):`, e);
      throw e;
    }
  }

  // ─── SLEEP ────────────────────────────────────────────────────────────────────
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ─── SYNC USER ────────────────────────────────────────────────────────────────
  async function syncUser(retries = 4) {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || null;

    for (let i = 0; i < retries; i++) {
      try {
        const user = await apiRequest('/auth/sync', 'POST', { start_param: startParam }, 10000);
        if (!user) throw new Error('Пустой ответ');

        set('user', user);
        if (user.order_count !== undefined) set('order_count', user.order_count);
        return user;
      } catch (e) {
        console.warn(`[StorageService] Попытка ${i + 1} / ${retries}: ${e.message}`);

        if (i === retries - 1) {
          // Каскад fallbacks: кэш → TG initData → ошибка
          const cached = get('user');
          if (cached && !cached.isGuest) { cached._fromCache = true; return cached; }

          const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          if (tgUser) {
            const fallback = {
              id: null,
              tg_id: tgUser.id,
              username: tgUser.username,
              full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
              role: 'user', order_count: 0, is_fallback: true
            };
            set('user', fallback);
            return fallback;
          }
          throw e;
        }
        // Экспоненциальная задержка + джиттер
        await sleep(Math.min(1000 * Math.pow(2, i) + Math.random() * 500, 8000));
      }
    }
  }

  // ─── USER PROFILE ─────────────────────────────────────────────────────────────
  async function updateUserProfile(profile) {
    const current = get('user') || {};
    const updated = { ...current, ...profile };
    set('user', updated);
    try { await apiRequest('/user/profile', 'PUT', profile); }
    catch (e) { throw e; }
    return updated;
  }

  // ─── PRICES ──────────────────────────────────────────────────────────────────
  async function getPrices() {
    try {
      const prices = await apiRequest('/prices');
      set('prices', prices);
      return prices;
    } catch {
      return get('prices', {});
    }
  }

  // ─── ORDERS ──────────────────────────────────────────────────────────────────
  async function submitOrder(orderData) {
    const result = await apiRequest('/orders', 'POST', orderData);
    incrementOrderCount();
    return result;
  }

  async function getOrderHistory() {
    try { return await apiRequest('/orders/history'); }
    catch { return []; }
  }

  // ─── REFERRALS ────────────────────────────────────────────────────────────────
  async function getReferralData() {
    try { return await apiRequest('/user/referrals'); }
    catch { return null; }
  }

  /**
   * Генерация + сохранение реферального кода в БД.
   * Если код уже есть — возвращает существующий.
   */
  async function generateReferralCode(userId) {
    const existing = get('referral_code');
    if (existing) return { code: existing };

    const code = 'GZ' + (userId
      ? Math.abs(userId).toString(36).toUpperCase().padStart(6, '0').substring(0, 6)
      : Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    try {
      const result = await apiRequest('/user/referral/generate', 'POST', { code });
      const finalCode = result?.code || code;
      set('referral_code', finalCode);
      return { code: finalCode };
    } catch {
      set('referral_code', code);
      return { code };
    }
  }

  // ─── ADMIN ────────────────────────────────────────────────────────────────────
  async function getAdminStats()                          { return await apiRequest('/admin/stats'); }
  async function updateOrderStatus(orderId, status)       { return await apiRequest('/admin/orders/status', 'POST', { orderId, status }); }

  return {
    API_URL,
    apiRequest,
    syncUser,
    updateUserProfile,
    getPrices,
    submitOrder,
    getOrderHistory,
    getReferralData,
    generateReferralCode,
    getAdminStats,
    updateOrderStatus,
    getUser,
    getOrderCount,
    clearSession,
    get,
    set
  };
})();

window.StorageService = StorageService;
