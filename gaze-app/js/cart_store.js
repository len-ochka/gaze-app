const CartStore = (() => {
  let _items = [];
  const _subscribers = new Set();

  function _notify() {
    StorageService.setCart(_items);
    _subscribers.forEach(fn => fn(getState()));
  }

  function subscribe(fn) {
    _subscribers.add(fn);
    return () => _subscribers.delete(fn);
  }

  function init() {
    _items = StorageService.getCart();
    _notify();
  }

  function getState() {
    return {
      items: [..._items],
      totalQty: _items.reduce((s, i) => s + i.qty, 0),
      subtotal: _items.reduce((s, i) => s + i.price * i.qty, 0),
      isEmpty: _items.length === 0
    };
  }

  function addItems(newItems) {
    const kitIds = new Set(newItems.map(i => i.kitGroup).filter(Boolean));
    if (kitIds.size > 0) {
      _items = _items.filter(i => !kitIds.has(i.kitGroup));
    }
    newItems.forEach(item => {
      const idx = _items.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        _items[idx].qty += item.qty;
      } else {
        _items.push({ ...item });
      }
    });
    _notify();
  }

  function updateQty(id, delta) {
    const idx = _items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const next = _items[idx].qty + delta;
    if (next <= 0) {
      _items.splice(idx, 1);
    } else {
      _items[idx] = { ..._items[idx], qty: next };
    }
    _notify();
  }

  function removeItem(id) {
    _items = _items.filter(i => i.id !== id);
    _notify();
  }

  function clear() {
    _items = [];
    _notify();
  }

  return {
    init,
    subscribe,
    getState,
    addItems,
    updateQty,
    removeItem,
    clear
  };
})();

window.CartStore = CartStore;
