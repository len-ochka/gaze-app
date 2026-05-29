/**
 * Gaze Telegram Web App Service (v2.1)
 * Оптимизировано для высокой производительности и отказоустойчивости в TWA.
 */
const TelegramService = (() => {
  // Безопасное получение объекта WebApp с проверкой на наличие
  const tg = (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp)
    ? window.Telegram.WebApp
    : null;

  // Внутреннее состояние для управления обработчиками событий
  const _state = {
    mainButtonHandler: null,
    backButtonHandler: null,
    isInitialized: false
  };

  /**
   * Проверяет доступность Telegram WebApp API.
   */
  const isAvailable = () => {
    if (!tg) {
      console.warn('[TelegramService] Telegram WebApp API не обнаружен.');
      return false;
    }
    return true;
  };

  /**
   * Checks if the Telegram user data is present.
   */
  const isTelegramUser = () => !!(tg?.initDataUnsafe?.user);

  /**
   * Инициализирует WebApp, настраивает viewport и цвета темы.
   */
  function ready() {
    if (!isAvailable()) return;

    try {
      tg.ready();
      tg.expand();

      // Настройка цветов для эффекта glassmorphism
      const themeColor = '#080c14';
      if (tg.setHeaderColor) tg.setHeaderColor(themeColor);
      if (tg.setBackgroundColor) tg.setBackgroundColor(themeColor);

      _state.isInitialized = true;
      console.log('[TelegramService] WebApp готов и развернут.');
    } catch (e) {
      console.error('[TelegramService] Ошибка при вызове ready():', e);
    }
  }

  /**
   * Извлекает данные пользователя из initDataUnsafe.
   */
  function getTelegramUser() {
    if (!isTelegramUser()) {
      console.warn('[TelegramService] Данные пользователя Telegram отсутствуют.');
      return null;
    }

    const u = tg.initDataUnsafe.user;
    return {
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Пользователь',
      email: '',
      phone: '',
      address: '',
      tgId: u.id,
      tgUsername: u.username || null,
      language: u.language_code || 'ru'
    };
  }

  /**
   * Controls the Telegram Main Button.
   */
  const MainButton = {
    setText(text) {
      if (!tg?.MainButton) return;
      tg.MainButton.setText(text);
    },

    show(text, onClick) {
      if (!tg?.MainButton) return;

      // Cleanup previous listener to avoid multiple calls
      if (_state.mainButtonHandler) {
        tg.MainButton.offClick(_state.mainButtonHandler);
      }

      if (text) tg.MainButton.setText(text);
      tg.MainButton.setParams({
        color: '#00d4ff',
        text_color: '#080c14',
        is_visible: true,
        is_active: true
      });

      if (onClick) {
        _state.mainButtonHandler = onClick;
        tg.MainButton.onClick(onClick);
      }

      tg.MainButton.show();
    },

    hide() {
      if (!tg?.MainButton) return;
      if (_state.mainButtonHandler) {
        tg.MainButton.offClick(_state.mainButtonHandler);
        _state.mainButtonHandler = null;
      }
      tg.MainButton.hide();
    },

    setLoading(isLoading) {
      if (!tg?.MainButton) return;
      if (isLoading) {
        tg.MainButton.showProgress();
        tg.MainButton.disable();
      } else {
        tg.MainButton.hideProgress();
        tg.MainButton.enable();
      }
    }
  };

  /**
   * Controls the Telegram Back Button.
   */
  const BackButton = {
    show(onClick) {
      if (!tg?.BackButton) return;

      if (_state.backButtonHandler) {
        tg.BackButton.offClick(_state.backButtonHandler);
      }

      _state.backButtonHandler = onClick;
      tg.BackButton.onClick(onClick);
      tg.BackButton.show();
    },

    hide() {
      if (!tg?.BackButton) return;
      if (_state.backButtonHandler) {
        tg.BackButton.offClick(_state.backButtonHandler);
        _state.backButtonHandler = null;
      }
      tg.BackButton.hide();
    }
  };

  /**
   * Wrappers for Haptic Feedback.
   */
  const Haptic = {
    impact(style = 'light') {
      try { tg?.HapticFeedback?.impactOccurred(style); } catch(e) {}
    },
    notification(type = 'success') {
      try { tg?.HapticFeedback?.notificationOccurred(type); } catch(e) {}
    },
    selection() {
      try { tg?.HapticFeedback?.selectionChanged(); } catch(e) {}
    }
  };

  /**
   * Sending data back to the bot (only for keyboard-button launched apps).
   */
  function sendData(payload) {
    if (!tg?.sendData) return false;
    try {
      tg.sendData(JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error('[TelegramService] sendData failed:', e);
      return false;
    }
  }

  /**
   * Gets the raw initData for server-side validation.
   */
  function getInitData() {
    return tg?.initData || '';
  }

  /**
   * Closes the WebApp.
   */
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
    getInitData,
    close,
    // Expose raw WebApp object for advanced usage
    webApp: tg
  };
})();

window.TelegramService = TelegramService;
