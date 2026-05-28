/**
 * Gaze Telegram Web App Service
 * Optimized for robustness and high-performance TWA integration.
 */
const TelegramService = (() => {
  const tg = window.Telegram?.WebApp ?? null;

  // Internal state to track listeners and avoid duplicates
  const _state = {
    mainButtonHandler: null,
    backButtonHandler: null,
  };

  /**
   * Checks if the app is running within the Telegram environment.
   */
  const isAvailable = () => !!tg;

  /**
   * Checks if the Telegram user data is present.
   */
  const isTelegramUser = () => !!(tg?.initDataUnsafe?.user);

  /**
   * Configures the WebApp viewport and theme colors.
   */
  function ready() {
    if (!tg) return;
    tg.ready();
    tg.expand();

    // Set theme colors for a seamless glassmorphism experience
    const themeColor = '#080c14';
    if (tg.setHeaderColor) tg.setHeaderColor(themeColor);
    if (tg.setBackgroundColor) tg.setBackgroundColor(themeColor);

    // Notify about ready state to debug logs
    console.log('[TelegramService] WebApp is ready and expanded.');
  }

  /**
   * Extracts user data from Telegram initDataUnsafe.
   */
  function getTelegramUser() {
    if (!isTelegramUser()) return null;
    const u = tg.initDataUnsafe.user;
    return {
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Пользователь',
      email: `tg_${u.id}@gaze.app`,
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
