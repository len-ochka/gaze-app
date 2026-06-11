'use strict';

/* =============================================================================
   GAZE — Client App v2.0
   Merged & enhanced: promo codes, reviews, notification settings,
   improved admin (users, promo mgmt, broadcast, reviews moderation),
   unread chat badge, UPS option, home reviews carousel.
   ============================================================================= */

const App = (() => {

  // ─── STATE ────────────────────────────────────────────────────────────────
  const state = {
    user: null,
    isGuest: false,
    prices: {},
    currentScreen: 'landing',
    prevScreen: 'home',
    calcData: {
      area: null,
      cameraType: 'mixed',
      pkgId: null,
      options: {},
      spec: null,
      totalPrice: 0,
    },
    proCart: [],
    cart: [],
    adminChart: null,
    mapInstance: null,
    selectedMapCoords: null,
    selectedAddress: null,
    promoDiscount: 0,
    promoCode: null,
    lastOrderId: null,
    selectedRating: 0,
    adminOrderFilter: '',
    unreadPollTimer: null,
  };

  // ─── TOAST ────────────────────────────────────────────────────────────────
  let _toastTimer = null;
  function showToast(msg, type = '', duration = 3000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { t.classList.remove('show'); }, duration);
  }

  // ─── SCREEN ───────────────────────────────────────────────────────────────
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
    state.prevScreen = state.currentScreen;
    state.currentScreen = name;

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });

    const noNav = ['landing', 'auth'];
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = noNav.includes(name) ? 'none' : 'flex';

    if (name === 'profile') renderProfile();
    if (name === 'admin')   loadAdminStats();
    if (name === 'home')    { renderHome(); loadHomeReviews(); }
    if (name === 'support') loadChatMessages();

    const backScreens = ['calculator', 'cart', 'guide', 'faq', 'support', 'admin'];
    if (TelegramService.isAvailable()) {
      if (backScreens.includes(name)) {
        TelegramService.BackButton.show(() => showScreen(state.prevScreen || 'home'));
      } else {
        TelegramService.BackButton.hide();
      }
    }
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  async function init() {
    TelegramService.ready();
    if (TelegramService.isTelegramUser()) {
      showScreen('auth');
      await doTelegramAuth();
    }
  }

  async function doTelegramAuth() {
    const statusEl = document.getElementById('auth-status');
    const retryBtn = document.getElementById('btn-auth-retry');
    if (statusEl) statusEl.textContent = 'Выполняем вход...';
    try {
      const user = await StorageService.syncUser();
      state.user = user;
      state.isGuest = !!user.isGuest;
      await loadPrices();
      renderHome();
      loadHomeReviews();
      showScreen('home');
      startUnreadPoll();
    } catch (e) {
      console.error('[Auth] failed:', e);
      if (statusEl) statusEl.textContent = 'Ошибка входа. Попробуйте ещё раз.';
      if (retryBtn) retryBtn.style.display = 'block';
    }
  }

  async function enterAsGuest() {
    state.isGuest = true;
    state.user = {
      id: null, tg_id: null,
      full_name: 'Гость', username: 'guest',
      role: 'guest', order_count: 0, isGuest: true,
      notify_orders: 1, notify_promos: 1
    };
    await loadPrices();
    renderHome();
    loadHomeReviews();
    showScreen('home');
  }

  async function loadPrices() {
    try { state.prices = await StorageService.getPrices(); }
    catch { state.prices = {}; }
  }

  // ─── HOME ─────────────────────────────────────────────────────────────────
  function renderHome() {
    const u = state.user;
    const name = u ? (u.full_name || u.username || 'Пользователь').split(' ')[0] : 'Пользователь';
    const el = document.getElementById('home-username');
    if (el) el.textContent = name;
    updateConnStatus();

    const adminNav = document.getElementById('nav-admin');
    if (adminNav) adminNav.style.display = (u && u.role === 'admin') ? 'flex' : 'none';

    const suppNav = document.getElementById('nav-support');
    if (suppNav) suppNav.style.display = (u && u.order_count > 0) ? 'flex' : 'none';
  }

  function updateConnStatus() {
    const wrap = document.getElementById('conn-status');
    const txt  = document.getElementById('conn-status-text');
    if (!wrap || !txt) return;
    if (state.isGuest) {
      txt.textContent = '👁 Гость';
      wrap.style.borderColor = 'rgba(255,165,0,0.4)';
      wrap.style.color = 'rgba(255,165,0,0.8)';
    } else {
      txt.textContent = '● Онлайн';
      wrap.style.borderColor = 'rgba(0,255,148,0.4)';
      wrap.style.color = 'rgba(0,255,148,0.9)';
    }
  }

  // ─── HOME REVIEWS ─────────────────────────────────────────────────────────
  async function loadHomeReviews() {
    const el = document.getElementById('home-reviews-list');
    if (!el) return;
    try {
      const reviews = await StorageService.apiRequest('/reviews');
      if (!reviews || !reviews.length) {
        el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:12px;">Отзывов пока нет. Оставьте первый!</div>';
        return;
      }
      el.innerHTML = reviews.slice(0, 5).map(r => `
        <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;">${escHtml(r.full_name || 'Клиент')}</span>
            <span style="font-size:16px;">${'⭐'.repeat(r.rating)}</span>
          </div>
          ${r.text ? `<p style="font-size:13px;color:var(--text-secondary);margin:0;line-height:1.5;">${escHtml(r.text)}</p>` : ''}
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${new Date(r.created_at).toLocaleDateString('ru')}</div>
        </div>`).join('');
    } catch { el.innerHTML = ''; }
  }

  // ─── UNREAD POLL ──────────────────────────────────────────────────────────
  function startUnreadPoll() {
    if (state.isGuest) return;
    checkUnread();
    state.unreadPollTimer = setInterval(checkUnread, 30000);
  }

  async function checkUnread() {
    if (state.isGuest || !state.user) return;
    try {
      const { count } = await StorageService.apiRequest('/chat/unread');
      const dot = document.getElementById('chat-unread-dot');
      const badge = document.getElementById('unread-badge');
      if (dot) dot.style.display = count > 0 ? 'block' : 'none';
      if (badge) {
        badge.style.display = count > 0 ? 'flex' : 'none';
        badge.textContent = count;
      }
    } catch {}
  }

  // ─── CALCULATOR ───────────────────────────────────────────────────────────
  function showCalcStep(n) {
    document.querySelectorAll('.calc-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === n);
    });
    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById('dot-' + i);
      if (!dot) continue;
      dot.classList.toggle('active', i === n);
      dot.classList.toggle('done', i < n);
    }
  }

  function getPrice(key, fallback = 0) {
    const v = state.prices[key];
    return (v !== undefined && v !== null) ? Number(v) : fallback;
  }

  // ─── CALCULATE SPEC (server-side via pricing_engine) ─────────────────────
  async function calcSpecFromServer(params) {
    try {
      const data = await StorageService.apiRequest('/prices');
      // Use local pricing_engine logic mirrored from server
      return calcSpecLocal(params, data);
    } catch {
      return calcSpecLocal(params, state.prices);
    }
  }

  function calcSpecLocal(params, customPrices = {}) {
    return calcSpec();
  }

  function calcSpec() {
    const { area, cameraType, pkgId, options } = state.calcData;
    if (!area || !pkgId) return null;

    const camDensity = { indoor: 25, outdoor: 40, mixed: 30 };
    const density = camDensity[cameraType] || 30;
    const camQty = Math.max(2, Math.ceil(area / density));
    const nvrCh = camQty <= 4 ? 4 : camQty <= 8 ? 8 : 16;
    const storageDays = { budget: 7, standard: 14, premium: 30 };
    const gbPerCamDay = { budget: 6, standard: 10, premium: 16 };
    const totalGb = camQty * gbPerCamDay[pkgId] * storageDays[pkgId];
    const hddSize = totalGb <= 1000 ? '1tb' : totalGb <= 2000 ? '2tb' : '4tb';

    const isWireless = options.wireless || false;
    const cableM = isWireless ? 0 : Math.ceil(Math.sqrt(area) * camQty * 1.4);

    const camPrice   = getPrice(`pkg_${pkgId}_cam`, pkgId === 'budget' ? 2050 : pkgId === 'standard' ? 4180 : 9110);
    const nvrPrice   = getPrice(`nvr_${nvrCh}ch`, nvrCh === 4 ? 4190 : nvrCh === 8 ? 6700 : 11620);
    const hddPrice   = getPrice(`hdd_${hddSize}`, hddSize === '1tb' ? 2980 : hddSize === '2tb' ? 5120 : 8560);
    const installPer = isWireless
      ? getPrice('wifi_install_per_point', 1116) + getPrice('install_per_cam', 1674)
      : getPrice('install_per_cam', 1674);
    const cablePrice = getPrice('cable_per_meter', 33);
    const basePrice  = getPrice('install_base', 3260);

    const camTotal     = camQty * camPrice;
    const nvrTotal     = nvrPrice;
    const hddTotal     = hddPrice;
    const cableTotal   = cableM * cablePrice;
    const installTotal = basePrice + camQty * installPer;

    let extraItems = [];

    if (isWireless) {
      const pts = Math.max(1, Math.ceil(camQty / 3));
      const provider = options.wifiProvider || 'tplink';
      const wPrice = provider === 'ubiquiti' ? getPrice('wifi_bridge', 4650) : getPrice('wifi_extender', 2790);
      const wLabel = provider === 'ubiquiti' ? 'Ubiquiti Bullet M2' : 'TP-Link EAP225-Outdoor';
      extraItems.push({ icon: '📡', name: `${wLabel}`, spec: `${pts} шт`, price: wPrice * pts });
    }

    if (options.solar) {
      const rc = Math.max(1, Math.ceil(camQty / 2));
      extraItems.push({ icon: '☀️', name: 'Солнечное питание', spec: `${rc} комплекта`, price: (getPrice('solar_battery_100ah', 8370) + getPrice('solar_controller', 3720)) * rc });
    }

    if (options.ups) {
      const upsKey = camQty <= 4 ? 'ups' : camQty <= 8 ? 'ups_8cam' : 'ups_16cam';
      const upsDef = camQty <= 4 ? 4190 : camQty <= 8 ? 6980 : 11160;
      extraItems.push({ icon: '🔋', name: `ИБП 12V DC (${camQty <= 4 ? '4' : camQty <= 8 ? '8' : '16'} кам.)`, spec: 'APC/Powercom', price: getPrice(upsKey, upsDef) });
    }

    if (options.soundRecord) extraItems.push({ icon: '🎤', name: 'Микрофоны', spec: `${camQty} шт`, price: camQty * 744 });
    if (options.hasInternet) extraItems.push({ icon: '🌐', name: '4G-роутер', spec: '1 шт', price: getPrice('internet_router', 2980) });
    if (options.maintenance) extraItems.push({ icon: '🛠️', name: 'ТО (ежемес.)', spec: 'Ежемесячно', price: getPrice('service_basic', 1395) });

    const extrasTotal = extraItems.reduce((s, e) => s + e.price, 0);
    const discountBase = pkgId === 'standard' ? getPrice('discount_standard', 465) * camQty / 4
                       : pkgId === 'premium'  ? getPrice('discount_premium',  1395) * camQty / 4 : 0;
    const discount = Math.floor(discountBase);
    const total = camTotal + nvrTotal + hddTotal + cableTotal + installTotal + extrasTotal - discount;

    const pkgNames  = { budget: 'ЭКОНОМ', standard: 'СТАНДАРТ', premium: 'ПРЕМИУМ' };
    const pkgColors = { budget: '#00ff94', standard: '#00d4ff', premium: '#ffd700' };

    return {
      camQty, nvrCh, hddSize, cableM, camPrice, nvrPrice, hddPrice,
      cableTotal, installTotal, extrasTotal, discount, total,
      pkgName: pkgNames[pkgId], pkgColor: pkgColors[pkgId],
      items: [
        { icon: '📷', name: `Камеры ${pkgNames[pkgId]}`, spec: `${camQty} шт × ${camPrice.toLocaleString('ru')} ₽`, price: camTotal },
        { icon: '📼', name: `NVR ${nvrCh}-кан.`, spec: '1 шт', price: nvrTotal },
        { icon: '💾', name: `HDD ${hddSize.replace('tb',' ТБ')} WD Purple`, spec: `${storageDays[pkgId]} дней`, price: hddTotal },
        ...(cableM > 0 ? [{ icon: '🔌', name: 'Кабельная разводка', spec: `~${cableM} м Cat5e`, price: cableTotal }] : []),
        { icon: '🔧', name: isWireless ? 'Монтаж (беспроводной)' : 'Монтаж и настройка', spec: `База + ${camQty} точек`, price: installTotal },
        ...extraItems,
      ],
      discount,
    };
  }

  function renderSpec(spec) {
    const list    = document.getElementById('result-items');
    const summary = document.getElementById('result-summary');
    if (!list || !summary || !spec) return;

    list.innerHTML = spec.items.map(it => `
      <div class="invoice-row animate-in">
        <div class="invoice-row-icon">${it.icon}</div>
        <div class="invoice-row-body">
          <div class="invoice-row-name">${it.name}</div>
          <div class="invoice-row-spec">${it.spec}</div>
        </div>
        <div class="invoice-row-price-col">
          <div class="invoice-row-price">${it.price.toLocaleString('ru')} ₽</div>
        </div>
      </div>`).join('');

    const promoLine = state.promoDiscount > 0
      ? `<div class="discount-row"><span class="discount-label">🎟️ Промокод</span><span class="discount-value">−${state.promoDiscount.toLocaleString('ru')} ₽</span></div>`
      : '';

    const finalTotal = spec.total - (state.promoDiscount || 0);

    summary.innerHTML = `
      ${spec.discount > 0 ? `<div class="discount-row"><span class="discount-label">🎁 Скидка ${spec.pkgName}</span><span class="discount-value">−${spec.discount.toLocaleString('ru')} ₽</span></div>` : ''}
      ${promoLine}
      <div class="total-row total-final">
        <span class="total-label" style="color:${spec.pkgColor}">ИТОГО ПОД КЛЮЧ</span>
        <span class="total-value" style="font-size:26px;color:${spec.pkgColor}">${finalTotal.toLocaleString('ru')} ₽</span>
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--text-muted);">
        Площадь: ${state.calcData.area} м² · Камер: ${spec.camQty} шт · NVR: ${spec.nvrCh}CH
      </div>`;
  }

  function runScanningAnimation(cb) {
    const overlay = document.getElementById('scanning-overlay');
    const bar  = document.getElementById('scanning-progress');
    const txt  = document.getElementById('scanning-text');
    const steps = ['Анализируем площадь...', 'Подбираем оборудование...', 'Рассчитываем монтаж...', 'Формируем смету...'];
    if (!overlay) { cb(); return; }
    overlay.style.display = 'flex';
    if (bar) bar.style.width = '0%';
    let step = 0;
    const advance = () => {
      if (step >= steps.length) { overlay.style.display = 'none'; cb(); return; }
      if (txt) txt.textContent = steps[step];
      if (bar) bar.style.width = ((step + 1) / steps.length * 100) + '%';
      step++;
      setTimeout(advance, 500);
    };
    setTimeout(advance, 100);
  }

  // ─── PROMO CODE ───────────────────────────────────────────────────────────
  async function applyPromo() {
    const input  = document.getElementById('promo-input');
    const result = document.getElementById('promo-result');
    const code   = input?.value.trim().toUpperCase();
    if (!code) { showToast('Введите промокод', 'error'); return; }

    const btn = document.getElementById('btn-apply-promo');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      const data = await StorageService.apiRequest('/promo/validate', 'POST', { code });
      const discount = data.type === 'percent'
        ? Math.floor((state.calcData.spec?.total || 0) * data.discount / 100)
        : data.discount;
      state.promoDiscount = discount;
      state.promoCode = code;
      if (result) {
        result.style.display = 'block';
        result.style.color = 'var(--accent-2)';
        result.textContent = `✅ Промокод применён! Скидка: −${discount.toLocaleString('ru')} ₽`;
      }
      renderSpec(state.calcData.spec);
      showToast('Промокод применён!', 'success');
    } catch (e) {
      state.promoDiscount = 0;
      state.promoCode = null;
      if (result) {
        result.style.display = 'block';
        result.style.color = '#ff4444';
        result.textContent = e.message || 'Промокод недействителен';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Применить'; }
    }
  }

  // ─── ORDER SUBMIT ─────────────────────────────────────────────────────────
  async function submitOrder() {
    if (state.isGuest) {
      showToast('Войдите через Telegram чтобы оформить заявку', 'warning');
      setTimeout(() => showScreen('auth'), 1500);
      return;
    }
    const user = state.user;
    if (!user || !user.phone) {
      showToast('Укажите номер телефона в профиле!', 'error');
      setTimeout(() => showScreen('profile'), 1500);
      return;
    }
    const spec = state.calcData.spec;
    if (!spec) { showToast('Сначала выполните расчёт', 'error'); return; }

    const orderId = 'GZ' + Date.now().toString(36).toUpperCase();
    const orderData = {
      id: orderId,
      area: state.calcData.area,
      camera_type: state.calcData.cameraType,
      package_id: state.calcData.pkgId,
      options: state.calcData.options,
      spec: spec,
      total_price: spec.total,
      address: user.address || '',
      promo_code: state.promoCode || null,
    };

    const btn = document.getElementById('btn-calc3-order');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Отправляем...'; }

    try {
      await StorageService.submitOrder(orderData);
      state.user.order_count = (state.user.order_count || 0) + 1;
      state.lastOrderId = orderId;

      const successEl   = document.getElementById('order-success');
      const orderIdEl   = document.getElementById('order-id-display');
      const footerActions = document.querySelector('#calc-step-3 .step-footer-actions');

      if (successEl) successEl.classList.add('show');
      if (orderIdEl) orderIdEl.textContent = '#' + orderId;
      if (footerActions) footerActions.style.display = 'none';

      // Show support nav
      const suppNav = document.getElementById('nav-support');
      if (suppNav) suppNav.style.display = 'flex';

      showToast('✅ Заявка отправлена!', 'success', 4000);
      TelegramService.Haptic.notification('success');
    } catch (e) {
      showToast('Ошибка: ' + (e.message || 'Попробуйте ещё раз'), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '📩 Отправить заявку'; }
    }
  }

  // ─── REVIEWS ─────────────────────────────────────────────────────────────
  function initStarRating() {
    document.querySelectorAll('.star-btn').forEach(star => {
      star.addEventListener('click', () => {
        const rating = parseInt(star.dataset.rating);
        state.selectedRating = rating;
        document.querySelectorAll('.star-btn').forEach((s, i) => {
          s.style.opacity = i < rating ? '1' : '0.3';
        });
        const submitBtn = document.getElementById('btn-submit-review');
        if (submitBtn) submitBtn.disabled = false;
        TelegramService.Haptic.selection();
      });
    });
  }

  async function submitReview() {
    if (!state.selectedRating) { showToast('Выберите оценку', 'error'); return; }
    const text   = document.getElementById('review-text')?.value.trim() || '';
    const btn    = document.getElementById('btn-submit-review');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Отправляем...'; }
    try {
      await StorageService.apiRequest('/reviews', 'POST', {
        order_id: state.lastOrderId,
        rating: state.selectedRating,
        text
      });
      document.getElementById('review-prompt').innerHTML = '<div style="text-align:center;padding:12px;color:var(--accent-2);font-size:14px;">✅ Спасибо за отзыв!</div>';
      showToast('Отзыв отправлен!', 'success');
    } catch (e) {
      showToast('Ошибка: ' + (e.message || 'Попробуйте позже'), 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Отправить отзыв'; }
    }
  }

  // ─── PROFILE ─────────────────────────────────────────────────────────────
  async function renderProfile() {
    const u = state.user;
    if (!u) return;

    const guestBanner = document.getElementById('guest-banner');
    if (guestBanner) guestBanner.style.display = state.isGuest ? 'block' : 'none';

    const name     = u.full_name || u.username || 'Пользователь';
    const initials = name.split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase() || 'П';

    setEl('profile-initials', initials);
    setEl('profile-display-name', name);
    setEl('profile-display-email', u.email || (u.username ? '@' + u.username : 'Telegram пользователь'));
    setEl('profile-stat-orders', u.order_count || 0);
    setEl('profile-stat-bonus', (u.bonus_balance || 0).toLocaleString('ru'));

    const orders       = u.order_count || 0;
    const clientStatus = orders >= 5 ? 'VIP' : orders >= 2 ? 'Постоянный' : 'Базовый';
    setEl('profile-client-status', clientStatus);

    const vipBadge = document.getElementById('vip-badge');
    if (vipBadge) vipBadge.style.display = clientStatus === 'VIP' ? 'inline-block' : 'none';

    const chatBtn = document.getElementById('chat-engineer-btn-wrap');
    if (chatBtn) chatBtn.style.display = orders > 0 ? 'block' : 'none';

    setEl('profile-row-name', u.full_name || '—');
    setEl('profile-row-email', u.email || '—');

    const phoneEl = document.getElementById('profile-row-phone');
    if (phoneEl) {
      phoneEl.textContent = u.phone || 'Не указан — нажмите чтобы добавить';
      phoneEl.classList.toggle('placeholder', !u.phone);
    }
    const addrEl = document.getElementById('profile-row-address');
    if (addrEl) {
      addrEl.textContent = u.address || 'Не указан';
      addrEl.classList.toggle('placeholder', !u.address);
    }

    // Notification toggles
    const notifyOrders = document.getElementById('notify-orders-input');
    const notifyPromos = document.getElementById('notify-promos-input');
    if (notifyOrders) notifyOrders.checked = u.notify_orders !== 0;
    if (notifyPromos) notifyPromos.checked = u.notify_promos !== 0;

    // Fill edit form
    const editName  = document.getElementById('edit-name');
    const editPhone = document.getElementById('edit-phone');
    const editEmail = document.getElementById('edit-email');
    const editAddr  = document.getElementById('edit-address');
    if (editName)  editName.value  = u.full_name || '';
    if (editPhone) editPhone.value = u.phone     || '';
    if (editEmail) editEmail.value = u.email     || '';
    if (editAddr)  editAddr.value  = u.address   || '';

    loadOrderHistory();
    if (!state.isGuest) loadReferralData();
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  async function loadOrderHistory() {
    const listEl = document.getElementById('order-history-list');
    if (!listEl || state.isGuest) return;
    try {
      const orders = await StorageService.getOrderHistory();
      if (!orders.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">У вас пока нет заказов</div>';
        return;
      }
      const statusMap = { new: '🆕 Новая', processing: '⚙️ В работе', done: '✅ Выполнена', cancelled: '❌ Отменена' };
      listEl.innerHTML = orders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
        return `
          <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:14px;animation:riseUp 0.3s ease both;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:700;color:var(--accent);">#${o.id}</span>
              <span style="font-size:11px;color:var(--text-muted);">${date}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:13px;color:var(--text-secondary);">${statusMap[o.status] || o.status}</span>
              <span style="font-size:15px;font-weight:700;color:var(--text-primary);">${Number(o.total_price).toLocaleString('ru')} ₽</span>
            </div>
            ${o.status_note ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">💬 ${escHtml(o.status_note)}</div>` : ''}
          </div>`;
      }).join('');
    } catch {}
  }

  async function loadReferralData() {
    try {
      const data = await StorageService.getReferralData();
      if (!data) return;
      setEl('ref-code-display', data.code || 'GAZE-XXXX');
      setEl('ref-bonus-display', (data.balance || 0).toLocaleString('ru'));

      const secEl  = document.getElementById('ref-invites-section');
      const listEl = document.getElementById('ref-invites-list');
      if (data.invites && data.invites.length > 0 && secEl && listEl) {
        secEl.style.display = 'block';
        listEl.innerHTML = data.invites.map(inv => `
          <div class="invite-pill">
            <span style="font-size:13px;">${escHtml(inv.full_name || 'Пользователь')}</span>
            <span style="font-size:11px;color:var(--text-muted);">${new Date(inv.created_at).toLocaleDateString('ru')}</span>
          </div>`).join('');
      }
    } catch {}
  }

  async function saveProfile() {
    const full_name = document.getElementById('edit-name')?.value.trim()    || '';
    const phone     = document.getElementById('edit-phone')?.value.trim()   || '';
    const email     = document.getElementById('edit-email')?.value.trim()   || '';
    const address   = document.getElementById('edit-address')?.value.trim() || '';

    if (!full_name) { showToast('Введите ФИО', 'error'); return; }

    const btn = document.getElementById('btn-save-profile');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Сохраняем...'; }

    try {
      const updated = await StorageService.updateUserProfile({ full_name, phone, email, address });
      state.user = updated;
      renderProfile();
      document.getElementById('profile-edit-view').style.display = 'none';
      document.getElementById('profile-main-view').style.display = 'flex';
      document.getElementById('profile-main-view').style.flexDirection = 'column';
      showToast('✅ Профиль сохранён', 'success');
      TelegramService.Haptic.notification('success');
    } catch (e) {
      showToast('Ошибка: ' + (e.message || 'Попробуйте позже'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Сохранить'; }
    }
  }

  async function saveNotificationPrefs() {
    if (state.isGuest) return;
    const notify_orders = document.getElementById('notify-orders-input')?.checked ? 1 : 0;
    const notify_promos = document.getElementById('notify-promos-input')?.checked ? 1 : 0;
    try {
      await StorageService.apiRequest('/user/notifications', 'PUT', { notify_orders, notify_promos });
      state.user.notify_orders = notify_orders;
      state.user.notify_promos = notify_promos;
      showToast('Настройки уведомлений сохранены', 'success');
    } catch { showToast('Ошибка сохранения', 'error'); }
  }

  // ─── ADMIN ────────────────────────────────────────────────────────────────
  async function loadAdminStats() {
    const u = state.user;
    if (!u || u.role !== 'admin') { showScreen('home'); return; }

    try {
      const stats = await StorageService.getAdminStats();
      const container = document.getElementById('admin-stats-container');
      if (container) {
        const avgRating = stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : '—';
        container.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            ${[
              ['💰 Выручка', (stats.total_revenue || 0).toLocaleString('ru') + ' ₽'],
              ['📦 Заказы', stats.total_orders || 0],
              ['👥 Пользователи', stats.total_users || 0],
              ['🆕 За неделю', stats.recent_orders || 0],
              ['⏳ Ожидают', stats.pending_orders || 0],
              ['⭐ Рейтинг', avgRating + ` (${stats.total_reviews || 0})`],
            ].map(([l, v]) => `
              <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:16px;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${l}</div>
                <div style="font-size:20px;font-weight:800;color:var(--accent);">${v}</div>
              </div>`).join('')}
          </div>`;
      }

      if (stats.history && stats.history.length && typeof Chart !== 'undefined') {
        const ctx = document.getElementById('adminRevenueChart');
        if (ctx) {
          if (state.adminChart) state.adminChart.destroy();
          state.adminChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: stats.history.map(h => h.date),
              datasets: [{ label: 'Выручка ₽', data: stats.history.map(h => h.revenue || 0),
                backgroundColor: 'rgba(0,212,255,0.3)', borderColor: 'rgba(0,212,255,0.8)', borderWidth: 1, borderRadius: 4 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } },
              scales: { x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
          });
        }
      }

      loadAdminLogs();
    } catch (e) { showToast('Ошибка загрузки статистики', 'error'); }
  }

  async function loadAdminOrders(filterStatus = '') {
    state.adminOrderFilter = filterStatus;
    try {
      const url = filterStatus ? `/admin/orders?status=${filterStatus}` : '/admin/orders';
      const orders = await StorageService.apiRequest(url);
      const el = document.getElementById('admin-orders-list');
      if (!el) return;
      if (!orders.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Заказов нет</p>'; return; }
      el.innerHTML = orders.map(o => `
        <div class="admin-order-card" style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--accent);">#${o.id}</span>
            <select onchange="App.updateOrderStatus('${o.id}', this.value)"
              style="background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--glass-border);border-radius:8px;padding:4px 8px;font-size:12px;">
              ${['new','processing','done','cancelled'].map(s =>
                `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div style="font-size:13px;margin-bottom:4px;">👤 ${escHtml(o.full_name || '—')}</div>
          <div style="font-size:12px;color:var(--text-muted);">📞 ${escHtml(o.phone || '—')} | 📧 ${escHtml(o.email || '—')}</div>
          ${o.address ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">📍 ${escHtml(o.address)}</div>` : ''}
          <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:8px;">${Number(o.total_price).toLocaleString('ru')} ₽</div>
          <div style="margin-top:8px;">
            <input type="text" id="note-${o.id}" placeholder="Заметка для клиента..." value="${escHtml(o.status_note||'')}"
              style="width:100%;background:var(--bg-primary);color:white;border:1px solid var(--glass-border);border-radius:8px;padding:6px 10px;font-size:12px;box-sizing:border-box;">
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${new Date(o.created_at).toLocaleString('ru')}</div>
        </div>`).join('');
    } catch {}
  }

  async function updateOrderStatus(orderId, status) {
    const note = document.getElementById(`note-${orderId}`)?.value || '';
    try {
      await StorageService.updateOrderStatus(orderId, status, note);
      showToast('Статус обновлён', 'success');
    } catch { showToast('Ошибка', 'error'); }
  }

  async function loadAdminUsers(search = '') {
    try {
      const url = search ? `/admin/users?search=${encodeURIComponent(search)}` : '/admin/users';
      const users = await StorageService.apiRequest(url);
      const el = document.getElementById('admin-users-list');
      if (!el) return;
      if (!users.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Клиентов нет</p>'; return; }
      el.innerHTML = users.map(u => `
        <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;">${escHtml(u.full_name||'—')} ${u.role==='admin'?'<span style="font-size:10px;background:rgba(255,215,0,0.2);color:#ffd700;padding:2px 6px;border-radius:8px;margin-left:4px;">ADMIN</span>':''}</span>
            <span style="font-size:11px;color:var(--text-muted);">${u.order_count || 0} зак.</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">📞 ${escHtml(u.phone||'—')} | ID: ${u.tg_id || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted);">💰 Бонусы: ${u.bonus_balance || 0} ₽</div>
          ${u.is_blocked ? `<div style="font-size:12px;color:#ff4444;margin-top:4px;">🚫 Заблокирован</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:10px;">
            ${u.is_blocked
              ? `<button onclick="App.unblockUser(${u.id})" style="background:rgba(0,255,148,0.1);border:1px solid rgba(0,255,148,0.3);color:#00ff94;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">Разблокировать</button>`
              : `<button onclick="App.blockUser(${u.id})" style="background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);color:#ff4444;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">Заблокировать</button>`
            }
          </div>
        </div>`).join('');
    } catch {}
  }

  async function blockUser(userId) {
    const reason = prompt('Причина блокировки:') || '';
    try {
      await StorageService.apiRequest('/admin/users/block', 'POST', { userId, reason });
      showToast('Пользователь заблокирован', 'success');
      loadAdminUsers();
    } catch { showToast('Ошибка', 'error'); }
  }

  async function unblockUser(userId) {
    try {
      await StorageService.apiRequest('/admin/users/unblock', 'POST', { userId });
      showToast('Пользователь разблокирован', 'success');
      loadAdminUsers();
    } catch { showToast('Ошибка', 'error'); }
  }

  async function loadAdminPrices() {
    try {
      const prices = await StorageService.getPrices();
      const el = document.getElementById('admin-prices-list');
      if (!el) return;
      el.innerHTML = Object.entries(prices).map(([k, v]) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="flex:1;font-size:12px;color:var(--text-secondary);">${k}</span>
          <input type="number" value="${v}" data-price-key="${k}"
            style="width:80px;background:var(--bg-card);color:white;border:1px solid var(--glass-border);border-radius:8px;padding:4px 8px;font-size:13px;text-align:right;"
            onchange="App.updatePrice('${k}', this.value)">
        </div>`).join('');
    } catch {}
  }

  async function updatePrice(key, value) {
    try {
      await StorageService.apiRequest('/admin/prices', 'POST', { key, value: Number(value) });
      state.prices[key] = Number(value);
      showToast('Цена обновлена', 'success');
    } catch { showToast('Ошибка', 'error'); }
  }

  async function loadAdminPromo() {
    try {
      const promos = await StorageService.apiRequest('/admin/promo');
      const el = document.getElementById('admin-promo-list');
      if (!el) return;
      if (!promos.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Промокодов нет</p>'; return; }
      el.innerHTML = promos.map(p => `
        <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-family:monospace;font-size:14px;font-weight:700;color:var(--accent);">${escHtml(p.code)}</span>
            <span style="font-size:13px;font-weight:600;color:var(--accent-gold);">${p.discount}${p.type==='percent'?'%':' ₽'}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            Исп: ${p.uses}/${p.max_uses}
            ${p.expires_at ? ` | До: ${new Date(p.expires_at).toLocaleDateString('ru')}` : ''}
          </div>
        </div>`).join('');
    } catch {}
  }

  async function createPromo() {
    const code      = document.getElementById('new-promo-code')?.value.trim().toUpperCase();
    const discount  = parseInt(document.getElementById('new-promo-discount')?.value || 0);
    const type      = document.getElementById('new-promo-type')?.value || 'fixed';
    const max_uses  = parseInt(document.getElementById('new-promo-uses')?.value || 1);
    const expires_at = document.getElementById('new-promo-expires')?.value || null;

    if (!code || !discount) { showToast('Заполните код и скидку', 'error'); return; }
    try {
      await StorageService.apiRequest('/admin/promo', 'POST', { code, discount, type, max_uses, expires_at });
      showToast('Промокод создан!', 'success');
      document.getElementById('new-promo-code').value = '';
      document.getElementById('new-promo-discount').value = '';
      loadAdminPromo();
    } catch (e) { showToast(e.message || 'Ошибка', 'error'); }
  }

  async function sendBroadcast() {
    const text   = document.getElementById('broadcast-text')?.value.trim();
    const target = document.getElementById('broadcast-target')?.value || 'all';
    const result = document.getElementById('broadcast-result');
    if (!text) { showToast('Введите текст сообщения', 'error'); return; }

    const btn = document.getElementById('btn-send-broadcast');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Отправляем...'; }

    try {
      const data = await StorageService.apiRequest('/admin/broadcast', 'POST', { text, target });
      if (result) {
        result.style.display = 'block';
        result.style.color = 'var(--accent-2)';
        result.textContent = `✅ Отправлено: ${data.sent}, не доставлено: ${data.failed}`;
      }
      showToast(`Отправлено ${data.sent} сообщений`, 'success');
    } catch (e) {
      showToast(e.message || 'Ошибка', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📤 Отправить рассылку'; }
    }
  }

  async function loadAdminReviews() {
    try {
      const reviews = await StorageService.apiRequest('/admin/reviews');
      const el = document.getElementById('admin-reviews-list');
      if (!el) return;
      if (!reviews.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Отзывов нет</p>'; return; }
      el.innerHTML = reviews.map(r => `
        <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:12px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;">${escHtml(r.full_name||'Клиент')}</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span>${'⭐'.repeat(r.rating)}</span>
              <button onclick="App.toggleReview(${r.id}, ${r.is_public})"
                style="font-size:11px;border-radius:6px;padding:3px 8px;cursor:pointer;background:${r.is_public?'rgba(255,68,68,0.1)':'rgba(0,255,148,0.1)'};border:1px solid ${r.is_public?'rgba(255,68,68,0.3)':'rgba(0,255,148,0.3)'};color:${r.is_public?'#ff4444':'#00ff94'};">
                ${r.is_public ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>
          ${r.text ? `<p style="font-size:12px;color:var(--text-secondary);margin:0 0 4px;">${escHtml(r.text)}</p>` : ''}
          <div style="font-size:11px;color:var(--text-muted);">${new Date(r.created_at).toLocaleDateString('ru')}</div>
        </div>`).join('');
    } catch {}
  }

  async function toggleReview(id, currentPublic) {
    try {
      await StorageService.apiRequest(`/admin/reviews/${id}`, 'PUT', { is_public: !currentPublic });
      showToast('Статус отзыва изменён', 'success');
      loadAdminReviews();
    } catch { showToast('Ошибка', 'error'); }
  }

  async function loadAdminLogs() {
    try {
      const logs = await StorageService.apiRequest('/admin/logs?limit=20');
      const el = document.getElementById('admin-logs-list');
      if (!el) return;
      if (!logs.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:10px;">Логов нет</p>'; return; }
      el.innerHTML = logs.map(l => `
        <div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;">
          <span style="color:${l.level==='error'?'#ff4444':l.level==='warn'?'#ffa500':'var(--accent)'};">[${l.level}]</span>
          <span style="color:var(--text-secondary);margin-left:6px;">${escHtml(l.message)}</span>
          <span style="color:var(--text-muted);margin-left:auto;display:block;">${new Date(l.created_at).toLocaleString('ru')}</span>
        </div>`).join('');
    } catch {}
  }

  // ─── CHAT ─────────────────────────────────────────────────────────────────
  async function loadChatMessages() {
    if (state.isGuest) return;
    const msgsEl = document.getElementById('support-chat-messages');
    if (!msgsEl) return;
    try {
      const msgs = await StorageService.apiRequest('/chat');
      if (msgs && msgs.length) {
        msgsEl.innerHTML = msgs.map(m => `
          <div class="chat-msg ${m.sender === 'user' ? 'user' : 'admin'}"
            style="align-self:${m.sender==='user'?'flex-end':'flex-start'};background:${m.sender==='user'?'rgba(0,212,255,0.15)':'var(--bg-card)'};border-radius:${m.sender==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px'};padding:10px 14px;max-width:80%;">
            ${escHtml(m.text)}
          </div>`).join('');
        msgsEl.scrollTop = msgsEl.scrollHeight;
        // Reset unread badge
        const dot = document.getElementById('chat-unread-dot');
        if (dot) dot.style.display = 'none';
      }
    } catch {}
  }

  async function sendChatMessage() {
    if (state.isGuest) { showToast('Войдите через Telegram', 'warning'); return; }
    const input = document.getElementById('support-input');
    const text  = input?.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await StorageService.apiRequest('/chat', 'POST', { text });
      setTimeout(loadChatMessages, 1300);
    } catch {}
  }

  // ─── PRO MODE ─────────────────────────────────────────────────────────────
  function initProMode() {
    const proItems = {
      cameras: [
        { id: 'pro_cam_2mp_bullet', name: '2МП Bullet', desc: '1080p, ИК 30м, IP67', priceKey: 'pro_cam_2mp_bullet', def: 2800 },
        { id: 'pro_cam_4mp_dome',   name: '4МП Dome',   desc: '2K, ИК 40м, PoE',     priceKey: 'pro_cam_4mp_dome',   def: 4200 },
        { id: 'pro_cam_8mp_bullet', name: '8МП Bullet', desc: '4K Ultra HD, ИК 60м',  priceKey: 'pro_cam_8mp_bullet', def: 8900 },
        { id: 'pro_cam_ptz',        name: 'PTZ',        desc: '4K, Zoom ×25, авто',   priceKey: 'pro_cam_ptz',        def: 14500 },
      ],
      dvr: [
        { id: 'pro_nvr_4ch',  name: 'NVR 4-кан.',  priceKey: 'pro_nvr_4ch',  def: 4500 },
        { id: 'pro_nvr_8ch',  name: 'NVR 8-кан.',  priceKey: 'pro_nvr_8ch',  def: 7200 },
        { id: 'pro_nvr_16ch', name: 'NVR 16-кан.', priceKey: 'pro_nvr_16ch', def: 12500 },
      ],
      hdd: [
        { id: 'pro_hdd_2tb', name: 'HDD 2TB WD Purple', priceKey: 'pro_hdd_2tb', def: 5500 },
        { id: 'pro_hdd_4tb', name: 'HDD 4TB WD Purple', priceKey: 'pro_hdd_4tb', def: 9200 },
      ],
    };

    const renderList = (containerId, items) => {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = items.map(item => {
        const price = getPrice(item.priceKey, item.def);
        return `
          <div class="pro-item" style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px;">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;">${item.name}</div>
              ${item.desc ? `<div style="font-size:11px;color:var(--text-muted);">${item.desc}</div>` : ''}
              <div style="font-size:13px;color:var(--accent);margin-top:4px;">${price.toLocaleString('ru')} ₽</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button onclick="App.proQty('${item.id}', -1)" style="width:28px;height:28px;border-radius:50%;background:var(--bg-secondary);border:1px solid var(--glass-border);color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>
              <span id="pro-qty-${item.id}" style="font-size:14px;font-weight:700;min-width:20px;text-align:center;">0</span>
              <button onclick="App.proQty('${item.id}', 1)"  style="width:28px;height:28px;border-radius:50%;background:var(--accent-dim);border:1px solid var(--accent);color:var(--accent);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
            </div>
          </div>`;
      }).join('');
    };

    renderList('pro-cameras-list', proItems.cameras);
    renderList('pro-dvr-list', proItems.dvr);
    renderList('pro-hdd-list', proItems.hdd);

    state._proItems = proItems;
    updateProTotal();
  }

  function proQty(itemId, delta) {
    if (!state._proItems) return;
    const all = [...(state._proItems.cameras||[]), ...(state._proItems.dvr||[]), ...(state._proItems.hdd||[])];
    const item = all.find(i => i.id === itemId);
    if (!item) return;
    const existing = state.proCart.find(c => c.id === itemId);
    if (existing) {
      existing.qty = Math.max(0, existing.qty + delta);
      if (existing.qty === 0) state.proCart = state.proCart.filter(c => c.id !== itemId);
    } else if (delta > 0) {
      state.proCart.push({ id: itemId, name: item.name, price: getPrice(item.priceKey, item.def), qty: 1 });
    }
    const qtyEl = document.getElementById(`pro-qty-${itemId}`);
    if (qtyEl) qtyEl.textContent = state.proCart.find(c => c.id === itemId)?.qty || 0;
    updateProTotal();
    TelegramService.Haptic.selection();
  }

  function updateProTotal() {
    const total  = state.proCart.reduce((s, i) => s + i.price * i.qty, 0);
    const camQty = state.proCart
      .filter(i => i.id.startsWith('pro_cam'))
      .reduce((s, i) => s + i.qty, 0);
    setEl('pro-total-price', total.toLocaleString('ru') + ' ₽');
    setEl('pro-cam-qty', camQty);
  }

  function addProToCart() {
    if (!state.proCart.length) { showToast('Добавьте хотя бы одну позицию', 'error'); return; }
    const total    = state.proCart.reduce((s, i) => s + i.price * i.qty, 0);
    const installC = getPrice('install_base', 3500) + state.proCart
      .filter(i => i.id.startsWith('pro_cam'))
      .reduce((s, i) => s + i.qty, 0) * getPrice('install_per_cam', 1800);

    state.calcData.spec = { total: total + installC, items: state.proCart, discount: 0, pkgColor: '#ffd700', pkgName: 'РУЧНОЙ' };
    state.calcData.totalPrice = total + installC;
    state.calcData.pkgId = state.calcData.pkgId || 'custom';

    renderSpec(state.calcData.spec);
    document.getElementById('pro-mode-panel').style.display = 'none';
    showToast('✅ Добавлено в спецификацию', 'success');
    TelegramService.Haptic.notification('success');
  }

  // ─── MAP ──────────────────────────────────────────────────────────────────
  function openMap() {
    const mapView = document.getElementById('full-map-view');
    if (!mapView) return;
    mapView.style.display = 'flex';
    mapView.style.flexDirection = 'column';
    if (typeof ymaps === 'undefined') {
      document.getElementById('map-selection-info').textContent = 'Карта недоступна. Введите адрес вручную.';
      return;
    }
    if (state.mapInstance) return;
    ymaps.ready(() => {
      state.mapInstance = new ymaps.Map('big-map', { center: [55.75, 37.57], zoom: 11, controls: ['zoomControl', 'searchControl'] });
      state.mapInstance.events.add('click', (e) => {
        const coords = e.get('coords');
        state.selectedMapCoords = coords;
        ymaps.geocode(coords).then(res => {
          const addr = res.geoObjects.get(0)?.getAddressLine() || coords.join(', ');
          document.getElementById('map-selection-info').textContent = addr;
          state.selectedAddress = addr;
        });
      });
    });
  }

  function confirmMapAddress() {
    if (state.selectedAddress) {
      const editAddr = document.getElementById('edit-address');
      if (editAddr) editAddr.value = state.selectedAddress;
      document.getElementById('full-map-view').style.display = 'none';
    } else {
      showToast('Нажмите на карту, чтобы выбрать адрес', 'warning');
    }
  }

  // ─── PKG PREVIEW ──────────────────────────────────────────────────────────
  function renderPkgPreview(pkgId) {
    const el = document.getElementById('pkg-preview');
    if (!el || !pkgId) return;
    const previews = {
      budget:   { color: '#00ff94', icon: '🛡️', desc: 'Базовое FullHD наблюдение. Надёжность без переплат.' },
      standard: { color: '#00d4ff', icon: '👁️', desc: '4МП, расширенный архив 14 дней, PoE инфраструктура.' },
      premium:  { color: '#ffd700', icon: '⭐', desc: '4K Ultra HD, ИК до 60м, аналитика и 30 дней архива.' },
    };
    const p = previews[pkgId];
    if (!p) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <div class="visual-guide-panel" style="border-color:${p.color}22;background:${p.color}08;margin-bottom:16px;">
        <div style="font-size:22px;margin-bottom:6px;">${p.icon}</div>
        <p style="font-size:13px;color:var(--text-secondary);margin:0;">${p.desc}</p>
      </div>`;
  }

  // ─── UTIL ─────────────────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── BIND EVENTS ──────────────────────────────────────────────────────────
  function bindEvents() {

    // Landing
    document.getElementById('btn-landing-start')?.addEventListener('click', () => {
      if (TelegramService.isTelegramUser()) { showScreen('auth'); doTelegramAuth(); }
      else enterAsGuest();
    });
    document.getElementById('btn-landing-guest')?.addEventListener('click', enterAsGuest);

    // Auth
    document.getElementById('btn-guest-enter')?.addEventListener('click', enterAsGuest);
    document.getElementById('btn-auth-retry')?.addEventListener('click', () => { doTelegramAuth(); });
    document.getElementById('btn-guest-link-tg')?.addEventListener('click', (e) => { e.preventDefault(); showScreen('auth'); doTelegramAuth(); });

    // Home: package cards
    ['budget','standard','premium'].forEach(pkg => {
      document.getElementById(`home-pkg-${pkg}`)?.addEventListener('click', () => {
        state.calcData.pkgId = pkg;
        showScreen('calculator');
        setTimeout(() => showCalcStep(1), 50);
      });
    });
    document.getElementById('promo-to-calc')?.addEventListener('click', () => showScreen('calculator'));

    // Calc step 1
    document.querySelectorAll('.cam-type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.cam-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.calcData.cameraType = card.dataset.type;
        TelegramService.Haptic.selection();
      });
    });

    document.querySelectorAll('.area-hint').forEach(hint => {
      hint.addEventListener('click', () => {
        const input = document.getElementById('area-input');
        if (input) { input.value = hint.dataset.val; }
        document.querySelectorAll('.area-hint').forEach(h => h.classList.remove('active'));
        hint.classList.add('active');
      });
    });

    document.getElementById('btn-calc1-next')?.addEventListener('click', () => {
      const area = parseFloat(document.getElementById('area-input')?.value);
      if (!area || area < 10) { showToast('Введите площадь (минимум 10 м²)', 'error'); return; }
      state.calcData.area = area;
      const selected = document.querySelector('.cam-type-card.selected');
      if (selected) state.calcData.cameraType = selected.dataset.type;
      showCalcStep(2);
      TelegramService.Haptic.impact('light');
    });

    // Calc step 2
    document.querySelectorAll('.pkg-card[data-pkg]').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.pkg-card[data-pkg]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.calcData.pkgId = card.dataset.pkg;
        renderPkgPreview(card.dataset.pkg);
        TelegramService.Haptic.selection();
      });
    });

    if (state.calcData.pkgId) {
      document.querySelector(`.pkg-card[data-pkg="${state.calcData.pkgId}"]`)?.classList.add('selected');
    }

    document.querySelectorAll('.option-checkbox').forEach(cb => {
      cb.addEventListener('click', () => {
        cb.classList.toggle('checked');
        const opt = cb.dataset.option;
        state.calcData.options[opt] = cb.classList.contains('checked');
        if (opt === 'hasInternet') {
          const panel = document.getElementById('internet-operators-panel');
          if (panel) panel.style.display = state.calcData.options[opt] ? 'block' : 'none';
        }
        if (opt === 'wireless') {
          const panel = document.getElementById('wifi-provider-panel');
          if (panel) panel.style.display = state.calcData.options[opt] ? 'block' : 'none';
        }
        TelegramService.Haptic.selection();
      });
    });

    // Wi-Fi provider radio buttons
    document.querySelectorAll('input[name="wifiProvider"]').forEach(radio => {
      radio.addEventListener('change', () => {
        state.calcData.options.wifiProvider = radio.value;
      });
    });

    document.getElementById('btn-calc2-back')?.addEventListener('click', () => showCalcStep(1));

    document.getElementById('btn-calc2-next')?.addEventListener('click', () => {
      if (!state.calcData.pkgId) { showToast('Выберите пакет', 'error'); return; }
      state.promoDiscount = 0;
      state.promoCode = null;
      const promoInput = document.getElementById('promo-input');
      const promoResult = document.getElementById('promo-result');
      if (promoInput) promoInput.value = '';
      if (promoResult) promoResult.style.display = 'none';

      runScanningAnimation(async () => {
        const spec = calcSpec();
        state.calcData.spec = spec;
        state.calcData.totalPrice = spec?.total || 0;
        renderSpec(spec);
        initProMode();
        initStarRating();
        showCalcStep(3);
        document.getElementById('order-success')?.classList.remove('show');
        const footerActions = document.querySelector('#calc-step-3 .step-footer-actions');
        if (footerActions) footerActions.style.display = '';
      });
    });

    // Calc step 3
    document.getElementById('btn-calc3-back')?.addEventListener('click', () => showCalcStep(2));
    document.getElementById('btn-calc3-order')?.addEventListener('click', submitOrder);
    document.getElementById('btn-new-order')?.addEventListener('click', () => {
      state.calcData = { area: null, cameraType: 'mixed', pkgId: null, options: {}, spec: null, totalPrice: 0 };
      state.proCart = [];
      state.promoDiscount = 0;
      state.promoCode = null;
      state.selectedRating = 0;
      const areaInput = document.getElementById('area-input');
      if (areaInput) areaInput.value = '';
      document.querySelectorAll('.pkg-card,.cam-type-card').forEach(c => c.classList.remove('selected'));
      document.querySelectorAll('.option-checkbox').forEach(c => c.classList.remove('checked'));
      const ipPanel = document.getElementById('internet-operators-panel');
      if (ipPanel) ipPanel.style.display = 'none';
      const wifiPanel = document.getElementById('wifi-provider-panel');
      if (wifiPanel) wifiPanel.style.display = 'none';
      showCalcStep(1);
    });

    // Promo code
    document.getElementById('btn-apply-promo')?.addEventListener('click', applyPromo);
    document.getElementById('promo-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') applyPromo();
    });

    // Reviews
    document.getElementById('btn-submit-review')?.addEventListener('click', submitReview);

    // Pro mode
    document.getElementById('btn-pro-mode')?.addEventListener('click', () => {
      const panel = document.getElementById('pro-mode-panel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('btn-pro-add-to-cart')?.addEventListener('click', addProToCart);

    document.querySelectorAll('.pro-tab[data-pro-cat]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.pro-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.pro-cat-pane').forEach(p => p.style.display = 'none');
        const pane = document.getElementById('pro-cat-' + tab.dataset.proCat);
        if (pane) pane.style.display = 'block';
      });
    });

    document.getElementById('btn-show-guide')?.addEventListener('click', () => {
      const g = document.getElementById('visual-guide');
      if (g) g.style.display = g.style.display === 'none' ? 'block' : 'none';
    });

    // Cart order
    document.getElementById('btn-cart-order')?.addEventListener('click', () => {
      if (!state.cart.length) return;
      const cartTotal   = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const installCost = getPrice('install_base', 3500) + state.cart.filter(i => i.id.startsWith('cam')).reduce((s, i) => s + i.qty, 0) * getPrice('install_per_cam', 1800);
      state.calcData.spec = { total: cartTotal + installCost, items: state.cart, discount: 0 };
      state.calcData.totalPrice = cartTotal + installCost;
      state.calcData.pkgId = state.calcData.pkgId || 'custom';
      submitOrder();
    });

    // Profile
    ['btn-edit-profile','btn-edit-profile-2','btn-edit-profile-3'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        document.getElementById('profile-main-view').style.display = 'none';
        document.getElementById('profile-edit-view').style.display = 'flex';
        document.getElementById('profile-edit-view').style.flexDirection = 'column';
      });
    });

    document.getElementById('btn-edit-back')?.addEventListener('click', () => {
      document.getElementById('profile-edit-view').style.display = 'none';
      document.getElementById('profile-main-view').style.display = 'flex';
      document.getElementById('profile-main-view').style.flexDirection = 'column';
    });

    document.getElementById('btn-save-profile')?.addEventListener('click', saveProfile);

    // Notification toggles — save on change
    document.getElementById('notify-orders-input')?.addEventListener('change', saveNotificationPrefs);
    document.getElementById('notify-promos-input')?.addEventListener('change', saveNotificationPrefs);

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      clearInterval(state.unreadPollTimer);
      StorageService.clearSession();
      state.user = null;
      state.isGuest = false;
      showScreen('landing');
      showToast('Выход выполнен');
    });

    document.getElementById('btn-link-telegram')?.addEventListener('click', () => showScreen('auth'));

    // Referral
    document.getElementById('btn-copy-ref-code')?.addEventListener('click', () => {
      const code = document.getElementById('ref-code-display')?.textContent || '';
      const url  = window.location.origin;
      navigator.clipboard?.writeText(`${url}?start=${code}`)
        .then(() => showToast('Ссылка скопирована!', 'success'))
        .catch(() => showToast('Код: ' + code, 'success'));
      TelegramService.Haptic.impact('light');
    });

    document.getElementById('btn-share-ref-tg')?.addEventListener('click', () => {
      const code = document.getElementById('ref-code-display')?.textContent || '';
      const url  = process?.env?.APP_URL || window.location.origin;
      const text = encodeURIComponent(`Рассчитай систему видеонаблюдения в GAZE и получи скидку 5000 ₽ по моему коду: ${code}`);
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url + '?start=' + code)}&text=${text}`, '_blank');
    });

    document.getElementById('btn-share-ref')?.addEventListener('click', () => {
      const code = document.getElementById('ref-code-display')?.textContent || '';
      if (navigator.share) navigator.share({ title: 'GAZE', text: `Скидка 5000 ₽ по коду: ${code}`, url: window.location.origin }).catch(()=>{});
      else showToast('Скопируйте ссылку', 'warning');
    });

    // Admin tabs
    document.querySelectorAll('.admin-tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.admin-panel-tab').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('admin-tab-' + tab.dataset.tab);
        if (panel) panel.style.display = 'block';
        // Lazy load
        if (tab.dataset.tab === 'orders') loadAdminOrders();
        if (tab.dataset.tab === 'users')  loadAdminUsers();
        if (tab.dataset.tab === 'prices') loadAdminPrices();
        if (tab.dataset.tab === 'promo')  loadAdminPromo();
        if (tab.dataset.tab === 'reviews') loadAdminReviews();
      });
    });

    // Admin: order filter buttons
    document.querySelectorAll('.admin-order-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-order-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadAdminOrders(btn.dataset.status);
      });
    });

    // Admin: user search
    let userSearchTimer = null;
    document.getElementById('admin-user-search')?.addEventListener('input', (e) => {
      clearTimeout(userSearchTimer);
      userSearchTimer = setTimeout(() => loadAdminUsers(e.target.value), 400);
    });

    // Admin: create promo
    document.getElementById('btn-create-promo')?.addEventListener('click', createPromo);

    // Admin: broadcast
    document.getElementById('btn-send-broadcast')?.addEventListener('click', sendBroadcast);

    // Support chat
    document.getElementById('btn-send-support')?.addEventListener('click', sendChatMessage);
    document.getElementById('support-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });

    // Map
    document.getElementById('btn-map-open')?.addEventListener('click', openMap);
    document.getElementById('btn-map-close')?.addEventListener('click', () => {
      document.getElementById('full-map-view').style.display = 'none';
    });
    document.getElementById('btn-map-confirm')?.addEventListener('click', confirmMapAddress);
    document.getElementById('btn-map-manual')?.addEventListener('click', () => {
      document.getElementById('full-map-view').style.display = 'none';
    });

    // Connection status ping
    document.getElementById('conn-status')?.addEventListener('click', async () => {
      try { await fetch('/api/health'); showToast('Сервер доступен ✓', 'success'); }
      catch { showToast('Нет связи с сервером', 'error'); }
    });

    // Guide / FAQ accordion
    document.querySelectorAll('.faq-item').forEach(item => {
      item.addEventListener('click', () => item.classList.toggle('guide-item-active'));
    });

    // data-screen buttons
    document.querySelectorAll('[data-screen]').forEach(el => {
      if (!el.classList.contains('nav-item')) {
        el.addEventListener('click', () => showScreen(el.dataset.screen));
      }
    });
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  return {
    init,
    showScreen,
    bindEvents,
    updateOrderStatus,
    updatePrice,
    proQty,
    blockUser,
    unblockUser,
    toggleReview,
  };
})();
// ─── BOOT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Bind all static event listeners
  App.bindEvents();

  // Nav items
  document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => App.showScreen(btn.dataset.screen));
  });

  // Start the app
  App.init();
});
