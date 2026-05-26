const StorageService = (() => {
  const PREFIX = 'gaze_';

  function _key(name) {
    return PREFIX + name;
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

  function validateUser(obj) {
    if (!obj || typeof obj !== 'object') return null;
    return {
      name: typeof obj.name === 'string' ? obj.name : '',
      email: typeof obj.email === 'string' ? obj.email : '',
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      address: typeof obj.address === 'string' ? obj.address : '',
      tgId: obj.tgId ?? null,
      tgUsername: obj.tgUsername ?? null
    };
  }

  function validateCartItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item =>
      item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.price === 'number' &&
      typeof item.qty === 'number' &&
      item.qty > 0
    );
  }

  function getUser() {
    return validateUser(get('user'));
  }

  function setUser(user) {
    return set('user', user);
  }

  function getCart() {
    return validateCartItems(get('cart', []));
  }

  function setCart(items) {
    return set('cart', items);
  }

  function getAccounts() {
    const data = get('accounts', {});
    return typeof data === 'object' && data !== null ? data : {};
  }

  function setAccounts(accounts) {
    return set('accounts', accounts);
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
    get,
    set,
    remove,
    getUser,
    setUser,
    getCart,
    setCart,
    getAccounts,
    setAccounts,
    getOrderCount,
    incrementOrderCount,
    clearSession
  };
})();

window.StorageService = StorageService;
