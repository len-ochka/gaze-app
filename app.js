'use strict';

/**
 * Gaze Telegram Web App Service
 * Handles TWA lifecycle, haptics, buttons, and avatar fallbacks for RF regions.
 */
const TelegramService = (() => {
  const tg = (typeof window !== 'undefined' && window.Telegram?.WebApp)
    ? window.Telegram.WebApp
    : null;

  const _state = {
    mainButtonHandler: null,
    backButtonHandler: null,
    isInitialized: false
  };

  const isAvailable = () => !!tg;
  const isTelegramUser = () => !!(tg?.initDataUnsafe?.user);

  /**
   * Инициализация WebApp с expand и настройкой темы.
   */
  function ready() {
    if (!isAvailable()) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor)     tg.setHeaderColor('#080c14');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#080c14');
      _state.isInitialized = true;
    } catch (e) {
      console.error('[TelegramService] ready() error:', e);
    }
  }

  /**
   * Expand WebApp to full height.
   */
  function expand() {
    try { tg?.expand?.(); } catch {}
  }

  /**
   * Возвращает данные пользователя из initDataUnsafe.
   * Аватарки не используем напрямую — они блокируются в РФ через cdn5.telegram-cdn.org.
   */
  function getTelegramUser() {
    if (!isTelegramUser()) return null;
    const u = tg.initDataUnsafe.user;
    return {
      name:       [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Пользователь',
      email:      '',
      phone:      '',
      address:    '',
      tgId:       u.id,
      tgUsername: u.username || null,
      language:   u.language_code || 'ru'
    };
  }

  /**
   * Безопасная загрузка аватарки с fallback на инициалы.
   * Обходит блокировку cdn5.telegram-cdn.org в РФ.
   */
  function safeLoadAvatar(url, imgElement, fallbackText) {
    if (!imgElement) return;
    if (!url) { renderInitialsAvatar(imgElement, fallbackText); return; }

    const img = new Image();
    const timeout = setTimeout(() => { renderInitialsAvatar(imgElement, fallbackText); }, 3000);
    img.onload = () => {
      clearTimeout(timeout);
      imgElement.src = url;
      imgElement.style.display = 'block';
    };
    img.onerror = () => {
      clearTimeout(timeout);
      renderInitialsAvatar(imgElement, fallbackText);
    };
    img.src = url;
  }

  function renderInitialsAvatar(container, text) {
    if (!container) return;
    const initials = (text || 'П').split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase();
    container.textContent = initials;
  }

  // ─── MAIN BUTTON ──────────────────────────────────────────────────────────────
  const MainButton = {
    setText(text) {
      if (!tg?.MainButton) return;
      tg.MainButton.setText(text);
    },
    show(text, onClick) {
      if (!tg?.MainButton) return;
      if (_state.mainButtonHandler) tg.MainButton.offClick(_state.mainButtonHandler);
      if (text) tg.MainButton.setText(text);
      tg.MainButton.setParams({ color: '#00d4ff', text_color: '#080c14', is_visible: true, is_active: true });
      if (onClick) { _state.mainButtonHandler = onClick; tg.MainButton.onClick(onClick); }
      tg.MainButton.show();
    },
    hide() {
      if (!tg?.MainButton) return;
      if (_state.mainButtonHandler) { tg.MainButton.offClick(_state.mainButtonHandler); _state.mainButtonHandler = null; }
      tg.MainButton.hide();
    },
    setLoading(isLoading) {
      if (!tg?.MainButton) return;
      if (isLoading) { tg.MainButton.showProgress(); tg.MainButton.disable(); }
      else { tg.MainButton.hideProgress(); tg.MainButton.enable(); }
    }
  };

  // ─── BACK BUTTON ──────────────────────────────────────────────────────────────
  const BackButton = {
    show(onClick) {
      if (!tg?.BackButton) return;
      if (_state.backButtonHandler) tg.BackButton.offClick(_state.backButtonHandler);
      _state.backButtonHandler = onClick;
      tg.BackButton.onClick(onClick);
      tg.BackButton.show();
    },
    hide() {
      if (!tg?.BackButton) return;
      if (_state.backButtonHandler) { tg.BackButton.offClick(_state.backButtonHandler); _state.backButtonHandler = null; }
      tg.BackButton.hide();
    }
  };

  // ─── HAPTICS ──────────────────────────────────────────────────────────────────
  const Haptic = {
    impact(style = 'light') { try { tg?.HapticFeedback?.impactOccurred(style); } catch {} },
    notification(type = 'success') { try { tg?.HapticFeedback?.notificationOccurred(type); } catch {} },
    selection() { try { tg?.HapticFeedback?.selectionChanged(); } catch {} }
  };

  function sendData(payload) {
    if (!tg?.sendData) return false;
    try { tg.sendData(JSON.stringify(payload)); return true; } catch { return false; }
  }

  function getInitData() { return tg?.initData || ''; }
  function close() { tg?.close?.(); }

  return {
    isAvailable, isTelegramUser, ready, expand,
    getTelegramUser, safeLoadAvatar,
    MainButton, BackButton, Haptic,
    sendData, getInitData, close,
    webApp: tg
  };
})();

window.TelegramService = TelegramService;
