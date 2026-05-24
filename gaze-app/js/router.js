const Router = (() => {
  const SCREENS_WITH_NAV = ['home', 'constructor', 'cart', 'profile'];
  const SCREENS_NO_BACK_BTN = ['home', 'auth'];

  let _currentScreen = null;
  let _previousScreen = null;
  const _history = [];

  const _el = {
    nav: () => document.getElementById('bottom-nav'),
    screen: (name) => document.getElementById(`screen-${name}`),
    navItem: (name) => document.querySelector(`.nav-item[data-screen="${name}"]`)
  };

  function _activateScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = _el.screen(name);
    if (target) target.classList.add('active');
  }

  function _updateNav(name) {
    const nav = _el.nav();
    if (!nav) return;
    const showNav = SCREENS_WITH_NAV.includes(name);
    nav.style.display = showNav ? '' : 'none';

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.screen === name);
    });
  }

  function _updateBackButton(name) {
    if (SCREENS_NO_BACK_BTN.includes(name) || _history.length < 2) {
      TelegramService.BackButton.hide();
    } else {
      TelegramService.BackButton.show(() => back());
    }
  }

  function _updateMainButton(name) {
    if (name !== 'cart') {
      TelegramService.MainButton.hide();
      return;
    }
    const { isEmpty } = CartStore.getState();
    if (isEmpty) {
      TelegramService.MainButton.hide();
    } else {
      TelegramService.MainButton.show('Оформить заказ', () => {
        window.AppHandlers?.handleCheckout?.();
      });
    }
  }

  function navigate(name, { replace = false } = {}) {
    if (name === _currentScreen) return;

    _previousScreen = _currentScreen;
    _currentScreen = name;

    if (!replace) {
      if (_history[_history.length - 1] !== name) {
        _history.push(name);
      }
    }

    _activateScreen(name);
    _updateNav(name);
    _updateBackButton(name);
    _updateMainButton(name);

    window.AppHandlers?.onScreenEnter?.(name);
  }

  function back() {
    if (_history.length < 2) return;
    _history.pop();
    const prev = _history[_history.length - 1];
    if (prev) navigate(prev, { replace: true });
  }

  function getCurrentScreen() {
    return _currentScreen;
  }

  function refreshMainButton() {
    if (_currentScreen === 'cart') {
      _updateMainButton('cart');
    }
  }

  return {
    navigate,
    back,
    getCurrentScreen,
    refreshMainButton
  };
})();

window.Router = Router;
