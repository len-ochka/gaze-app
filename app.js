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
  courier: 1000,
  maintenance: 2500,  // Ежемесячное ТО
  router_4g: 6500
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
  isAuthInProgress: false,
  calc: {
    area: 0,
    cameraType: null,   // outdoor / indoor / mixed
    package: null,      // budget / standard / premium
    soundRecord: false,
    motionDetect: false,
    hasInternet: false,
    maintenance: false,
    archiveDays: 14,
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

function showShimmer(containerId, height = '100px', count = 1) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = Array(count).fill(0).map(() => `<div class="shimmer" style="height:${height}; border-radius:12px; margin-bottom:10px; width:100%;"></div>`).join('');
}

function isEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

  const gbPerDay = pkg.id === 'premium' ? 60 : pkg.id === 'standard' ? 30 : 15;
  const totalGbNeeded = camCount * gbPerDay * (opts.archiveDays || 14);
  let hddKey = 'hdd_budget';
  if (totalGbNeeded > 1000) hddKey = 'hdd_standard';
  if (totalGbNeeded > 2000) hddKey = 'hdd_premium';
  const hddTotal = PRICES[hddKey];

  const micTotal = opts.soundRecord ? PRICES.mic * (camCount <= 4 ? 1 : 2) : 0;
  const internetTotal = opts.hasInternet ? (PRICES.router_4g || 6500) : 0;

  // Расчет стоимости работ with Moscow rates & margin
  const baseInstall = PRICES[pkg.install] * camCount;
  const nvrInstall = PRICES.install_nvr;
  const remoteSetup = PRICES.setup_remote;
  const cableWork = cableM * PRICES.cable_work;

  let laborTotal = baseInstall + nvrInstall + remoteSetup + cableWork;

  // Применяем маржу 8% на работы и округляем до 100 рублей
  laborTotal = Math.round((laborTotal * 1.08) / 100) * 100;

  const chCount = camCount <= 4 ? '4-канальный' : camCount <= 8 ? '8-канальный' : '16-канальный';

  const items = [
    { name: pkg.camName, spec: pkg.camSpec + ', ' + pkg.resolution, price: camTotal, qty: camCount, icon: '📷' },
    { name: 'Видеорегистратор ' + chCount, spec: 'H.265+, запись 24/7, удалённый доступ', price: dvrTotal, qty: 1, icon: '🖥️' },
    { name: 'Кабель витая пара', spec: cableM + 'м (расчёт по площади ' + area + 'м²)', price: cableTotal, qty: 1, icon: '🔌' },
    { name: 'PoE-коммутатор ' + chCount.replace('Видеорегистратор ', ''), spec: '802.3af/at, до 30Вт/порт', price: poeTotal, qty: 1, icon: '⚡' },
    { name: 'HDD для видеонаблюдения', spec: `Ёмкость под архив ${opts.archiveDays} дн.`, price: hddTotal, qty: 1, icon: '💾' },
  ];
  if (opts.soundRecord) items.push({ name: 'Микрофон всенаправленный', spec: 'до 10м, шумоподавление', price: micTotal, qty: camCount <= 4 ? 1 : 2, icon: '🎤' });
  if (opts.hasInternet) items.push({ name: '4G-Интернет комплект', spec: 'Роутер + антенна + SIM', price: internetTotal, qty: 1, icon: '🌐' });
  if (opts.maintenance) items.push({ name: 'Техническое обслуживание', spec: 'Ежемесячный выезд, чистка, проверка дисков', price: PRICES.maintenance, qty: 1, icon: '🛠️' });
  items.push({ name: 'Монтаж и настройка системы', spec: camCount + ' точек + NVR + кабель', price: laborTotal, qty: 1, icon: '🔧' });

  const equipmentTotal = camTotal + dvrTotal + cableTotal + poeTotal + hddTotal + micTotal + internetTotal;
  let total = equipmentTotal + laborTotal + (opts.maintenance ? PRICES.maintenance : 0);

  // Округляем итог до сотен
  total = Math.round(total / 100) * 100;

  if (state.orderCount >= 3) total = Math.round(total * 0.95 / 100) * 100;

  return { items, equipment: equipmentTotal, laborTotal, total, camCount, cableM, pkg, maintenance: opts.maintenance };
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
    total_price: state.calc.result?.total || 0
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
  const successEl = $('order-success');
  successEl.classList.add('show');
    $$('.calc-step').forEach(s => s.classList.remove('active'));

  anime({
    targets: successEl,
    scale: [0.8, 1],
    opacity: [0, 1],
    duration: 800,
    easing: 'easeOutElastic(1, .6)'
  });

  anime({
    targets: successEl.querySelector('.success-icon'),
    rotate: '1turn',
    duration: 1000,
    easing: 'easeInOutBack'
  });

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

  const currentAddr = $('edit-address')?.value;

  if (!window.ymaps) return;
  window.ymaps.ready(() => {
    if (!myMap) {
      myMap = new ymaps.Map("big-map", {
        center: [55.755864, 37.617698], // Москва
        zoom: 11,
        controls: ['zoomControl', 'geolocationControl']
      });

      myMap.events.add('click', function (e) {
        const coords = e.get('coords');
        getAddress(coords);
      });
    } else {
      myMap.container.fitToViewport();
    }

    // Ограничиваем SuggestView
    if (!$('edit-address').dataset.suggestBound) {
       new ymaps.SuggestView('edit-address', {
          boundedBy: [[55.1, 36.7], [56.2, 38.5]], // Примерные границы МО
          strictBounds: true
       });
       $('edit-address').dataset.suggestBound = "true";
    }

    if (currentAddr && currentAddr.length > 5) {
      ymaps.geocode(currentAddr, { results: 1 }).then(res => {
        const obj = res.geoObjects.get(0);
        if (obj) {
          const coords = obj.geometry.getCoordinates();
          updateMapMarker(coords, obj.getAddressLine());
          myMap.setCenter(coords, 16);
        }
      });
    }
  });
}

function updateMapMarker(coords, address) {
    myMap.geoObjects.removeAll();
    const placemark = new ymaps.Placemark(coords, { iconCaption: 'Загрузка...' }, { preset: 'islands#blueDotIconWithCaption' });
    myMap.geoObjects.add(placemark);

    selectedAddress = address;
    placemark.properties.set('iconCaption', address);
    if ($('map-selection-info')) $('map-selection-info').textContent = address;

    const input = $('edit-address');
    if (input) {
        input.value = address;
        input.classList.remove('error');
    }

    const confirmBtn = $('btn-map-confirm');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Подтвердить';
    }
}

/**
 * Обратное геокодирование координат в адрес с помощью Яндекс.Карт.
 */
function getAddress(coords) {
  const confirmBtn = $('btn-map-confirm');
  if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner"></span>';
  }

  // Пробуем найти ближайший дом
  ymaps.geocode(coords, { kind: 'house', results: 1 }).then(function (res) {
    let obj = res.geoObjects.get(0);

    // Если дом не найден, ищем любой ближайший объект (улицу, метро и т.д.)
    if (!obj) {
      return ymaps.geocode(coords, { results: 1 }).then(res2 => {
        obj = res2.geoObjects.get(0);
        if (obj) updateMapMarker(coords, obj.getAddressLine());
        else {
          selectedAddress = '';
          if ($('map-selection-info')) $('map-selection-info').textContent = 'Адрес не найден';
        }
      });
    }

    updateMapMarker(coords, obj.getAddressLine());
  }).catch(err => {
    console.error('Geocoding error:', err);
    toast('Ошибка геокодирования', 'error');
  });
}

async function validateManualAddress(addr) {
  if (!addr || addr.length < 5) return false;
  if (!window.ymaps) return true; // Fail-safe
  try {
    const res = await ymaps.geocode(addr);
    const obj = res.geoObjects.get(0);
    if (!obj) return false;
    // Если объект найден и это хотя бы улица или здание - считаем валидным
    const meta = obj.properties.get('metaDataProperty.GeocoderMetaData');
    const kind = meta.kind;
    return ['house', 'street', 'district', 'locality'].includes(kind);
  } catch (e) {
    return true; // В случае ошибки API не блокируем пользователя
  }
}

function closeFullMap() {
  const modal = $('full-map-view');
  if (modal) modal.style.display = 'none';
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
async function renderAdmin() {
  if (state.user?.role !== 'admin') { showScreen('home'); return; }
  if (!$('admin-tab-bound')) {
    $$('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        haptic(); $$('.admin-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
        $$('.admin-panel-tab').forEach(p => p.style.display = 'none');
        $(`admin-tab-${tab.dataset.tab}`).style.display = 'block'; renderAdminContent(tab.dataset.tab);
      });
    });
    const marker = document.createElement('div'); marker.id = 'admin-tab-bound'; document.body.appendChild(marker);
  }
  renderAdminContent('stats');
}

async function renderAdminContent(tab) {
  try {
    if (tab === 'stats') {
      showShimmer('admin-stats-container', '80px', 4);
      const stats = await StorageService.getAdminStats();
      $('admin-stats-container').innerHTML = `
        <div class="stat-box"><div class="stat-box-label">Выручка</div><div class="stat-box-value">${fmt(stats.total_revenue)}</div></div>
        <div class="stat-box"><div class="stat-box-label">Заказы</div><div class="stat-box-value">${stats.total_orders}</div></div>
        <div class="stat-box"><div class="stat-box-label">Клиенты</div><div class="stat-box-value">${stats.total_users}</div></div>
        <div class="stat-box"><div class="stat-box-label">За неделю</div><div class="stat-box-value">+${stats.recent_orders}</div></div>`;

      initAdminChart(stats.history);
    }
    if (tab === 'orders') {
      showShimmer('admin-orders-list', '120px', 3);
      const orders = await StorageService.apiRequest('/admin/orders');
      $('admin-orders-list').innerHTML = orders.map(o => `
        <div class="admin-order-card" style="background:var(--bg-card); padding:12px; border-radius:12px; margin-bottom:10px; border-left:4px solid var(--accent)">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="font-weight:bold;">#${esc(o.id)}</span><span class="status-badge status-${o.status}">${o.status}</span></div>
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">${esc(o.full_name)} <br> ${esc(o.phone || '—')} <br> <b>${fmt(o.total_price)}</b></div>
          <div style="display:flex; gap:6px;">
            <button onclick="updateOrderStatus('${o.id}', 'processing')" style="font-size:10px; padding:4px 8px; border-radius:4px; background:var(--accent); border:none; color:var(--bg-primary);">В работу</button>
            <button onclick="updateOrderStatus('${o.id}', 'completed')" style="font-size:10px; padding:4px 8px; border-radius:4px; background:var(--accent-2); border:none; color:var(--bg-primary);">Готов</button>
            <button onclick="blockUser(${o.user_id})" style="font-size:10px; padding:4px 8px; border-radius:4px; background:#ff4d4d; border:none; color:white;">Блок</button>
          </div>
        </div>`).join('');
    }
    if (tab === 'prices') {
      const prices = await StorageService.getPrices();
      $('admin-prices-list').innerHTML = Object.entries(prices).map(([key, val]) => `
        <div class="admin-price-row" style="display:flex; justify-content:space-between; margin-bottom:8px; background:var(--bg-card); padding:10px; border-radius:8px;">
          <span style="font-size:13px; color:var(--text-secondary)">${key}</span>
          <input type="number" value="${val}" onchange="updatePrice('${key}', this.value)" style="width:80px; background:transparent; color:white; border:1px solid var(--glass-border); border-radius:4px; text-align:right;">
        </div>`).join('');
    }
    const logs = await StorageService.apiRequest('/admin/logs');
    $('admin-logs-list').innerHTML = logs.map(l => `<div class="admin-log-row" style="font-size:11px; color:${l.level === 'error' ? '#ff4d4d' : 'var(--text-muted)'}; margin-bottom:4px; padding:4px; border-bottom:1px solid var(--glass-border);">[${new Date(l.created_at).toLocaleTimeString()}] ${esc(l.message)}</div>`).join('');
  } catch (e) { toast('Ошибка загрузки: ' + e.message, 'error'); }
}

window.updateOrderStatus = async (orderId, status) => {
  try { await StorageService.updateOrderStatus(orderId, status); toast('Статус обновлен'); renderAdminContent('orders'); }
  catch (e) { toast(e.message, 'error'); }
};

window.updatePrice = async (key, val) => {
  try {
    await StorageService.apiRequest('/admin/prices', 'POST', { key, value: parseInt(val) });
    toast('Цена обновлена', 'success');
  } catch (e) {
    toast('Ошибка обновления: ' + e.message, 'error');
  }
};

let adminChartInstance = null;
function initAdminChart(history) {
  const ctx = $('adminRevenueChart');
  if (!ctx) return;

  if (adminChartInstance) adminChartInstance.destroy();

  const labels = history.map(h => h.date);
  const data = history.map(h => h.revenue);

  adminChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Выручка (₽)',
        data,
        borderColor: '#00f2ff',
        backgroundColor: 'rgba(0, 242, 255, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }
        }
      }
    }
  });
}

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
        ${esc(m.text)}
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
  TelegramService.ready();

  const hasSeenLanding = localStorage.getItem('gaze_seen_landing');
  if (!hasSeenLanding) {
    showScreen('landing');
  } else {
    // If not first time, start auth process
    performAuth();
  }

  bindAll();

  // Listen for retry button
  $('btn-auth-retry')?.addEventListener('click', () => {
    haptic('medium');
    performAuth();
  });
}

/**
 * Основной процесс авторизации и инициализации сессии.
 * Реализует защищённый вход с автоматическими повторами и переходом в офлайн-режим.
 */
async function performAuth() {
  if (state.isAuthInProgress) return;

  state.isAuthInProgress = true;
  showScreen('auth');

  const statusEl = $('auth-status');
  const retryBtn = $('btn-auth-retry');

  if (statusEl) {
    statusEl.textContent = 'СИНХРОНИЗАЦИЯ...';
    statusEl.style.color = 'var(--accent)';
  }
  if (retryBtn) retryBtn.style.display = 'none';

  // Расширяем приложение на весь экран
  TelegramService.expand();

  // Резервный таймер UI для предотвращения "бесконечного" ожидания пользователем
  const uiFallbackTimer = setTimeout(() => {
    if (state.screen === 'auth' && retryBtn) {
      retryBtn.style.display = 'block';
      if (statusEl) {
        statusEl.textContent = 'СОЕДИНЕНИЕ УСТАНАВЛИВАЕТСЯ...';
      }
    }
  }, 7000);

  try {
    // 1. Попытка синхронизации с сервером (внутри storage.js 4 попытки с задержкой)
    const syncResult = await StorageService.syncUser(4).catch(err => {
        // Если это ошибка авторизации (401/403), пробуем обновить данные из TG
        if (err.status === 401 || err.status === 403) {
            console.log('[App] Auth error, clearing cache and retrying...');
            StorageService.clearSession();
        }
        throw err;
    });

    clearTimeout(uiFallbackTimer);

    if (syncResult) {
      state.user = syncResult;
      state.orderCount = StorageService.getOrderCount();

      // Настройка прав доступа и интерфейса
      if (state.user?.role === 'admin') $('nav-admin').style.display = 'flex';
      if (state.orderCount > 0) $('nav-support').style.display = 'flex';

      // 2. Фоновое обновление цен (не блокирует вход)
      StorageService.getPrices().then(remotePrices => {
        if (remotePrices) Object.assign(PRICES, remotePrices);
      }).catch(() => {});

      // Успешный вход
      if (statusEl) statusEl.textContent = 'ГОТОВО';
      haptic('success');
      setTimeout(() => showScreen('home'), 500);
    } else {
      throw new Error('AUTH_FAILED');
    }
  } catch (e) {
    console.error('[App] Критическая ошибка авторизации:', e);
    clearTimeout(uiFallbackTimer);

    if (statusEl) {
      statusEl.textContent = 'ОШИБКА СВЯЗИ';
      statusEl.style.color = '#ff4d4d';
    }
    if (retryBtn) retryBtn.style.display = 'block';

    // 3. Стратегия выживания: пробуем войти через локальный кэш
    const cachedUser = StorageService.getUser();
    if (cachedUser) {
      state.user = cachedUser;
      state.orderCount = StorageService.getOrderCount();
      toast('Вход выполнен в автономном режиме', 'warning');
      setTimeout(() => showScreen('home'), 1500);
    } else {
      haptic('error');
      // Если это не TWA и нет кэша - выводим подсказку
      if (!window.Telegram?.WebApp?.initData) {
        toast('Пожалуйста, откройте приложение в Telegram', 'error');
      }
    }
  } finally {
    state.isAuthInProgress = false;
  }
}

// ─── НАВИГАЦИЯ И АНИМАЦИИ ──────────────────────────────────────────────────────
function showScreen(name) {
  const oldScreen = document.querySelector('.screen.active');
  const newScreen = $('screen-' + name);

  if (!newScreen) return;
  if (oldScreen === newScreen) return;

  // Анимация перехода через Anime.js
  if (oldScreen) {
    anime({
      targets: oldScreen,
      opacity: [1, 0],
      scale: [1, 0.95],
      duration: 300,
      easing: 'easeInExpo',
      complete: () => {
        oldScreen.classList.remove('active');
        prepareNewScreen(name, newScreen);
      }
    });
  } else {
    prepareNewScreen(name, newScreen);
  }
}

function prepareNewScreen(name, el) {
  el.classList.add('active');
  state.screen = name;

  // Анимация появления нового экрана
  anime({
    targets: el,
    opacity: [0, 1],
    scale: [1.05, 1],
    translateY: [10, 0],
    duration: 450,
    easing: 'easeOutExpo'
  });

  const nav = $('bottom-nav');
  if (nav) {
    const shouldHideNav = (name === 'auth' || name === 'landing');
    nav.style.display = shouldHideNav ? 'none' : 'flex';

    // Плавное появление навигации
    if (!shouldHideNav && nav.style.opacity === '0') {
      anime({ targets: nav, opacity: [0, 1], translateY: [20, 0], duration: 500 });
    }
  }

  $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.screen === name));

  // Инициализация логики экранов
  if (name === 'home') renderHome();
  if (name === 'profile') renderProfile();
  if (name === 'calculator') {
    renderCalcStep(1);
    animateEntrance('#calc-step-1');
  }
  if (name === 'admin') renderAdmin();
  if (name === 'support') renderSupport();
}

function animateEntrance(selector) {
  anime({
    targets: selector + ' > *',
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(100),
    duration: 600,
    easing: 'easeOutExpo'
  });
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
  const oldStep = document.querySelector('.calc-step.active');
  const newStep = $('calc-step-' + n);

  if (oldStep && oldStep !== newStep) {
    anime({
      targets: oldStep,
      opacity: [1, 0],
      translateX: [0, -10],
      duration: 200,
      easing: 'easeInQuad',
      complete: () => {
        oldStep.classList.remove('active');
        activateStep(n, newStep);
      }
    });
  } else {
    activateStep(n, newStep);
  }
}

function activateStep(n, el) {
  if (!el) return;
  calcStep = n;
  el.classList.add('active');

  // Анимация элементов внутри шага
  animateEntrance('#calc-step-' + n);

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
  $$('.days-hint').forEach(h => {
    h.addEventListener('click', () => {
      haptic('light'); state.calc.archiveDays = parseInt(h.dataset.val);
      $$('.days-hint').forEach(x => x.classList.remove('active')); h.classList.add('active');
    });
  });

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
    motionDetect: state.calc.motionDetect,
    hasInternet: state.calc.hasInternet,
    archiveDays: state.calc.archiveDays,
    maintenance: state.calc.maintenance
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

  // Логика VIP статуса
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
  const editPhone = $('edit-phone');
  if (editPhone) {
      editPhone.value = u.phone || '';
      applyPhoneMask(editPhone);
  }
  const editAddr = $('edit-address'); if (editAddr) editAddr.value = u.address || '';

  StorageService.getReferralData().then(data => {
    if (data) { $('ref-bonus-display').textContent = fmt(data.balance); state.referralCode = data.code; }
  }).catch(() => {});
}

function applyPhoneMask(input) {
  const onInput = (e) => {
    let value = input.value.replace(/\D/g, '');
    if (value.startsWith('8')) value = '7' + value.slice(1);
    if (value.length > 0 && value[0] !== '7') value = '7' + value;

    let formatted = '';
    if (value.length > 0) {
      formatted = '+7 (';
      if (value.length > 1) formatted += value.substring(1, 4);
      if (value.length >= 5) formatted += ') ' + value.substring(4, 7);
      if (value.length >= 8) formatted += '-' + value.substring(7, 9);
      if (value.length >= 10) formatted += '-' + value.substring(9, 11);
    }

    const cursor = input.selectionStart;
    const oldLen = input.value.length;
    input.value = formatted;

    if (e.inputType !== 'deleteContentBackward') {
        const newLen = input.value.length;
        input.setSelectionRange(cursor + (newLen - oldLen), cursor + (newLen - oldLen));
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Backspace' && input.value.length <= 4) {
      e.preventDefault();
      input.value = '';
    }
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('focus', () => {
    if (!input.value) input.value = '+7 (';
  });
}

function bindProfile() {
  $('btn-share-ref')?.addEventListener('click', () => {
    haptic('medium'); if (!state.referralCode) return;
    const botUser = 'gaze_video_bot';
    const link = `https://t.me/${botUser}/app?startapp=${state.referralCode}`;
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Привет! Пользуюсь крутым конструктором видеонаблюдения Gaze. Попробуй сам!')}`);
    } else {
      navigator.clipboard.writeText(link); toast('Ссылка скопирована в буфер обмена');
    }
  });

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

    // Улучшенная валидация RU номера
    const cleanPhone = phone.replace(/\D/g, '');
    if (!/^(7|8)9\d{9}$/.test(cleanPhone)) {
        fieldErr('edit-phone', 'Введите корректный номер (например, +7 999 000-00-00)');
        return;
    }

    // Валидация адреса
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

    // Полная очистка состояния
    state.user = null;
    state.orderCount = 0;
    state.isAuthInProgress = false;
    StorageService.clearSession();

    // Сброс элементов интерфейса
    $('nav-admin').style.display = 'none';
    $('nav-support').style.display = 'none';
    $$('.nav-item').forEach(i => i.classList.remove('active'));

    toast('Вы вышли из аккаунта');

    // Возврат на экран авторизации с задержкой для плавности
    setTimeout(() => {
      performAuth();
    }, 300);
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
      anime({
        targets: btn,
        scale: [1, 0.9, 1],
        duration: 200,
        easing: 'easeOutQuad'
      });
      if (btn.dataset.screen) showScreen(btn.dataset.screen);
    });
  });

  $('promo-to-calc')?.addEventListener('click', () => { haptic(); showScreen('calculator'); });

  $('btn-landing-start')?.addEventListener('click', () => {
    haptic();
    anime({
      targets: '#btn-landing-start',
      scale: [1, 0.9, 1.1, 1],
      duration: 400,
      easing: 'easeInOutQuad',
      complete: () => {
        localStorage.setItem('gaze_seen_landing', 'true');
        if (state.user) {
          showScreen('home');
        } else {
          performAuth();
        }
      }
    });
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
    state.calc = { area: 0, cameraType: null, package: null, soundRecord: false, motionDetect: false, hasInternet: false, maintenance: false, result: null };
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

  // Слушатели карты
  $('btn-map-open')?.addEventListener('click', openFullMap);
  $('btn-map-close')?.addEventListener('click', closeFullMap);
  $('btn-map-manual')?.addEventListener('click', () => {
    closeFullMap();
    $('edit-address')?.focus();
  });
  $('btn-map-confirm')?.addEventListener('click', () => {
    if (selectedAddress) {
      const input = $('edit-address');
      if (input) {
          input.value = selectedAddress;
          // Вызов события input to clear potential validation errors
          input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      closeFullMap();
      haptic('success');
    } else {
      toast('Пожалуйста, подождите, адрес определяется...', 'warning');
    }
  });
}

// ─── ЗАПУСК ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Дополнительные обработчики для карточек на главной
    ['home-pkg-budget','home-pkg-standard','home-pkg-premium'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        showScreen('calculator');
      });
    });
});
window.App = { init, state, showScreen, renderAdmin, renderProfile };
