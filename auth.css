'use strict';

/**
 * GAZE Storage & API Service v2.0
 */
const StorageService = (() => {
  const PREFIX = 'gaze_';
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

  function _key(n) { return PREFIX + n; }

  function get(name, defaultValue = null) {
    try { const raw = localStorage.getItem(_key(name)); return raw === null ? defaultValue : JSON.parse(raw); }
    catch { return defaultValue; }
  }
  function set(name, value) {
    try { localStorage.setItem(_key(name), JSON.stringify(value)); return true; } catch { return false; }
  }
  function remove(name) { try { localStorage.removeItem(_key(name)); } catch {} }

  function getUser()       { return get('user'); }
  function getOrderCount() { const n = get('order_count', 0); return typeof n === 'number' ? n : 0; }
  function incrementOrderCount() { const next = getOrderCount() + 1; set('order_count', next); return next; }
  function clearSession() { remove('user'); remove('cart'); remove('order_count'); remove('prices'); }

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
          try { const d = await res.json(); msg = d?.error || msg; } catch {}
          const err = new Error(msg); err.status = res.status;
          if (res.status === 401 || res.status === 403) {
            if (endpoint.includes('/auth') || endpoint.includes('/user')) clearSession();
          }
          throw err;
        }
        return await res.json();
      } catch (e) { clearTimeout(timer); throw e; }
    };

    try { return await attempt(API_URL); }
    catch (e) {
      if (e.name === 'TypeError' || e.message?.includes('Failed to fetch') || e.name === 'AbortError') {
        console.warn('[Storage] Primary API unreachable, trying proxy fallback...');
        try { return await attempt(window.location.origin + '/proxy/api'); }
        catch (fb) { console.warn('[Storage] Proxy fallback failed:', fb.message); }
        if (e.name === 'AbortError') throw new Error('Превышено время ожидания сервера');
        throw new Error('Не удалось связаться с сервером. Проверьте соединение.');
      }
      throw e;
    }
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
        console.warn(`[Storage] syncUser ${i+1}/${retries}: ${e.message}`);
        if (i === retries - 1) {
          const cached = get('user');
          if (cached && !cached.isGuest) { cached._fromCache = true; return cached; }
          const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          if (tgUser) {
            const fallback = { id: null, tg_id: tgUser.id, username: tgUser.username,
              full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
              role: 'user', order_count: 0, is_fallback: true, notify_orders: 1, notify_promos: 1 };
            set('user', fallback); return fallback;
          }
          throw e;
        }
        await sleep(Math.min(1000 * Math.pow(2, i) + Math.random() * 500, 8000));
      }
    }
  }

  async function updateUserProfile(profile) {
    const updated = await apiRequest('/user/profile', 'PUT', profile);
    set('user', updated); return updated;
  }

  async function getPrices() {
    try { const prices = await apiRequest('/prices'); set('prices', prices); return prices; }
    catch { return get('prices', {}); }
  }

  async function submitOrder(orderData) {
    const result = await apiRequest('/orders', 'POST', orderData);
    incrementOrderCount(); return result;
  }

  async function getOrderHistory() {
    try { return await apiRequest('/orders/history'); } catch { return []; }
  }

  async function getReferralData() {
    try { return await apiRequest('/user/referrals'); } catch { return null; }
  }

  async function generateReferralCode(userId) {
    const existing = get('referral_code');
    if (existing) return { code: existing };
    const code = 'GZ' + (userId
      ? Math.abs(userId).toString(36).toUpperCase().padStart(6,'0').substring(0,6)
      : Math.random().toString(36).substring(2,8).toUpperCase());
    try {
      const result = await apiRequest('/user/referral/generate', 'POST', { code });
      const finalCode = result?.code || code; set('referral_code', finalCode); return { code: finalCode };
    } catch { set('referral_code', code); return { code }; }
  }

  async function getAdminStats() { return await apiRequest('/admin/stats'); }
  async function updateOrderStatus(orderId, status, note = '') {
    return await apiRequest('/admin/orders/status', 'POST', { orderId, status, note });
  }

  return {
    API_URL, apiRequest, syncUser, updateUserProfile, getPrices,
    submitOrder, getOrderHistory, getReferralData, generateReferralCode,
    getAdminStats, updateOrderStatus,
    getUser, getOrderCount, clearSession, get, set
  };
})();

window.StorageService = StorageService;
