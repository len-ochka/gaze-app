/**
 * Gaze Storage & API Service
 * Handles data persistence and communication with the backend.
 */
const StorageService = (() => {
  const PREFIX = 'gaze_';

  // Определение URL API based on environment
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : window.location.origin + '/api';

  function _key(name) {
    return PREFIX + name;
  }

  /**
   * Универсальный метод для API запросов с таймаутом и заголовками Telegram.
   */
  async function apiRequest(endpoint, method = 'GET', body = null, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const initData = window.TelegramService?.getInitData() || '';
    const headers = {
      'x-tg-init-data': initData
    };

    // Добавляем Content-Type только когда это не GET и есть тело запроса
    if (method !== 'GET' && body !== null) {
      headers['Content-Type'] = 'application/json';
    }

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
        let errorData = null;
        try {
          errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (parseErr) {}

        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = errorData;

        // Если получили 401 или 403 на критическом пути - очищаем сессию
        if (response.status === 401 || response.status === 403) {
          if (endpoint.includes('/auth') || endpoint.includes('/user')) {
             console.warn('[StorageService] Auth error detected, clearing session...');
             clearSession();
          }
        }
        throw err;
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
   * Синхронизация состояния пользователя с бэкендом с механизмом повторов.
   */
  async function syncUser(retries = 4) {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || null;
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[StorageService] Попытка синхронизации ${i + 1}...`);
        const user = await apiRequest('/auth/sync', 'POST', { start_param: startParam }, 10000);

        if (user) {
          set('user', user);
          if (user.order_count !== undefined) {
            set('order_count', user.order_count);
          }
          console.log('[StorageService] Синхронизация успешна.');
          return user;
        }
        throw new Error('Пустой ответ от сервера');
      } catch (e) {
        console.warn(`[StorageService] Попытка ${i + 1} не удалась:`, e.message);

        if (i === retries - 1) {
          const cachedUser = get('user');
          if (cachedUser) {
            console.log('[StorageService] Используются кэшированные данные пользователя.');
            return cachedUser;
          }
          const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          if (tgUser) {
            console.log('[StorageService] Используются данные напрямую из Telegram.');
            const fallbackUser = {
              id: null,
              tg_id: tgUser.id,
              username: tgUser.username,
              full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '),
              role: 'user',
              order_count: 0,
              is_fallback: true
            };
            set('user', fallbackUser);
            return fallbackUser;
          }
          throw e;
        }

        // Экспоненциальная задержка с джиттером
        const delay = (1000 * Math.pow(2, i)) + (Math.random() * 1000);
        await sleep(delay);
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

  async function getAdminStats() { return await apiRequest('/admin/stats'); }
  async function updateOrderStatus(orderId, status) { return await apiRequest('/admin/orders/status', 'POST', { orderId, status }); }
  async function getReferralData() { return await apiRequest('/user/referrals'); }
  async function getOrderHistory() { return await apiRequest('/orders/history'); }

  return {
    API_URL,
    syncUser,
    updateUserProfile,
    getPrices,
    submitOrder,
    getAdminStats,
    updateOrderStatus,
    getReferralData,
    getOrderHistory,
    getUser,
    getOrderCount,
    clearSession,
    apiRequest,
    get,
    set
  };
})();

window.StorageService = StorageService;
