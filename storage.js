/**
 * Gaze Storage & API Service
 * Handles data persistence and communication with the backend.
 */
const StorageService = (() => {
  const PREFIX = 'gaze_';

  // Detect API URL based on environment
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

  function _key(name) {
    return PREFIX + name;
  }

  /**
   * Generic API request with timeout and Telegram headers.
   */
  async function apiRequest(endpoint, method = 'GET', body = null, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const initData = window.TelegramService?.getInitData() || '';
    const headers = {
      'Content-Type': 'application/json',
      'x-tg-init-data': initData
    };

    const options = {
      method,
      headers,
      signal: controller.signal
    };
    if (body) options.body = JSON.stringify(body);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, options);
      clearTimeout(timer);

      if (!response.ok) {
        let errorMsg = `API Error ${response.status}`;
        try {
          const err = await response.json();
          errorMsg = err.error || errorMsg;
        } catch (parseErr) {}
        throw new Error(errorMsg);
      }
      return await response.json();
    } catch (e) {
      clearTimeout(timer);
      console.error(`[StorageService] API Request Failed (${endpoint}):`, e);

      if (e.name === 'AbortError') {
        throw new Error('Превышено время ожидания ответа от сервера');
      }
      if (e.message === 'Failed to fetch') {
        throw new Error('Не удалось связаться с сервером. Проверьте интернет-соединение.');
      }
      throw e;
    }
  }

  /**
   * Helper to sleep for retries
   */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Synchronizes user state with the backend with retries.
   */
  async function syncUser(retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const user = await apiRequest('/auth/sync', 'POST', null, 8000); // Shorter timeout for sync
        set('user', user);
        if (user.order_count !== undefined) {
          set('order_count', user.order_count);
        }
        return user;
      } catch (e) {
        console.warn(`[StorageService] Sync attempt ${i + 1} failed:`, e.message);
        if (i === retries - 1) {
          // If all retries failed, try to use cached data
          return get('user');
        }
        // Exponential backoff
        await sleep(1000 * Math.pow(2, i));
      }
    }
  }

  /**
   * Updates user profile data.
   */
  async function updateUserProfile(profile) {
    await apiRequest('/user/profile', 'PUT', profile);
    const currentUser = get('user') || {};
    const updatedUser = { ...currentUser, ...profile };
    set('user', updatedUser);
    return updatedUser;
  }

  /**
   * Fetches current prices from the server.
   */
  async function getPrices() {
    try {
      const prices = await apiRequest('/prices');
      set('prices', prices);
      return prices;
    } catch (e) {
      console.warn('[StorageService] Falling back to cached prices');
      return get('prices', {});
    }
  }

  /**
   * Submits a new order.
   */
  async function submitOrder(orderData) {
    const result = await apiRequest('/orders', 'POST', orderData);
    incrementOrderCount();
    return result;
  }

  // --- Local Storage Helpers ---

  function get(name, defaultValue = null) {
    try {
      const raw = localStorage.getItem(_key(name));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      return defaultValue;
    }
  }

  function set(name, value) {
    try {
      localStorage.setItem(_key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(name) {
    try {
      localStorage.removeItem(_key(name));
    } catch (e) {}
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
    // We keep 'prices' in cache to avoid blank screens if offline
  }

  return {
    syncUser,
    updateUserProfile,
    getPrices,
    submitOrder,
    getUser,
    getOrderCount,
    clearSession,
    apiRequest,
    get,
    set
  };
})();

window.StorageService = StorageService;
