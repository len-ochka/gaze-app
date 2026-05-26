const StorageService = (() => {
  const PREFIX = 'gaze_';
  const API_URL = 'http://localhost:3000/api';

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
        const err = await response.json();
        throw new Error(err.error || 'API Request failed');
      }
      return await response.json();
    } catch (e) {
      console.error(`[StorageService] API Error (${endpoint}):`, e);
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
