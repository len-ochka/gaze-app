'use strict';

const App = (() => {

  // ── Состояние приложения ──────────────────────────────────────────────────
  const state = {
    currentScreen: 'auth',
    user: null,
    cart: [],
    constructor: {
      step: 1,
      cameraType: null,
      cameraCount: 1,
      soundRecord: false,
      motionDetect: false,
      result: null
    },
    deliveryType: 'courier',
    orderCount: 0
  };

  // ── Прайс-лист ────────────────────────────────────────────────────────────
  const PRICES = {
    camera_outdoor: 4900,
    camera_indoor: 2900,
    dvr_4ch: 8500,
    dvr_8ch: 14900,
    dvr_16ch: 24900,
    cable_per_meter: 28,
    poe_4port: 3200,
    poe_8port: 5900,
    poe_16port: 9800,
    hdd: 3500,
    mic: 890,
    courier_delivery: 500
  };

  // ── SVG-иконки ────────────────────────────────────────────────────────────
  const ICONS = {
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    server: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
    cable: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9l9-4 9 4"/><path d="M4 9v10l9 4 9-4V9"/><path d="M13 5v14"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    hdd: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`
  };

  function getIcon(name) {
    return ICONS[name] || ICONS.box;
  }

  // ── Haptic ────────────────────────────────────────────────────────────────
  function haptic(style) {
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(style || 'light');
    } catch (_) {}
  }

  // ── Storage helpers ───────────────────────────────────────────────────────
  function loadFromStorage() {
    try {
      const user = localStorage.getItem('gaze_user');
      if (user) state.user = JSON.parse(user);
    } catch (_) {}
    try {
      const cart = localStorage.getItem('gaze_cart');
      if (cart) state.cart = JSON.parse(cart);
    } catch (_) {}
    try {
      const orders = localStorage.getItem('gaze_orders');
      if (orders) state.orderCount = parseInt(orders, 10) || 0;
    } catch (_) {}
  }

  function saveUser() {
    if (state.user) localStorage.setItem('gaze_user', JSON.stringify(state.user));
  }

  function saveCart() {
    localStorage.setItem('gaze_cart', JSON.stringify(state.cart));
  }

  // ── Навигация ─────────────────────────────────────────────────────────────
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(s) {
      s.classList.remove('active');
    });
    const target = document.getElementById('screen-' + name);
    if (target) {
      target.classList.add('active');
      state.currentScreen = name;
    }

    // Нижняя навигация
    const nav = document.getElementById('bottom-nav');
    if (nav) {
      nav.style.display = (name === 'auth') ? 'none' : '';
    }

    // Активный пункт навигации
    document.querySelectorAll('.nav-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.screen === name);
    });

    // Рендер конкретного экрана
    if (name === 'profile') renderProfile();
    if (name === 'cart') renderCart();
    if (name === 'home') renderHome();
    if (name === 'constructor') {
      // При переходе в конструктор — показываем текущий шаг
      goToStep(state.constructor.step);
    }
  }

  // ── Инициализация ─────────────────────────────────────────────────────────
  function init() {
    loadFromStorage();

    // Проверяем Telegram WebApp
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      try { tg.ready(); tg.expand(); } catch (_) {}
      try { if (tg.setHeaderColor) tg.setHeaderColor('#080c14'); } catch (_) {}
      try { if (tg.setBackgroundColor) tg.setBackgroundColor('#080c14'); } catch (_) {}
      const u = tg.initDataUnsafe.user;
      state.user = {
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Пользователь',
        email: 'tg_' + u.id + '@telegram',
        phone: (state.user && state.user.phone) || '',
        address: (state.user && state.user.address) || '',
        tgId: u.id
      };
      saveUser();
      showScreen('home');
    } else {
      showScreen(state.user ? 'home' : 'auth');
    }

    bindNav();
    bindAuth();
    bindConstructor();
    bindProfile();
    bindCart();
    updateCartBadge();
  }

  // ── Навигация (привязка) ──────────────────────────────────────────────────
  function bindNav() {
    document.querySelectorAll('.nav-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        haptic('light');
        if (btn.dataset.screen) showScreen(btn.dataset.screen);
      });
    });

    // Кнопка корзины в шапке главной
    const homeCartBtn = document.getElementById('home-cart-btn');
    if (homeCartBtn) {
      homeCartBtn.addEventListener('click', function() {
        haptic('light');
        showScreen('cart');
      });
    }

    // Промо-карточка
    const promoCard = document.getElementById('promo-to-constructor');
    if (promoCard) {
      promoCard.addEventListener('click', function() {
        haptic('light');
        showScreen('constructor');
      });
    }

    // Кнопки готовых комплектов
    document.querySelectorAll('.kit-card-btn').forEach(function(card) {
      card.addEventListener('click', function() {
        haptic('light');
        showScreen('constructor');
      });
    });

    // Кнопка «Перейти в конструктор» из пустой корзины
    const goConstructor = document.getElementById('btn-go-constructor');
    if (goConstructor) {
      goConstructor.addEventListener('click', function() {
        haptic('light');
        showScreen('constructor');
      });
    }
  }

  // ── Авторизация ───────────────────────────────────────────────────────────
  function bindAuth() {
    // Переключение табов
    document.querySelectorAll('.auth-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        haptic('selection');
        document.querySelectorAll('.auth-tab').forEach(function(t) {
          t.classList.remove('active');
        });
        tab.classList.add('active');
        document.querySelectorAll('.form-panel').forEach(function(p) {
          p.classList.remove('active');
        });
        const panel = document.getElementById('panel-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });

    // Показать/скрыть пароль
    document.querySelectorAll('.password-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        haptic('light');
        const wrap = btn.closest('.password-input-wrap');
        if (!wrap) return;
        const input = wrap.querySelector('input');
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        const eye = btn.querySelector('.eye-icon');
        const eyeOff = btn.querySelector('.eye-off-icon');
        if (eye) eye.style.display = isPass ? 'none' : '';
        if (eyeOff) eyeOff.style.display = isPass ? '' : 'none';
      });
    });

    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    if (btnLogin) btnLogin.addEventListener('click', handleLogin);
    if (btnRegister) btnRegister.addEventListener('click', handleRegister);
  }

  function handleLogin() {
    haptic('medium');
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-pass');
    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const pass = passEl.value;
    clearErrors(['login-email', 'login-pass']);

    let valid = true;
    if (!isValidEmail(email)) { showFieldError('login-email', 'Введите корректный email'); valid = false; }
    if (pass.length < 6) { showFieldError('login-pass', 'Минимум 6 символов'); valid = false; }
    if (!valid) { haptic('error'); return; }

    const btn = document.getElementById('btn-login');
    setLoading(btn, true);

    setTimeout(function() {
      setLoading(btn, false);
      let accounts = {};
      try { accounts = JSON.parse(localStorage.getItem('gaze_accounts') || '{}'); } catch (_) {}
      if (!accounts[email] || accounts[email].pass !== btoa(pass)) {
        haptic('error');
        showFieldError('login-email', 'Неверный email или пароль');
        return;
      }
      haptic('success');
      state.user = accounts[email].user;
      saveUser();
      showScreen('home');
      showToast('Добро пожаловать!', 'success');
    }, 700);
  }

  function handleRegister() {
    haptic('medium');
    const nameEl = document.getElementById('reg-name');
    const emailEl = document.getElementById('reg-email');
    const passEl = document.getElementById('reg-pass');
    if (!nameEl || !emailEl || !passEl) return;

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const pass = passEl.value;
    clearErrors(['reg-name', 'reg-email', 'reg-pass']);

    let valid = true;
    if (name.length < 2) { showFieldError('reg-name', 'Введите ваше имя'); valid = false; }
    if (!isValidEmail(email)) { showFieldError('reg-email', 'Введите корректный email'); valid = false; }
    if (pass.length < 6) { showFieldError('reg-pass', 'Минимум 6 символов'); valid = false; }
    if (!valid) { haptic('error'); return; }

    const btn = document.getElementById('btn-register');
    setLoading(btn, true);

    setTimeout(function() {
      setLoading(btn, false);
      let accounts = {};
      try { accounts = JSON.parse(localStorage.getItem('gaze_accounts') || '{}'); } catch (_) {}
      if (accounts[email]) {
        haptic('error');
        showFieldError('reg-email', 'Аккаунт уже существует');
        return;
      }
      haptic('success');
      state.user = { name: name, email: email, phone: '', address: '' };
      accounts[email] = { pass: btoa(pass), user: state.user };
      localStorage.setItem('gaze_accounts', JSON.stringify(accounts));
      saveUser();
      showScreen('home');
      showToast('Аккаунт создан!', 'success');
    }, 800);
  }

  // ── Главная ───────────────────────────────────────────────────────────────
  function renderHome() {
    const nameEl = document.getElementById('home-username');
    if (nameEl && state.user && state.user.name) {
      nameEl.textContent = state.user.name.split(' ')[0] || 'Пользователь';
    }
    updateCartBadge();
  }

  // ── Конструктор ───────────────────────────────────────────────────────────
  function bindConstructor() {
    // Выбор типа камеры
    document.querySelectorAll('.camera-type-card').forEach(function(card) {
      card.addEventListener('click', function() {
        haptic('selection');
        document.querySelectorAll('.camera-type-card').forEach(function(c) {
          c.classList.remove('selected');
        });
        card.classList.add('selected');
        state.constructor.cameraType = card.dataset.type;
      });
    });

    // Счётчик камер
    const display = document.getElementById('camera-count-display');
    const minusBtn = document.getElementById('qty-minus');
    const plusBtn = document.getElementById('qty-plus');

    if (minusBtn) {
      minusBtn.addEventListener('click', function() {
        haptic('light');
        if (state.constructor.cameraCount > 1) {
          state.constructor.cameraCount--;
          if (display) display.textContent = state.constructor.cameraCount;
          updateQtyHints();
        }
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener('click', function() {
        haptic('light');
        if (state.constructor.cameraCount < 16) {
          state.constructor.cameraCount++;
          if (display) display.textContent = state.constructor.cameraCount;
          updateQtyHints();
        }
      });
    }

    document.querySelectorAll('.qty-hint').forEach(function(hint) {
      hint.addEventListener('click', function() {
        haptic('selection');
        state.constructor.cameraCount = parseInt(hint.dataset.val, 10);
        if (display) display.textContent = state.constructor.cameraCount;
        updateQtyHints();
      });
    });

    // Чекбоксы опций
    document.querySelectorAll('.option-checkbox').forEach(function(row) {
      row.addEventListener('click', function() {
        haptic('light');
        row.classList.toggle('checked');
        const key = row.dataset.option;
        if (key) state.constructor[key] = row.classList.contains('checked');
      });
    });

    // Кнопки шагов
    const step1Next = document.getElementById('btn-step1-next');
    const step2Back = document.getElementById('btn-step2-back');
    const step2Next = document.getElementById('btn-step2-next');
    const step3Back = document.getElementById('btn-step3-back');
    const step3Add = document.getElementById('btn-step3-add');
    const restartBtn = document.getElementById('btn-restart');

    if (step1Next) {
      step1Next.addEventListener('click', function() {
        haptic('medium');
        if (!state.constructor.cameraType) {
          showToast('Выберите тип камер', 'error');
          return;
        }
        goToStep(2);
      });
    }

    if (step2Back) step2Back.addEventListener('click', function() { haptic('light'); goToStep(1); });
    if (step2Next) {
      step2Next.addEventListener('click', function() {
        haptic('medium');
        buildCompatibility();
        goToStep(3);
      });
    }

    if (step3Back) step3Back.addEventListener('click', function() { haptic('light'); goToStep(2); });
    if (step3Add) {
      step3Add.addEventListener('click', function() {
        haptic('success');
        addKitToCart();
      });
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', function() {
        haptic('rigid');
        resetConstructor();
        goToStep(1);
      });
    }
  }

  function goToStep(n) {
    document.querySelectorAll('.constructor-step').forEach(function(s) {
      s.classList.remove('active');
    });
    const stepEl = document.getElementById('constructor-step-' + n);
    if (stepEl) stepEl.classList.add('active');
    state.constructor.step = n;

    document.querySelectorAll('.step-dot').forEach(function(dot, i) {
      dot.classList.remove('active', 'done');
      if (i + 1 === n) dot.classList.add('active');
      else if (i + 1 < n) dot.classList.add('done');
    });

    const scroll = document.getElementById('constructor-scroll');
    if (scroll) scroll.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateQtyHints() {
    document.querySelectorAll('.qty-hint').forEach(function(h) {
      h.classList.toggle('active', parseInt(h.dataset.val, 10) === state.constructor.cameraCount);
    });
  }

  function buildCompatibility() {
    const c = state.constructor;
    const items = [];

    const camPrice = c.cameraType === 'outdoor' ? PRICES.camera_outdoor : PRICES.camera_indoor;
    const camName = c.cameraType === 'outdoor' ? 'IP-камера уличная 4K' : 'IP-камера внутренняя FHD';
    const camSpec = c.cameraType === 'outdoor' ? 'Vandal-proof, IP67, ИК 40м, 8Мп' : 'ИК 20м, 2Мп, угол обзора 104°';
    items.push({ id: 'cam', icon: 'camera', name: camName, spec: camSpec, price: camPrice, qty: c.cameraCount });

    let dvrName, dvrPrice, dvrCh;
    if (c.cameraCount <= 4) { dvrCh = 4; dvrPrice = PRICES.dvr_4ch; dvrName = 'Видеорегистратор 4-канальный'; }
    else if (c.cameraCount <= 8) { dvrCh = 8; dvrPrice = PRICES.dvr_8ch; dvrName = 'Видеорегистратор 8-канальный'; }
    else { dvrCh = 16; dvrPrice = PRICES.dvr_16ch; dvrName = 'Видеорегистратор 16-канальный'; }
    items.push({ id: 'dvr', icon: 'server', name: dvrName, spec: dvrCh + ' каналов, H.265+, 4K, HDD до 8ТБ', price: dvrPrice, qty: 1 });

    const cableM = c.cameraCount * 20;
    items.push({ id: 'cable', icon: 'cable', name: 'Кабель витая пара UTP Cat5e', spec: cableM + 'м для ' + c.cameraCount + ' камер × 20м', price: Math.round(cableM * PRICES.cable_per_meter), qty: 1 });

    let poeName, poePrice;
    if (c.cameraCount <= 4) { poePrice = PRICES.poe_4port; poeName = 'PoE-коммутатор 4-портовый'; }
    else if (c.cameraCount <= 8) { poePrice = PRICES.poe_8port; poeName = 'PoE-коммутатор 8-портовый'; }
    else { poePrice = PRICES.poe_16port; poeName = 'PoE-коммутатор 16-портовый'; }
    items.push({ id: 'poe', icon: 'zap', name: poeName, spec: c.cameraCount + ' PoE-портов, 802.3af/at, до 30Вт/порт', price: poePrice, qty: 1 });

    items.push({ id: 'hdd', icon: 'hdd', name: 'HDD для видеонаблюдения 2ТБ', spec: 'WD Purple, 24/7, до 180МБ/с, 5400 RPM', price: PRICES.hdd, qty: 1 });

    if (c.soundRecord) {
      items.push({ id: 'mic', icon: 'mic', name: 'Микрофон для записи звука', spec: 'Всенаправленный, до 10м, 12V DC', price: PRICES.mic, qty: c.cameraCount > 4 ? 2 : 1 });
    }

    const total = items.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    state.constructor.result = { items: items, total: total };
    renderCompatResults(items, total);
  }

  function renderCompatResults(items, total) {
    const container = document.getElementById('compat-results');
    if (!container) return;

    container.innerHTML = items.map(function(item) {
      return '<div class="compat-card">' +
        '<div class="compat-card-icon">' + getIcon(item.icon) + '</div>' +
        '<div class="compat-card-body">' +
          '<div class="compat-card-name">' + item.name + '</div>' +
          '<div class="compat-card-spec">' + item.spec + '</div>' +
        '</div>' +
        '<div class="compat-card-right">' +
          '<div class="compat-price">' + fmtPrice(item.price * item.qty) + '</div>' +
          '<div class="compat-qty">' + item.qty + ' шт.</div>' +
        '</div>' +
      '</div>';
    }).join('');

    const summary = document.getElementById('compat-total');
    if (!summary) return;

    const c = state.constructor;
    summary.innerHTML =
      '<div class="total-row"><span class="total-label">Камер</span><span class="total-value">' + c.cameraCount + ' шт.</span></div>' +
      '<div class="total-row"><span class="total-label">Тип</span><span class="total-value">' + (c.cameraType === 'outdoor' ? 'Уличные' : 'Внутренние') + '</span></div>' +
      (c.soundRecord ? '<div class="total-row"><span class="total-label">Запись звука</span><span class="total-value text-green">✓ Включена</span></div>' : '') +
      (c.motionDetect ? '<div class="total-row"><span class="total-label">Детекция движения</span><span class="total-value text-green">✓ Включена</span></div>' : '') +
      '<div class="total-row total-final"><span class="total-label">Итого</span><span class="total-value">' + fmtPrice(total) + '</span></div>';
  }

  function addKitToCart() {
    const result = state.constructor.result;
    if (!result) return;

    // Удаляем предыдущие товары из конструктора
    state.cart = state.cart.filter(function(i) { return !i.isKit; });

    result.items.forEach(function(item) {
      state.cart.push({
        id: 'kit_' + item.id + '_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
        name: item.name,
        spec: item.spec,
        price: item.price,
        qty: item.qty,
        icon: item.icon,
        isKit: true
      });
    });

    saveCart();
    updateCartBadge();
    showToast('Комплект добавлен в корзину!', 'success');
    showScreen('cart');
  }

  function resetConstructor() {
    state.constructor = { step: 1, cameraType: null, cameraCount: 1, soundRecord: false, motionDetect: false, result: null };
    document.querySelectorAll('.camera-type-card').forEach(function(c) { c.classList.remove('selected'); });
    const display = document.getElementById('camera-count-display');
    if (display) display.textContent = '1';
    document.querySelectorAll('.option-checkbox').forEach(function(r) { r.classList.remove('checked'); });
    document.querySelectorAll('.qty-hint').forEach(function(h) { h.classList.remove('active'); });
  }

  // ── Корзина ───────────────────────────────────────────────────────────────
  function renderCart() {
    const cartContent = document.getElementById('cart-content');
    const cartEmpty = document.getElementById('cart-empty');
    const orderSuccess = document.getElementById('order-success');

    if (!cartContent || !cartEmpty) return;

    // Скрываем success-блок при открытии корзины с товарами
    if (state.cart.length > 0 && orderSuccess) {
      orderSuccess.classList.remove('show');
    }

    if (state.cart.length === 0) {
      cartContent.style.display = 'none';
      cartEmpty.style.display = '';
      if (orderSuccess) orderSuccess.classList.remove('show');
      return;
    }

    cartEmpty.style.display = 'none';
    cartContent.style.display = 'flex';

    const itemsEl = document.getElementById('cart-items');
    if (itemsEl) {
      itemsEl.innerHTML = state.cart.map(function(item) {
        return '<div class="cart-item" data-id="' + item.id + '">' +
          '<div class="cart-item-icon">' + getIcon(item.icon || 'box') + '</div>' +
          '<div class="cart-item-body">' +
            '<div class="cart-item-name">' + item.name + '</div>' +
            '<div class="cart-item-spec">' + item.spec + '</div>' +
          '</div>' +
          '<div class="cart-item-right">' +
            '<div class="cart-item-price">' + fmtPrice(item.price * item.qty) + '</div>' +
            '<div class="cart-qty-control">' +
              '<button class="cart-qty-btn" data-action="minus" data-id="' + item.id + '">−</button>' +
              '<span class="cart-qty-value">' + item.qty + '</span>' +
              '<button class="cart-qty-btn" data-action="plus" data-id="' + item.id + '">+</button>' +
            '</div>' +
            '<button class="cart-remove-btn" data-action="remove" data-id="' + item.id + '">' + getIcon('trash') + '</button>' +
          '</div>' +
        '</div>';
      }).join('');

      // Делегирование событий в корзине (без onclick в HTML)
      itemsEl.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'minus') changeItemQty(id, -1);
        else if (action === 'plus') changeItemQty(id, 1);
        else if (action === 'remove') removeCartItem(id);
      });
    }

    // Итоги
    const subtotal = state.cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    const delivery = state.deliveryType === 'courier' ? PRICES.courier_delivery : 0;

    const subtotalEl = document.getElementById('cart-subtotal');
    const deliveryCostEl = document.getElementById('cart-delivery-cost');
    const totalEl = document.getElementById('cart-total');

    if (subtotalEl) subtotalEl.textContent = fmtPrice(subtotal);
    if (deliveryCostEl) deliveryCostEl.textContent = delivery === 0 ? 'Бесплатно' : fmtPrice(delivery);
    if (totalEl) totalEl.textContent = fmtPrice(subtotal + delivery);
  }

  function bindCart() {
    // Выбор доставки
    document.querySelectorAll('.delivery-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        haptic('selection');
        document.querySelectorAll('.delivery-option').forEach(function(o) {
          o.classList.remove('selected');
        });
        opt.classList.add('selected');
        state.deliveryType = opt.dataset.type;
        renderCart();
      });
    });

    const checkoutBtn = document.getElementById('btn-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);

    const newOrderBtn = document.getElementById('btn-new-order');
    if (newOrderBtn) {
      newOrderBtn.addEventListener('click', function() {
        haptic('light');
        const successEl = document.getElementById('order-success');
        if (successEl) successEl.classList.remove('show');
        resetConstructor();
        showScreen('constructor');
      });
    }
  }

  function changeItemQty(id, delta) {
    haptic('light');
    const idx = state.cart.findIndex(function(i) { return i.id === id; });
    if (idx === -1) return;
    const next = state.cart[idx].qty + delta;
    if (next <= 0) {
      state.cart.splice(idx, 1);
    } else {
      state.cart[idx] = Object.assign({}, state.cart[idx], { qty: next });
    }
    saveCart();
    updateCartBadge();
    renderCart();
  }

  function removeCartItem(id) {
    haptic('rigid');
    state.cart = state.cart.filter(function(i) { return i.id !== id; });
    saveCart();
    updateCartBadge();
    renderCart();
  }

  function handleCheckout() {
    haptic('medium');
    if (state.cart.length === 0 || !state.user) return;

    if (!state.user.phone) {
      haptic('error');
      showToast('Укажите телефон в профиле', 'error');
      setTimeout(function() { showScreen('profile'); }, 1400);
      return;
    }

    const btn = document.getElementById('btn-checkout');
    setLoading(btn, true);

    const subtotal = state.cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
    const delivery = state.deliveryType === 'courier' ? PRICES.courier_delivery : 0;
    const orderId = generateId();

    const orderData = {
      order_id: orderId,
      user: state.user,
      items: state.cart,
      delivery: state.deliveryType,
      total: subtotal + delivery,
      timestamp: new Date().toISOString()
    };

    // Отправка в Telegram
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.sendData) tg.sendData(JSON.stringify(orderData));
    } catch (_) {}

    setTimeout(function() {
      haptic('success');
      setLoading(btn, false);
      state.orderCount++;
      localStorage.setItem('gaze_orders', String(state.orderCount));
      state.cart = [];
      saveCart();
      updateCartBadge();

      const idDisplay = document.getElementById('order-id-display');
      if (idDisplay) idDisplay.textContent = '#' + orderId;

      const cartContent = document.getElementById('cart-content');
      const cartEmpty = document.getElementById('cart-empty');
      const orderSuccess = document.getElementById('order-success');

      if (cartContent) cartContent.style.display = 'none';
      if (cartEmpty) cartEmpty.style.display = 'none';
      if (orderSuccess) orderSuccess.classList.add('show');
    }, 1500);
  }

  // ── Профиль ───────────────────────────────────────────────────────────────
  function renderProfile() {
    if (!state.user) return;
    const u = state.user;
    const initials = (u.name || 'П').split(' ').map(function(n) { return n[0] || ''; }).join('').substring(0, 2).toUpperCase();

    const set = function(id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('profile-initials', initials);
    set('profile-display-name', u.name || 'Пользователь');
    set('profile-display-email', u.email || '');
    set('profile-row-name', u.name || '—');
    set('profile-row-email', u.email || '—');
    set('profile-stat-orders', state.orderCount);

    const phoneEl = document.getElementById('profile-row-phone');
    if (phoneEl) {
      phoneEl.textContent = u.phone || 'Не указан';
      phoneEl.classList.toggle('placeholder', !u.phone);
    }

    const addrEl = document.getElementById('profile-row-address');
    if (addrEl) {
      addrEl.textContent = u.address || 'Не указан';
      addrEl.classList.toggle('placeholder', !u.address);
    }

    const editName = document.getElementById('edit-name');
    const editPhone = document.getElementById('edit-phone');
    const editAddress = document.getElementById('edit-address');
    if (editName) editName.value = u.name || '';
    if (editPhone) editPhone.value = u.phone || '';
    if (editAddress) editAddress.value = u.address || '';
  }

  function bindProfile() {
    const editProfileBtn = document.getElementById('btn-edit-profile');
    const editBackBtn = document.getElementById('btn-edit-back');
    const saveProfileBtn = document.getElementById('btn-save-profile');
    const logoutBtn = document.getElementById('btn-logout');

    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', function() {
        haptic('light');
        const mainView = document.getElementById('profile-main-view');
        const editView = document.getElementById('profile-edit-view');
        if (mainView) mainView.style.display = 'none';
        if (editView) editView.style.display = 'flex';
      });
    }

    if (editBackBtn) {
      editBackBtn.addEventListener('click', function() {
        haptic('light');
        const mainView = document.getElementById('profile-main-view');
        const editView = document.getElementById('profile-edit-view');
        if (mainView) mainView.style.display = '';
        if (editView) editView.style.display = 'none';
      });
    }

    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', function() {
        haptic('medium');
        const name = (document.getElementById('edit-name') || {}).value || '';
        const phone = (document.getElementById('edit-phone') || {}).value || '';
        const address = (document.getElementById('edit-address') || {}).value || '';

        if (name.trim().length < 2) {
          showToast('Введите корректное имя', 'error');
          return;
        }

        state.user.name = name.trim();
        state.user.phone = phone.trim();
        state.user.address = address.trim();
        saveUser();
        renderProfile();

        const mainView = document.getElementById('profile-main-view');
        const editView = document.getElementById('profile-edit-view');
        if (mainView) mainView.style.display = '';
        if (editView) editView.style.display = 'none';

        haptic('success');
        showToast('Профиль сохранён', 'success');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        haptic('rigid');
        state.user = null;
        state.cart = [];
        state.orderCount = 0;
        localStorage.removeItem('gaze_user');
        localStorage.removeItem('gaze_cart');
        localStorage.removeItem('gaze_orders');
        showScreen('auth');
        showToast('Вы вышли из аккаунта');
      });
    }
  }

  // ── Утилиты ───────────────────────────────────────────────────────────────
  function updateCartBadge() {
    const count = state.cart.reduce(function(s, i) { return s + i.qty; }, 0);
    document.querySelectorAll('.cart-badge').forEach(function(b) {
      b.textContent = count;
      b.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  function fmtPrice(n) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showFieldError(fieldId, msg) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('error');
    const wrap = field.closest('.input-group') || field.parentElement;
    let errEl = wrap.querySelector('.error-text');
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'error-text';
      wrap.appendChild(errEl);
    }
    errEl.textContent = msg;
  }

  function clearErrors(ids) {
    ids.forEach(function(id) {
      const field = document.getElementById(id);
      if (!field) return;
      field.classList.remove('error');
      const wrap = field.closest('.input-group') || field.parentElement;
      const errEl = wrap && wrap.querySelector('.error-text');
      if (errEl) errEl.remove();
    });
  }

  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.dataset.orig = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span>';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.orig || '';
      btn.disabled = false;
    }
  }

  let _toastTimer = null;
  function showToast(msg, type) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2800);
  }

  function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init: init
  };

})();

// Регистрируем в глобальной области видимости и запускаем
window.App = App;

document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
