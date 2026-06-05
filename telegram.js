const TelegramService = (() => {
  const tg = window.Telegram?.WebApp ?? null;

  const isAvailable = () => !!tg;
  const isTelegramUser = () => !!(tg?.initDataUnsafe?.user);

  function ready() {
    if (!tg) return;
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#080c14');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#080c14');
  }

  function getTelegramUser() {
    if (!isTelegramUser()) return null;
    const u = tg.initDataUnsafe.user;
    return {
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Пользователь',
      email: `tg_${u.id}@gaze.app`,
      phone: '',
      address: '',
      tgId: u.id,
      tgUsername: u.username || null
    };
  }

  const MainButton = {
    _handler: null,
    setText(text) {
      if (!tg?.MainButton) return;
      tg.MainButton.setText(text);
    },
    show(text, onClick) {
      if (!tg?.MainButton) return;
      if (text) tg.MainButton.setText(text);
      tg.MainButton.setParams({
        color: '#00d4ff',
        text_color: '#05080f',
        is_visible: true,
        is_active: true
      });
      if (this._handler) tg.MainButton.offClick(this._handler);
      this._handler = onClick;
      tg.MainButton.onClick(this._handler);
    },
    hide() {
      if (!tg?.MainButton) return;
      if (this._handler) tg.MainButton.offClick(this._handler);
      this._handler = null;
      tg.MainButton.hide();
    },
    showLoader() {
      if (!tg?.MainButton) return;
      tg.MainButton.showProgress();
      tg.MainButton.disable();
    },
    hideLoader() {
      if (!tg?.MainButton) return;
      tg.MainButton.hideProgress();
      tg.MainButton.enable();
    }
  };

  const BackButton = {
    _listener: null,
    show(onClick) {
      if (!tg?.BackButton) return;
      if (this._listener) tg.BackButton.offClick(this._listener);
      this._listener = onClick;
      tg.BackButton.onClick(onClick);
      tg.BackButton.show();
    },
    hide() {
      if (!tg?.BackButton) return;
      if (this._listener) tg.BackButton.offClick(this._listener);
      this._listener = null;
      tg.BackButton.hide();
    }
  };

  const Haptic = {
    impact(style = 'light') {
      tg?.HapticFeedback?.impactOccurred(style);
    },
    notification(type = 'success') {
      tg?.HapticFeedback?.notificationOccurred(type);
    },
    selection() {
      tg?.HapticFeedback?.selectionChanged();
    }
  };

  function sendData(payload) {
    if (!tg?.sendData) return false;
    try {
      tg.sendData(JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('[TelegramService] sendData failed:', e);
      return false;
    }
  }

  function close() {
    tg?.close();
  }

  return {
    isAvailable,
    isTelegramUser,
    ready,
    getTelegramUser,
    MainButton,
    BackButton,
    Haptic,
    sendData,
    close
  };
})();

window.TelegramService = TelegramService;
