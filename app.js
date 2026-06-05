'use strict';

// ─── КОНФИГУРАЦИЯ БОТА ────────────────────────────────────────────────────────
// ВАЖНО: В реальном приложении токен и отправка должны быть на бэкенде.
// Здесь мы используем Telegram.WebApp.sendData для работы через бота.
const ADMIN_CHAT = '@neznnezn';

// ─── ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ ───────────────────────────────────────────────────
const TECH_SPECS = {
  bitrate: { budget: 1.5, standard: 3, premium: 8 }, // Mbps per cam (H.265)
  power: { budget: 5, standard: 6, premium: 10 },    // Watts per cam
  poe_budget: { 4: 60, 8: 120, 16: 250 }             // Watts per switch
};

// ─── ПРАЙС-ЛИСТ ───────────────────────────────────────────────────────────────
const PRICES = {
  // Камеры
  cam_budget:    1490,   // Бюджетная камера 1.3МП
  cam_standard:  2900,   // Стандартная 2МП (FullHD)
  cam_premium:   6900,   // Премиум 4K (8МП)

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

  // Монтаж (за точку)
  install_budget:   1500,
  install_standard: 2500,
  install_premium:  4000,

  // Дополнительно
  mic: 890,
  courier: 500
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
const AppState = {
  screen: 'auth',
  calcStep: 1,
  user: null,
  orderCount: 0,
  calc: {
    area: 0,
    cameraType: null,
    package: null,
    soundRecord: false,
    motionDetect: false,
    result: null
  }
};
const state = AppState; // Backward compatibility for existing code

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

// ─── МОДУЛЬ РАСЧЕТОВ ─────────────────────────────────────────────────────────
const Calculator = {
  calcCameras(area, type) {
    let count;
    if (type === 'outdoor') {
      const perimeter = 4 * Math.sqrt(area);
      count = Math.ceil(perimeter / 15);
    } else {
      count = Math.ceil(area / 20);
    }
    return Math.min(16, Math.max(2, count));
  },

  calcCable(area, camCount, type) {
    const avgDist = Math.ceil(Math.sqrt(area) / 2 * 1.3);
    return avgDist * camCount + 10;
  },

  getDvrKey(pkg, count) {
    if (count <= 4) return pkg.dvr_prefix + '_4';
    if (count <= 8) return pkg.dvr_prefix + '_8';
    return pkg.dvr_prefix + '_16';
  },

  getPoeKey(pkg, count) {
    if (count <= 4) return pkg.poe_prefix + '_4';
    if (count <= 8) return pkg.poe_prefix + '_8';
    return pkg.poe_prefix + '_16';
  }
};

// ─── РАСЧЁТ КАМЕР ПО ПЛОЩАДИ (DEPRECATED, using Calculator) ──────────────────
function calcCamerasForArea(area, type) { return Calculator.calcCameras(area, type); }
function calcCableForArea(area, camCount, type) { return Calculator.calcCable(area, camCount, type); }
function getDvrKey(pkg, count) { return Calculator.getDvrKey(pkg, count); }
function getPoeKey(pkg, count) { return Calculator.getPoeKey(pkg, count); }

function buildSpec(pkg, area, camType, opts) {
  const camCount = calcCamerasForArea(area, camType);
  const cableM = calcCableForArea(area, camCount, camType);
  const dvrKey = getDvrKey(pkg, camCount);
  const poeKey = getPoeKey(pkg, camCount);
  const ports = camCount <= 4 ? 4 : (camCount <= 8 ? 8 : 16);

  // Расчет тех. параметров
  const bitrate = TECH_SPECS.bitrate[pkg.id];
  const totalMbps = (bitrate * camCount).toFixed(1);
  const storageDays = pkg.id === 'budget' ? 7 : (pkg.id === 'standard' ? 14 : 30);
  const storageNeededTB = ((bitrate * 3600 * 24 * storageDays * camCount) / (8 * 1024 * 1024)).toFixed(1);
  
  const totalPower = TECH_SPECS.power[pkg.id] * camCount;
  const poeBudget = TECH_SPECS.poe_budget[ports];
  const powerLoad = Math.round((totalPower / poeBudget) * 100);

  const camTotal = PRICES[pkg.cam] * camCount;
  const dvrTotal = PRICES[dvrKey] || 0;
  const cableTotal = Math.round(cableM * PRICES[pkg.cable]);
  const poeTotal = PRICES[poeKey] || 0;
  const hddTotal = PRICES[pkg.hdd];
  const micTotal = opts.soundRecord ? PRICES.mic * (camCount <= 4 ? 1 : 2) : 0;
  const installTotal = PRICES[pkg.install] * camCount;

  const equipment = camTotal + dvrTotal + cableTotal + poeTotal + hddTotal + micTotal;
  const total = equipment + installTotal;

  const chCount = ports + '-канальный';

  const items = [
    { 
      name: pkg.camName, 
      spec: `${pkg.camSpec}, ${pkg.resolution}, H.265+, WDR`, 
      price: camTotal, qty: camCount, icon: '📷' 
    },
    { 
      name: 'NVR ' + chCount, 
      spec: `Входящий поток до ${ports * 10}Mbps, H.265+, ONVIF, P2P`, 
      price: dvrTotal, qty: 1, icon: '🖥️' 
    },
    { 
      name: 'Кабель UTP Cat5e', 
      spec: `${cableM}м, 4x2x0.51 Cu (медь), для уличной/внутренней прокладки`, 
      price: cableTotal, qty: 1, icon: '🔌' 
    },
    { 
      name: 'PoE-коммутатор ' + ports + ' портов', 
      spec: `Бюджет ${poeBudget}W (нагрузка ${powerLoad}%), 10/100/1000Mbps`, 
      price: poeTotal, qty: 1, icon: '⚡' 
    },
    { 
      name: 'HDD WD Purple / Seagate SkyHawk', 
      spec: `${pkg.id === 'budget' ? '1ТБ' : pkg.id === 'standard' ? '2ТБ' : '4ТБ'}, спец. серия для 24/7, расчет на ${storageDays} дн.`, 
      price: hddTotal, qty: 1, icon: '💾' 
    },
  ];
  if (opts.soundRecord) items.push({ name: 'Микрофон активный', spec: 'АРУ, фильтрация шумов, до 15м', price: micTotal, qty: camCount <= 4 ? 1 : 2, icon: '🎤' });
  items.push({ name: 'Монтаж и пусконаладка', spec: `${camCount} точ. × ${fmt(PRICES[pkg.install])}, настройка ПО и удаленного доступа`, price: installTotal, qty: 1, icon: '🔧' });

  return { 
    items, equipment, installTotal, total, camCount, cableM, pkg, 
    tech: { totalMbps, storageNeededTB, powerLoad, storageDays } 
  };
}

// ─── ОТПРАВКА В TELEGRAM ─────────────────────────────────────────────────────
async function sendOrderToTelegram(orderData) {
  // Используем TelegramService.sendData для отправки данных боту, 
  // который запустил Web App. Бот сам перешлет это администратору.
  // Это безопаснее, чем хранить токен на клиенте и обходит CORS.
  const success = TelegramService.sendData({
    type: 'new_order',
    data: orderData
  });
  
  if (!success) {
    // Если мы не в Telegram, имитируем успешную отправку для демо
    console.log('Order data (outside TG):', orderData);
    return new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return true;
}

// ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────────────────────
function init() {
  // Используем StorageService
  state.user = StorageService.getUser();
  state.orderCount = StorageService.getOrderCount();

  // TelegramService init
  TelegramService.ready();
  
  if (TelegramService.isTelegramUser()) {
    const tgUser = TelegramService.getTelegramUser();
    if (!state.user) {
      state.user = tgUser;
      StorageService.setUser(state.user);
    }
  }

  bindAll();
  showScreen(state.user ? 'home' : 'auth');
}

// ─── НАВИГАЦИЯ ────────────────────────────────────────────────────────────────
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const t = $('screen-' + name);
  if (t) t.classList.add('active');
  state.screen = name;

  const nav = $('bottom-nav');
  if (nav) nav.style.display = name === 'auth' ? 'none' : '';

  $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.screen === name));

  // TWA Navigation
  if (name === 'home') {
    TelegramService.BackButton.hide();
    TelegramService.MainButton.hide();
  } else if (name !== 'auth') {
    TelegramService.BackButton.show(() => {
      if (name === 'calculator' && calcStep > 1) {
        renderCalcStep(calcStep - 1);
      } else {
        showScreen('home');
      }
    });
  }

  if (name === 'home') renderHome();
  if (name === 'profile') renderProfile();
  if (name === 'calculator') renderCalcStep(1);
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

  $('btn-login')?.addEventListener('click', doLogin);
  $('btn-register')?.addEventListener('click', doRegister);
}

function doLogin() {
  haptic('medium');
  const email = $('login-email')?.value.trim();
  const pass = $('login-pass')?.value;
  clearErr(['login-email', 'login-pass']);
  let ok = true;
  if (!isEmail(email)) { fieldErr('login-email', 'Введите корректный email'); ok = false; }
  if (pass?.length < 6) { fieldErr('login-pass', 'Минимум 6 символов'); ok = false; }
  if (!ok) { haptic('error'); return; }
  const btn = $('btn-login');
  setLoading(btn, true);
  setTimeout(() => {
    setLoading(btn, false);
    const accounts = StorageService.getAccounts();
    if (!accounts[email] || accounts[email].pass !== btoa(pass)) {
      haptic('error'); fieldErr('login-email', 'Неверный email или пароль'); return;
    }
    haptic('success');
    state.user = accounts[email].user;
    StorageService.setUser(state.user);
    showScreen('home'); toast('Добро пожаловать!', 'success');
  }, 700);
}

function doRegister() {
  haptic('medium');
  const name = $('reg-name')?.value.trim();
  const email = $('reg-email')?.value.trim();
  const pass = $('reg-pass')?.value;
  clearErr(['reg-name', 'reg-email', 'reg-pass']);
  let ok = true;
  if (name?.length < 2) { fieldErr('reg-name', 'Введите ваше имя'); ok = false; }
  if (!isEmail(email)) { fieldErr('reg-email', 'Корректный email'); ok = false; }
  if (pass?.length < 6) { fieldErr('reg-pass', 'Минимум 6 символов'); ok = false; }
  if (!ok) { haptic('error'); return; }
  const btn = $('btn-register');
  setLoading(btn, true);
  setTimeout(() => {
    setLoading(btn, false);
    const accounts = StorageService.getAccounts();
    if (accounts[email]) { haptic('error'); fieldErr('reg-email', 'Аккаунт уже существует'); return; }
    haptic('success');
    state.user = { name, email, phone: '', address: '' };
    accounts[email] = { pass: btoa(pass), user: state.user };
    StorageService.setAccounts(accounts);
    StorageService.setUser(state.user);
    showScreen('home'); toast('Аккаунт создан!', 'success');
  }, 800);
}

// ─── ГЛАВНАЯ ──────────────────────────────────────────────────────────────────
function renderHome() {
  const nameEl = $('home-username');
  if (nameEl && state.user?.name) nameEl.textContent = state.user.name.split(' ')[0];
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

  // TWA MainButton Integration
  if (n === 1) {
    TelegramService.MainButton.show('Продолжить →', () => {
      state.calc.area = parseInt($('area-input')?.value) || 0;
      if (state.calc.area < 10) { toast('Укажите площадь (минимум 10 м²)', 'error'); return; }
      if (!state.calc.cameraType) { toast('Выберите тип размещения камер', 'error'); return; }
      renderCalcStep(2);
    });
  } else if (n === 2) {
    TelegramService.MainButton.show('Рассчитать →', () => {
      if (!state.calc.package) { toast('Выберите пакет', 'error'); return; }
      buildAndShowResult();
      renderCalcStep(3);
    });
  } else if (n === 3) {
    TelegramService.MainButton.show('📩 Отправить заявку', () => {
      doOrder();
    });
  }
}

function bindCalculator() {
  // Шаг 1 — площадь и тип
  $$('.cam-type-card').forEach(card => {
    card.addEventListener('click', () => {
      haptic('selection');
      $$('.cam-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.calc.cameraType = card.dataset.type;
    });
  });

  // Быстрые варианты площади
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

  // Шаг 2 — выбор пакета
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

  // Шаг 3
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
      <div class="tech-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;padding:12px;background:rgba(255,255,255,0.03);border-radius:12px;font-size:12px;border:1px solid var(--glass-border);">
        <div class="tech-item"><span style="color:var(--text-muted)">Поток:</span> <b style="color:var(--accent)">${spec.tech.totalMbps} Mbps</b></div>
        <div class="tech-item"><span style="color:var(--text-muted)">Архив:</span> <b style="color:var(--accent)">${spec.tech.storageDays} дн.</b></div>
        <div class="tech-item"><span style="color:var(--text-muted)">PoE нагрузка:</span> <b style="color:var(--accent)">${spec.tech.powerLoad}%</b></div>
        <div class="tech-item"><span style="color:var(--text-muted)">Объем данных:</span> <b style="color:var(--accent)">~${spec.tech.storageNeededTB} TB</b></div>
      </div>
      <div class="total-row"><span class="total-label">📷 Камер</span><span class="total-value">${spec.camCount} шт.</span></div>
      <div class="total-row"><span class="total-label">🔌 Кабель</span><span class="total-value">~${spec.cableM} м</span></div>
      <div class="total-row"><span class="total-label">📦 Пакет</span><span class="total-value">${pkg.name}</span></div>
      <div class="total-row"><span class="total-label">🔧 Монтаж</span><span class="total-value">${fmt(spec.installTotal)}</span></div>
      <div class="total-row total-final">
        <span class="total-label">💰 ИТОГО</span>
        <span class="total-value">${fmt(spec.total)}</span>
      </div>`;
  }
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
    user: state.user,
    area: state.calc.area,
    cameraType: state.calc.cameraType,
    opts: { soundRecord: state.calc.soundRecord, motionDetect: state.calc.motionDetect },
    spec: state.calc.result,
    timestamp: new Date().toISOString()
  };

  try {
    await sendOrderToTelegram(orderData);
    haptic('success');
    setLoading(btn, false);
    state.orderCount = StorageService.incrementOrderCount();

    // Показываем экран успеха
    $('order-id-display').textContent = '#' + orderId;
    $('order-success').classList.add('show');
    $$('.calc-step').forEach(s => s.classList.remove('active'));

  } catch (err) {
    haptic('error');
    setLoading(btn, false);
    toast('Ошибка отправки. Проверьте соединение.', 'error');
    console.error('Telegram send error:', err);
  }
}

// ─── ПРОФИЛЬ ─────────────────────────────────────────────────────────────────
function renderProfile() {
  if (!state.user) return;
  const u = state.user;
  const initials = (u.name || 'П').split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase();

  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('profile-initials', initials);
  set('profile-display-name', u.name || 'Пользователь');
  set('profile-display-email', u.email || '');
  set('profile-row-name', u.name || '—');
  set('profile-row-email', u.email || '—');
  set('profile-stat-orders', state.orderCount);

  const phoneEl = $('profile-row-phone');
  if (phoneEl) { phoneEl.textContent = u.phone || 'Не указан'; phoneEl.classList.toggle('placeholder', !u.phone); }

  const addrEl = $('profile-row-address');
  if (addrEl) { addrEl.textContent = u.address || 'Не указан'; addrEl.classList.toggle('placeholder', !u.address); }

  const editName = $('edit-name'); if (editName) editName.value = u.name || '';
  const editPhone = $('edit-phone'); if (editPhone) editPhone.value = u.phone || '';
  const editAddr = $('edit-address'); if (editAddr) editAddr.value = u.address || '';
}

function bindProfile() {
  $('btn-edit-profile')?.addEventListener('click', () => {
    haptic(); $('profile-main-view').style.display = 'none'; $('profile-edit-view').style.display = 'flex';
  });
  $('btn-edit-back')?.addEventListener('click', () => {
    haptic(); $('profile-main-view').style.display = ''; $('profile-edit-view').style.display = 'none';
  });
  $('btn-save-profile')?.addEventListener('click', () => {
    haptic('medium');
    const name = $('edit-name')?.value.trim();
    if (name?.length < 2) { toast('Введите корректное имя', 'error'); return; }
    state.user.name = name;
    state.user.phone = $('edit-phone')?.value.trim() || '';
    state.user.address = $('edit-address')?.value.trim() || '';
    StorageService.setUser(state.user);
    renderProfile();
    $('profile-main-view').style.display = ''; $('profile-edit-view').style.display = 'none';
    haptic('success'); toast('Профиль сохранён', 'success');
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

  // Нижняя навигация
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      haptic('light');
      if (btn.dataset.screen) showScreen(btn.dataset.screen);
    });
  });

  // Промо → калькулятор
  $('promo-to-calc')?.addEventListener('click', () => { haptic(); showScreen('calculator'); });

  // Новый заказ после успеха
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
}

// ─── ЗАПУСК ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
window.App = { init };

// Дополнительные обработчики для кнопок на главной
document.addEventListener('DOMContentLoaded', () => {
  ['home-pkg-budget','home-pkg-standard','home-pkg-premium'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      showScreen('calculator');
    });
  });
  // Дублирующие ссылки на редактирование профиля
  document.getElementById('btn-edit-profile-2')?.addEventListener('click', () => {
    document.getElementById('profile-main-view').style.display = 'none';
    document.getElementById('profile-edit-view').style.display = 'flex';
  });
  document.getElementById('btn-edit-profile-3')?.addEventListener('click', () => {
    document.getElementById('profile-main-view').style.display = 'none';
    document.getElementById('profile-edit-view').style.display = 'flex';
  });
});
