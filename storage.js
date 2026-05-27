const StorageService = (() => {
  const PREFIX = 'gaze_';
  // If we are on localhost, use the local port 3000.
  // Otherwise, assume the API is served from the same host under /api
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

  function _key(name) {
    return PREFIX + name;
  }

  async function apiRequest(endpoint, method = 'GET', body = null) {
    const initData = window.TelegramService?.getInitData() || '';
    const headers = {
      'Content-Type': 'application/json',
      'x-tg-init-data': initData
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, options);
      if (!response.ok) {
        let errorMsg = 'API Request failed';
        try {
          const err = await response.json();
          errorMsg = err.error || errorMsg;
        } catch (parseErr) {}
        throw new Error(errorMsg);
      }
      return await response.json();
    } catch (e) {
      console.error(`[StorageService] API Error (${endpoint}):`, e);
      if (e.message === 'Failed to fetch') {
        throw new Error('Сервер недоступен. Проверьте подключение или API_URL.');
      }
      throw e;
    }
  }

  function get(name, defaultValue = null) {
    try {
      const raw = localStorage.getItem(_key(name));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[StorageService] Failed to read "${name}":`, e);
      return defaultValue;
    }
  }

  function set(name, value) {
    try {
      localStorage.setItem(_key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[StorageService] Failed to write "${name}":`, e);
      return false;
    }
  }

  function remove(name) {
    try {
      localStorage.removeItem(_key(name));
    } catch (e) {}
  }

  async function syncUser() {
    try {
      const user = await apiRequest('/auth/sync', 'POST');
      set('user', user);
      if (user.order_count !== undefined) {
        set('order_count', user.order_count);
      }
      return user;
    } catch (e) {
      return get('user');
    }
  }

  async function updateUserProfile(profile) {
    await apiRequest('/user/profile', 'PUT', profile);
    const currentUser = get('user') || {};
    const updatedUser = { ...currentUser, ...profile };
    set('user', updatedUser);
    return updatedUser;
  }

  async function getPrices() {
    try {
      const prices = await apiRequest('/prices');
      set('prices', prices);
      return prices;
    } catch (e) {
      return get('prices', {});
    }
  }

  async function submitOrder(orderData) {
    const result = await apiRequest('/orders', 'POST', orderData);
    incrementOrderCount();
    return result;
  }

  function getUser() {
    return get('user');
  }

  function getOrderCount() {
    const n = get('order_count', 0);
    return typeof n === 'number' ? n : 0;
  }

  function incrementOrderCount() {
    const next = getOrderCount() + 1;
    set('order_count', next);
    return next;
  }

  function clearSession() {
    remove('user');
    remove('cart');
    remove('order_count');
  }

  return {
    syncUser,
    updateUserProfile,
    getPrices,
    submitOrder,
    getUser,
    getOrderCount,
    clearSession,
    apiRequest
  };
})();

window.StorageService = StorageService;
