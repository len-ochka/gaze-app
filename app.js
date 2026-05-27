'use strict';

// ─── ПРАЙС-ЛИСТ ───────────────────────────────────────────────────────────────
const PRICES = {
  // Камеры
  cam_budget:    1490,   // Бюджетная камера 1МП
  cam_standard:  2900,   // Стандартная 2МП
  cam_premium:   5900,   // Премиум 4K/8МП

  // Регистраторы
  dvr_budget_4:  4900,
  dvr_budget_8:  7900,
  dvr_standard_4: 8500,
  dvr_standard_8: 14900,
  dvr_standard_16: 24900,
  dvr_premium_4:  14900,
  dvr_premium_8:  24900,
  dvr_premium_16: 39900,

  // Кабель за метр
  cable_budget:   18,    // UTP Cat5e
  cable_standard: 28,    // UTP Cat5e экранированный
  cable_premium:  55,    // Коаксиал RG59 + питание

  // PoE коммутаторы
  poe_budget_4:   1900,
  poe_budget_8:   3200,
  poe_standard_4: 3200,
  poe_standard_8: 5900,
  poe_premium_4:  5900,
  poe_premium_8:  9800,
  poe_premium_16: 16900,

  // HDD
  hdd_budget:  2500,   // 1ТБ
  hdd_standard: 3500,  // 2ТБ
  hdd_premium: 6500,   // 4ТБ

  // Монтаж (за точку) - Московские цены 2026
  install_budget:   2500,   // Базовый (внутренние)
  install_standard: 3500,   // Стандартный (уличные до 3м)
  install_premium:  4500,   // Высотный/Сложный (>3м)

  install_nvr: 3000,        // Монтаж и настройка NVR
  setup_remote: 1500,       // Удаленный доступ

  // Дополнительно
  cable_work: 100,          // Прокладка кабеля за метр
  mic: 1200,
  courier: 1000
};

// ─── ПАКЕТЫ ───────────────────────────────────────────────────────────────────
const PACKAGES = {
  budget: {
    id: 'budget',
    name: '💚 Эконом',
    badge: 'БЮДЖЕТНЫЙ',
    desc: 'Базовая защита для небольших объектов. Надёжное оборудование Chinese OEM.',
    cam: 'cam_budget', dvr_prefix: 'dvr_budget', cable: 'cable_budget',
    poe_prefix: 'poe_budget', hdd: 'hdd_budget', install: 'install_budget',
    camName: 'IP-камера 1МП AHD', camSpec: 'ИК 20м, угол 90°, IP66',
    resolution: '720p (1МП)',
    color: '#00ff94'
  },
  standard: {
    id: 'standard',
    name: '🔵 Стандарт',
    badge: 'ПОПУЛЯРНЫЙ',
    desc: 'Оптимальное соотношение цены и качества. Оборудование Hikvision/Dahua.',
    cam: 'cam_standard', dvr_prefix: 'dvr_standard', cable: 'cable_standard',
    poe_prefix: 'poe_standard', hdd: 'hdd_standard', install: 'install_standard',
    camName: 'IP-камера 2МП FullHD', camSpec: 'ИК 40м, угол 104°, IP67, WDR',
    resolution: '1080p (2МП)',
    color: '#00d4ff'
  },
  premium: {
    id: 'premium',
    name: '🟡 Премиум',
    badge: 'ПРОФЕССИОНАЛЬНЫЙ',
    desc: 'Максимальное качество для серьёзных объектов. Hikvision Pro / Axis.',
    cam: 'cam_premium', dvr_prefix: 'dvr_premium', cable: 'cable_premium',
    poe_prefix: 'poe_premium', hdd: 'hdd_premium', install: 'install_premium',
    camName: 'IP-камера 4K 8МП', camSpec: 'ИК 60м, угол 110°, IP68, AI-аналитика',
    resolution: '4K (8МП)',
    color: '#ffd700'
  }
};

// ─── СОСТОЯНИЕ ────────────────────────────────────────────────────────────────
const state = {
  screen: 'auth',
  user: null,
  orderCount: 0,
  calc: {
    area: 0,
    cameraType: null,   // outdoor / indoor / mixed
    package: null,      // budget / standard / premium
    soundRecord: false,
    motionDetect: false,
    result: null
  },
  cart: [],
  delivery: 'courier'
};

// ─── УТИЛИТЫ ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function $(id) { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function haptic(s) {
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(s || 'light'); } catch (_) {}
}

let _toastTimer;
function toast(msg, type) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '') + ' show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function setLoading(btn, on) {
  if (!btn) return;
  if (on) { btn.dataset.orig = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.orig || ''; btn.disabled = false; }
}

function isEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function fieldErr(id, msg) {
  const el = $(id); if (!el) return;
  el.classList.add('error');
  const wrap = el.closest('.input-group') || el.parentElement;
  let e = wrap.querySelector('.error-text');
  if (!e) { e = document.createElement('span'); e.className = 'error-text'; wrap.appendChild(e); }
  e.textContent = msg;
}

function clearErr(ids) {
  ids.forEach(id => {
    const el = $(id); if (!el) return;
    el.classList.remove('error');
    const wrap = el.closest('.input-group') || el.parentElement;
    wrap?.querySelector('.error-text')?.remove();
  });
}

// ─── РАСЧЁТ КАМЕР ПО ПЛОЩАДИ ─────────────────────────────────────────────────
function calcCamerasForArea(area, type) {
  let count;
  if (type === 'outdoor') {
    const perimeter = 4 * Math.sqrt(area);
    count = Math.ceil(perimeter / 15);
  } else {
    count = Math.ceil(area / 20);
  }
  return Math.min(16, Math.max(2, count));
}

function calcCableForArea(area, camCount, type) {
  const avgDist = Math.ceil(Math.sqrt(area) / 2 * 1.3);
  return avgDist * camCount + 10;
}

function getDvrKey(pkg, count) {
  if (count <= 4) return pkg.dvr_prefix + '_4';
  if (count <= 8) return pkg.dvr_prefix + '_8';
  return pkg.dvr_prefix + '_16';
}

function getPoeKey(pkg, count) {
  if (count <= 4) return pkg.poe_prefix + '_4';
  if (count <= 8) return pkg.poe_prefix + '_8';
  return pkg.poe_prefix + '_16';
}

function buildSpec(pkg, area, camType, opts) {
  const camCount = calcCamerasForArea(area, camType);
  const cableM = calcCableForArea(area, camCount, camType);
  const dvrKey = getDvrKey(pkg, camCount);
  const poeKey = getPoeKey(pkg, camCount);

  const camTotal = PRICES[pkg.cam] * camCount;
  const dvrTotal = PRICES[dvrKey] || 0;
  const cableTotal = Math.round(cableM * PRICES[pkg.cable]);
  const poeTotal = PRICES[poeKey] || 0;
  const hddTotal = PRICES[pkg.hdd];
  const micTotal = opts.soundRecord ? PRICES.mic * (camCount <= 4 ? 1 : 2) : 0;

  // Labor calculation with Moscow rates & margin
  const baseInstall = PRICES[pkg.install] * camCount;
  const nvrInstall = PRICES.install_nvr;
  const remoteSetup = PRICES.setup_remote;
  const cableWork = cableM * PRICES.cable_work;

  let laborTotal = baseInstall + nvrInstall + remoteSetup + cableWork;

  // Apply 8% marketing margin on labor
  laborTotal = Math.round(laborTotal * 1.08 / 100) * 100; // Round to nearest 100

  const equipment = camTotal + dvrTotal + cableTotal + poeTotal + hddTotal + micTotal;
  let total = equipment + laborTotal;

  // VIP Discount: 5% off if 3+ orders
  if (state.orderCount >= 3) {
    total = Math.round(total * 0.95);
  }

  const chCount = camCount <= 4 ? '4-канальный' : camCount <= 8 ? '8-канальный' : '16-канальный';

  const items = [
    { name: pkg.camName, spec: pkg.camSpec + ', ' + pkg.resolution, price: camTotal, qty: camCount, icon: '📷' },
    { name: 'Видеорегистратор ' + chCount, spec: 'H.265+, запись 24/7, удалённый доступ', price: dvrTotal, qty: 1, icon: '🖥️' },
    { name: 'Кабель витая пара', spec: cableM + 'м (расчёт по площади ' + area + 'м²)', price: cableTotal, qty: 1, icon: '🔌' },
    { name: 'PoE-коммутатор ' + chCount.replace('Видеорегистратор ', ''), spec: '802.3af/at, до 30Вт/порт', price: poeTotal, qty: 1, icon: '⚡' },
    { name: 'HDD для видеонаблюдения', spec: pkg.id === 'budget' ? '1ТБ — ~7 суток записи' : pkg.id === 'standard' ? '2ТБ — ~14 суток записи' : '4ТБ — ~30 суток записи', price: hddTotal, qty: 1, icon: '💾' },
  ];
  if (opts.soundRecord) items.push({ name: 'Микрофон всенаправленный', spec: 'до 10м, шумоподавление', price: micTotal, qty: camCount <= 4 ? 1 : 2, icon: '🎤' });
  items.push({ name: 'Монтаж и настройка системы', spec: camCount + ' точек + NVR + кабель', price: laborTotal, qty: 1, icon: '🔧' });

  return { items, equipment, laborTotal, total, camCount, cableM, pkg };
}

// ─── ОФОРМЛЕНИЕ ЗАКАЗА ────────────────────────────────────────────────────────
async function doOrder() {
  if (!state.user) { toast('Войдите в аккаунт', 'error'); return; }
  if (!state.user.phone) {
    haptic('error');
    toast('Укажите телефон в профиле для связи', 'error');
    setTimeout(() => showScreen('profile'), 1500);
    return;
  }

  const btn = $('btn-calc3-order');
  setLoading(btn, true);

  const orderId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const orderData = {
    id: orderId,
    area: state.calc.area,
    camera_type: state.calc.cameraType,
    package_id: state.calc.package,
    options: { soundRecord: state.calc.soundRecord, motionDetect: state.calc.motionDetect },
    spec: state.calc.result,
    total_price: state.calc.result.total
  };

  try {
    await StorageService.submitOrder(orderData);
    haptic('success');
    setLoading(btn, false);
    state.orderCount = StorageService.getOrderCount();

    if (state.orderCount > 0) {
        $('nav-support').style.display = 'flex';
    }

    // Показываем экран успеха
    $('order-id-display').textContent = '#' + orderId;
    $('order-success').classList.add('show');
    $$('.calc-step').forEach(s => s.classList.remove('active'));

  } catch (err) {
    haptic('error');
    setLoading(btn, false);
    toast('Ошибка отправки: ' + err.message, 'error');
    console.error('Order error:', err);
  }
}

// ─── YANDEX MAPS ──────────────────────────────────────────────────────────────
let myMap;
let selectedAddress = '';

function openFullMap() {
  const modal = $('full-map-view');
  if (modal) modal.style.display = 'block';
  haptic('light');

  if (!window.ymaps) return;
  window.ymaps.ready(() => {
    if (myMap) {
      myMap.container.fitToViewport();
      return;
    }
    myMap = new ymaps.Map("big-map", {
      center: [55.76, 37.64],
      zoom: 11,
      controls: ['zoomControl', 'geolocationControl']
    });

    myMap.events.add('click', function (e) {
      const coords = e.get('coords');
      myMap.geoObjects.removeAll();
      myMap.geoObjects.add(new ymaps.Placemark(coords));
      getAddress(coords);
    });
  });
}

function getAddress(coords) {
  ymaps.geocode(coords).then(function (res) {
    const firstGeoObject = res.geoObjects.get(0);
    if (!firstGeoObject) {
        selectedAddress = '';
        if ($('map-selection-info')) $('map-selection-info').textContent = 'Адрес не найден';
        return;
    }

    // Yandex check for address precision
    const precision = firstGeoObject.properties.get('metaDataProperty.GeocoderMetaData.precision');
    if (precision === 'other' || precision === 'country') {
        toast('Слишком неточный адрес. Выберите здание.', 'error');
        selectedAddress = '';
        if ($('map-selection-info')) $('map-selection-info').textContent = 'Выберите точный адрес (дом/строение)';
        return;
    }

    selectedAddress = firstGeoObject.getAddressLine();
    const info = $('map-selection-info');
    if (info) info.textContent = selectedAddress;
  });
}

async function validateManualAddress(addr) {
    if (!addr || addr.length < 5) return false;
    try {
        const res = await ymaps.geocode(addr);
        const obj = res.geoObjects.get(0);
        if (!obj) return false;
        const precision = obj.properties.get('metaDataProperty.GeocoderMetaData.precision');
        // Valid if exact house or street (street might be okay but house is better)
        return ['exact', 'number', 'near', 'range'].includes(precision);
    } catch (e) {
        return false;
    }
}

function closeFullMap() {
  const modal = $('full-map-view');
  if (modal) modal.style.display = 'none';
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
async function renderAdmin() {
  if (state.user?.role !== 'admin') {
    showScreen('home');
    return;
  }
  try {
    const orders = await StorageService.apiRequest('/admin/orders');
    const logs = await StorageService.apiRequest('/admin/logs');
    const prices = await StorageService.getPrices();

    $('admin-prices-list').innerHTML = Object.entries(prices).map(([key, val]) => `
      <div class="admin-price-row" style="display:flex; justify-content:space-between; margin-bottom:8px; background:var(--bg-card); padding:10px; border-radius:8px;">
        <span style="font-size:14px;">${key}</span>
        <input type="number" value="${val}" onchange="updatePrice('${key}', this.value)" style="width:80px; background:transparent; color:white; border:1px solid var(--glass-border); border-radius:4px; text-align:right;">
      </div>
    `).join('');

    $('admin-orders-list').innerHTML = orders.map(o => `
      <div class="admin-order-card" style="background:var(--bg-card); padding:12px; border-radius:12px; margin-bottom:10px; border-left:4px solid ${o.status === 'pending' ? 'var(--accent)' : 'var(--accent-2)'}">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span style="font-weight:bold;">#${o.id}</span>
          <span style="font-size:12px; color:var(--text-muted);">${new Date(o.created_at).toLocaleDateString()}</span>
        </div>
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${o.full_name || 'Anonymous'} - ${fmt(o.total_price)}</div>
        <button onclick="blockUser(${o.user_id})" style="font-size:10px; padding:4px 8px; border-radius:4px; background:#ff4d4d; border:none; color:white; cursor:pointer;">Block User</button>
      </div>
    `).join('');

    $('admin-logs-list').innerHTML = logs.map(l => `
      <div class="admin-log-row" style="font-size:12px; color:${l.level === 'error' ? '#ff4d4d' : 'var(--text-secondary)'}; margin-bottom:4px; padding:4px; border-bottom:1px solid var(--glass-border);">
        [${new Date(l.created_at).toLocaleTimeString()}] ${l.message}
      </div>
    `).join('');
  } catch (e) {
    toast('Ошибка загрузки админки: ' + e.message, 'error');
  }
}

window.updatePrice = async (key, val) => {
  try {
    await StorageService.apiRequest('/admin/prices', 'POST', { key, value: parseInt(val) });
    toast('Цена обновлена', 'success');
  } catch (e) {
    toast('Ошибка обновления: ' + e.message, 'error');
  }
};

window.blockUser = async (userId) => {
  const reason = prompt('Reason for blocking?');
  if (!reason) return;
  try {
    await StorageService.apiRequest('/admin/users/block', 'POST', { userId, reason });
    toast('User blocked', 'success');
  } catch (e) {
    toast('Error blocking user: ' + e.message, 'error');
  }
};

// ─── SUPPORT ──────────────────────────────────────────────────────────────────
let supportInterval;
async function renderSupport() {
  if (state.orderCount === 0) {
    $('support-chat-messages').innerHTML = '<div class="chat-msg system" style="text-align:center; color:var(--text-muted);">Чат поддержки станет доступен после вашего первого заказа.</div>';
    $('support-input').disabled = true;
    $('btn-send-support').disabled = true;
    return;
  }

  $('support-input').disabled = false;
  $('btn-send-support').disabled = false;

  try {
    const messages = await StorageService.apiRequest('/chat');
    $('support-chat-messages').innerHTML = messages.map(m => `
      <div class="chat-msg ${m.sender}" style="align-self: ${m.sender === 'user' ? 'flex-end' : 'flex-start'}; background: ${m.sender === 'user' ? 'var(--accent)' : 'var(--bg-card)'}; color: ${m.sender === 'user' ? 'var(--bg-primary)' : 'white'}; padding: 8px 12px; border-radius: 12px; max-width: 80%; margin-bottom: 10px;">
        ${m.text}
      </div>
    `).join('');
    $('support-chat-messages').scrollTo({ top: $('support-chat-messages').scrollHeight });
  } catch (e) {
    console.error('Failed to load chat', e);
  }

  clearInterval(supportInterval);
  supportInterval = setInterval(async () => {
    if (state.screen === 'support') {
      const messages = await StorageService.apiRequest('/chat');
      const currentCount = $('support-chat-messages').children.length;
      if (messages.length > currentCount) {
        renderSupport();
      }
    }
  }, 5000);
}

function bindSupport() {
  $('btn-send-support')?.addEventListener('click', async () => {
    const inp = $('support-input');
    const msg = inp.value.trim();
    if (!msg) return;
    haptic('light');
    inp.value = '';

    try {
      await StorageService.apiRequest('/chat', 'POST', { text: msg });
      renderSupport();
    } catch (e) {
      toast('Ошибка отправки: ' + e.message, 'error');
    }
  });
}

// ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────────────
async function init() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor) tg.setHeaderColor('#080c14');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#080c14');
  }

  // Синхронизация с бэкендом
  try {
    state.user = await StorageService.syncUser();
    state.orderCount = StorageService.getOrderCount();

    // Загрузка актуальных цен
    const remotePrices = await StorageService.getPrices();
    Object.assign(PRICES, remotePrices);
  } catch (e) {
    console.error('Init sync failed', e);
  }

  bindAll();

  if (state.user?.role === 'admin') {
    const navAdmin = $('nav-admin');
    if (navAdmin) navAdmin.style.display = 'flex';
  }
  if (state.orderCount > 0) {
    const navSupport = $('nav-support');
    if (navSupport) navSupport.style.display = 'flex';
  }

  const hasSeenLanding = localStorage.getItem('gaze_seen_landing');
  if (!hasSeenLanding) {
    showScreen('landing');
  } else {
    showScreen(state.user ? 'home' : 'auth');
  }
}

// ─── НАВИГАЦИЯ ────────────────────────────────────────────────────────────────
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const t = $('screen-' + name);
  if (t) t.classList.add('active');
  state.screen = name;

  const nav = $('bottom-nav');
  if (nav) nav.style.display = (name === 'auth' || name === 'landing') ? 'none' : '';

  $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.screen === name));

  if (name === 'home') renderHome();
  if (name === 'profile') renderProfile();
  if (name === 'calculator') renderCalcStep(1);
  if (name === 'admin') renderAdmin();
  if (name === 'support') renderSupport();
}

// ─── АВТОРИЗАЦИЯ ──────────────────────────────────────────────────────────────
function bindAuth() {
  $$('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      haptic();
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.form-panel').forEach(p => p.classList.remove('active'));
      $('panel-' + tab.dataset.tab)?.classList.add('active');
    });
  });

  $$('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      haptic();
      const inp = btn.closest('.password-input-wrap')?.querySelector('input');
      if (!inp) return;
      const isPass = inp.type === 'password';
      inp.type = isPass ? 'text' : 'password';
      btn.querySelector('.eye-icon').style.display = isPass ? 'none' : '';
      btn.querySelector('.eye-off-icon').style.display = isPass ? '' : 'none';
    });
  });

  $('btn-login')?.addEventListener('click', () => toast('Используйте Telegram для входа'));
  $('btn-register')?.addEventListener('click', () => toast('Используйте Telegram для входа'));
}

// ─── ГЛАВНАЯ ──────────────────────────────────────────────────────────────────
function renderHome() {
  const nameEl = $('home-username');
  if (nameEl && state.user?.full_name) nameEl.textContent = state.user.full_name.split(' ')[0];
}

// ─── КАЛЬКУЛЯТОР (3 шага) ─────────────────────────────────────────────────────
let calcStep = 1;

function renderCalcStep(n) {
  calcStep = n;
  $$('.calc-step').forEach(s => s.classList.remove('active'));
  $('calc-step-' + n)?.classList.add('active');
  $$('.step-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i + 1 === n) dot.classList.add('active');
    else if (i + 1 < n) dot.classList.add('done');
  });
  $('calc-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindCalculator() {
  $$('.cam-type-card').forEach(card => {
    card.addEventListener('click', () => {
      haptic('selection');
      $$('.cam-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.calc.cameraType = card.dataset.type;
    });
  });

  $$('.area-hint').forEach(h => {
    h.addEventListener('click', () => {
      haptic('light');
      const areaInput = $('area-input');
      if (areaInput) { areaInput.value = h.dataset.val; state.calc.area = parseInt(h.dataset.val); }
      $$('.area-hint').forEach(x => x.classList.remove('active'));
      h.classList.add('active');
    });
  });

  $('area-input')?.addEventListener('input', (e) => {
    state.calc.area = parseInt(e.target.value) || 0;
    $$('.area-hint').forEach(h => h.classList.toggle('active', h.dataset.val === e.target.value));
  });

  $('btn-calc1-next')?.addEventListener('click', () => {
    haptic('medium');
    state.calc.area = parseInt($('area-input')?.value) || 0;
    if (state.calc.area < 10) { toast('Укажите площадь (минимум 10 м²)', 'error'); return; }
    if (!state.calc.cameraType) { toast('Выберите тип размещения камер', 'error'); return; }
    renderCalcStep(2);
  });

  $$('.pkg-card').forEach(card => {
    card.addEventListener('click', () => {
      haptic('medium');
      $$('.pkg-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.calc.package = card.dataset.pkg;
      renderPackagePreview(card.dataset.pkg);
    });
  });

  $$('.option-checkbox').forEach(row => {
    row.addEventListener('click', () => {
      haptic('light');
      row.classList.toggle('checked');
      const key = row.dataset.option;
      if (key) state.calc[key] = row.classList.contains('checked');
    });
  });

  $('btn-calc2-back')?.addEventListener('click', () => { haptic('light'); renderCalcStep(1); });
  $('btn-calc2-next')?.addEventListener('click', () => {
    haptic('medium');
    if (!state.calc.package) { toast('Выберите пакет', 'error'); return; }
    buildAndShowResult();
    renderCalcStep(3);
  });

  $('btn-calc3-back')?.addEventListener('click', () => { haptic('light'); renderCalcStep(2); });
  $('btn-calc3-order')?.addEventListener('click', () => { haptic('success'); doOrder(); });
}

function renderPackagePreview(pkgId) {
  const pkg = PACKAGES[pkgId];
  if (!pkg || !state.calc.area) return;
  const camCount = calcCamerasForArea(state.calc.area, state.calc.cameraType);
  const cableM = calcCableForArea(state.calc.area, camCount, state.calc.cameraType);
  const preview = $('pkg-preview');
  if (preview) {
    preview.innerHTML = `<div style="font-size:13px;color:var(--text-secondary);background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:12px 16px;margin-top:12px;">
      📐 Площадь <b>${state.calc.area} м²</b> → расчётно <b>${camCount} камеры</b>, кабель ~<b>${cableM} м</b>
    </div>`;
  }
}

function buildAndShowResult() {
  const pkg = PACKAGES[state.calc.package];
  const spec = buildSpec(pkg, state.calc.area, state.calc.cameraType, {
    soundRecord: state.calc.soundRecord,
    motionDetect: state.calc.motionDetect
  });
  state.calc.result = spec;

  const container = $('result-items');
  if (container) {
    container.innerHTML = spec.items.map(i =>
      `<div class="compat-card">
        <div class="compat-card-icon" style="font-size:20px;background:none;">${i.icon}</div>
        <div class="compat-card-body">
          <div class="compat-card-name">${i.name}</div>
          <div class="compat-card-spec">${i.spec}</div>
        </div>
        <div class="compat-card-right">
          <div class="compat-price">${fmt(i.price)}</div>
          <div class="compat-qty">${i.qty} шт.</div>
        </div>
      </div>`
    ).join('');
  }

  const summary = $('result-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="total-row"><span class="total-label">📷 Камер</span><span class="total-value">${spec.camCount} шт.</span></div>
      <div class="total-row"><span class="total-label">🔌 Кабель</span><span class="total-value">~${spec.cableM} м</span></div>
      <div class="total-row"><span class="total-label">📦 Пакет</span><span class="total-value">${pkg.name}</span></div>
      <div class="total-row"><span class="total-label">🔧 Работы</span><span class="total-value">${fmt(spec.laborTotal)}</span></div>
      <div class="total-row total-final">
        <span class="total-label">💰 ИТОГО</span>
        <span class="total-value">${fmt(spec.total)}${state.orderCount >= 3 ? ' <span style="font-size:12px;color:var(--accent);">(VIP -5%)</span>' : ''}</span>
      </div>`;
  }
}

// ─── ПРОФИЛЬ ─────────────────────────────────────────────────────────────────
function renderProfile() {
  if (!state.user) return;
  const u = state.user;
  const initials = (u.full_name || 'П').split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase();

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('profile-initials', initials);
  set('profile-display-name', u.full_name || 'Пользователь');
  set('profile-display-email', u.email || '');
  set('profile-row-name', u.full_name || '—');
  set('profile-row-email', u.email || '—');
  set('profile-stat-orders', state.orderCount);

  // VIP Status Logic
  const vipBadge = $('vip-badge');
  const clientStatus = $('profile-client-status');
  if (vipBadge) {
    if (state.orderCount >= 3) {
      vipBadge.style.display = 'inline-block';
      vipBadge.textContent = '💎 VIP';
      vipBadge.title = 'Premium функции активированы: Приоритетная поддержка, -5% на монтаж';
      if (clientStatus) clientStatus.textContent = 'GAZE Pro';
    } else {
      vipBadge.style.display = 'none';
      if (clientStatus) clientStatus.textContent = 'Базовый';
    }
  }

  const phoneEl = $('profile-row-phone');
  if (phoneEl) { phoneEl.textContent = u.phone || 'Не указан'; phoneEl.classList.toggle('placeholder', !u.phone); }

  const addrEl = $('profile-row-address');
  if (addrEl) { addrEl.textContent = u.address || 'Не указан'; addrEl.classList.toggle('placeholder', !u.address); }

  const editName = $('edit-name'); if (editName) editName.value = u.full_name || '';
  const editPhone = $('edit-phone'); if (editPhone) editPhone.value = u.phone || '';
  const editAddr = $('edit-address'); if (editAddr) editAddr.value = u.address || '';
}

function bindProfile() {
  $('btn-edit-profile')?.addEventListener('click', () => {
    haptic();
    $('profile-main-view').style.display = 'none';
    $('profile-edit-view').style.display = 'flex';
  });
  $('btn-edit-back')?.addEventListener('click', () => {
    haptic(); $('profile-main-view').style.display = ''; $('profile-edit-view').style.display = 'none';
  });
  $('btn-save-profile')?.addEventListener('click', async () => {
    haptic('medium');
    clearErr(['edit-name', 'edit-phone', 'edit-address']);

    const name = $('edit-name')?.value.trim();
    const phone = $('edit-phone')?.value.trim();
    const address = $('edit-address')?.value.trim();

    if (name?.length < 2) {
        fieldErr('edit-name', 'Введите корректное имя');
        return;
    }

    // RU Phone Validation
    const phoneRegex = /^((\+7|7|8)+([0-9]){10})$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        fieldErr('edit-phone', 'Введите корректный номер российского оператора (+7... или 8...)');
        return;
    }

    // Address Validation
    setLoading($('btn-save-profile'), true);
    const isAddrValid = await validateManualAddress(address);
    if (!isAddrValid) {
        setLoading($('btn-save-profile'), false);
        fieldErr('edit-address', 'Такого адреса не существует, проверьте правильность ввода');
        return;
    }

    const profileData = {
      full_name: name,
      phone: phone,
      address: address,
      email: state.user.email
    };

    try {
      state.user = await StorageService.updateUserProfile(profileData);
      renderProfile();
      $('profile-main-view').style.display = ''; $('profile-edit-view').style.display = 'none';
      haptic('success'); toast('Профиль сохранён', 'success');
    } catch (e) {
      toast('Ошибка сохранения: ' + e.message, 'error');
    } finally {
        setLoading($('btn-save-profile'), false);
    }
  });
  $('btn-logout')?.addEventListener('click', () => {
    haptic('rigid');
    state.user = null; state.orderCount = 0;
    StorageService.clearSession();
    showScreen('auth'); toast('Вы вышли из аккаунта');
  });
}

// ─── ПРИВЯЗКА ВСЕХ ОБРАБОТЧИКОВ ──────────────────────────────────────────────
function bindAll() {
  bindAuth();
  bindCalculator();
  bindProfile();
  bindSupport();

  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      haptic('light');
      if (btn.dataset.screen) showScreen(btn.dataset.screen);
    });
  });

  $('promo-to-calc')?.addEventListener('click', () => { haptic(); showScreen('calculator'); });

  $('btn-landing-start')?.addEventListener('click', () => {
    haptic();
    localStorage.setItem('gaze_seen_landing', 'true');
    showScreen(state.user ? 'home' : 'auth');
  });

  $('btn-show-guide')?.addEventListener('click', () => {
    const guide = $('visual-guide');
    if (guide) {
      const isVisible = guide.style.display === 'block';
      guide.style.display = isVisible ? 'none' : 'block';
      haptic('light');
    }
  });

  $('btn-new-order')?.addEventListener('click', () => {
    haptic();
    $('order-success').classList.remove('show');
    state.calc = { area: 0, cameraType: null, package: null, soundRecord: false, motionDetect: false, result: null };
    $$('.cam-type-card').forEach(c => c.classList.remove('selected'));
    $$('.pkg-card').forEach(c => c.classList.remove('selected'));
    $$('.option-checkbox').forEach(r => r.classList.remove('checked'));
    const areaInput = $('area-input'); if (areaInput) areaInput.value = '';
    showScreen('calculator');
  });

  document.getElementById('btn-edit-profile-2')?.addEventListener('click', () => {
    document.getElementById('profile-main-view').style.display = 'none';
    document.getElementById('profile-edit-view').style.display = 'flex';
  });
  document.getElementById('btn-edit-profile-3')?.addEventListener('click', () => {
    document.getElementById('profile-main-view').style.display = 'none';
    document.getElementById('profile-edit-view').style.display = 'flex';
  });

  // Map Listeners
  $('btn-map-open')?.addEventListener('click', openFullMap);
  $('btn-map-close')?.addEventListener('click', closeFullMap);
  $('btn-map-manual')?.addEventListener('click', () => {
    closeFullMap();
    $('edit-address')?.focus();
  });
  $('btn-map-confirm')?.addEventListener('click', () => {
    if (selectedAddress) {
      const input = $('edit-address');
      if (input) input.value = selectedAddress;
      closeFullMap();
      haptic('success');
    } else {
      toast('Выберите адрес на карте', 'error');
    }
  });
}

// ─── ЗАПУСК ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
window.App = { init };

document.addEventListener('DOMContentLoaded', () => {
  ['home-pkg-budget','home-pkg-standard','home-pkg-premium'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      showScreen('calculator');
    });
  });
});
