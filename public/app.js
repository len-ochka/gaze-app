'use strict';

/* =============================================================================
   GAZE — Client App
   Полный клиентский код: навигация, авторизация, калькулятор, профиль, админ.
   ============================================================================= */

const App = (() => {

  // ─── STATE ────────────────────────────────────────────────────────────────
  const state = {
    user: null,
    isGuest: false,
    prices: {},
    currentScreen: 'landing',
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
    state.currentScreen = name;

    // Nav highlight
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });

    // Show/hide nav
    const noNav = ['landing', 'auth'];
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = noNav.includes(name) ? 'none' : 'flex';

    if (name === 'profile') renderProfile();
    if (name === 'admin')   loadAdminStats();
    if (name === 'home')    renderHome();
    if (name === 'support') loadChatMessages();

    // Back button
    const backScreens = ['calculator', 'cart', 'guide', 'faq', 'support', 'admin'];
    if (TelegramService.isAvailable()) {
      if (backScreens.includes(name)) {
        TelegramService.BackButton.show(() => {
          showScreen(state.prevScreen || 'home');
        });
      } else {
        TelegramService.BackButton.hide();
      }
    }
    state.prevScreen = state.currentScreen;
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  async function init() {
    TelegramService.ready();

    // If inside Telegram — skip landing and try to auth directly
    if (TelegramService.isTelegramUser()) {
      showScreen('auth');
      await doTelegramAuth();
    }
    // Otherwise show landing as normal
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
      showScreen('home');
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
      role: 'guest', order_count: 0, isGuest: true
    };
    await loadPrices();
    renderHome();
    showScreen('home');
  }

  async function loadPrices() {
    try {
      state.prices = await StorageService.getPrices();
    } catch {
      state.prices = {};
    }
  }

  // ─── HOME ─────────────────────────────────────────────────────────────────
  function renderHome() {
    const u = state.user;
    const name = u ? (u.full_name || u.username || 'Пользователь').split(' ')[0] : 'Пользователь';
    const el = document.getElementById('home-username');
    if (el) el.textContent = name;

    // Connection status
    updateConnStatus();

    // Admin nav
    const adminNav = document.getElementById('nav-admin');
    if (adminNav) adminNav.style.display = (u && u.role === 'admin') ? 'flex' : 'none';

    // Support nav (show if has orders)
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

  function calcSpec() {
    const { area, cameraType, pkgId, options } = state.calcData;
    if (!area || !pkgId) return null;

    // Camera count based on area
    const camDensity = { indoor: 25, outdoor: 40, mixed: 30 };
    const density = camDensity[cameraType] || 30;
    const camQty = Math.max(2, Math.ceil(area / density));

    // NVR channels
    const nvrCh = camQty <= 4 ? 4 : camQty <= 8 ? 8 : 16;

    // HDD size (days of storage by package)
    const storageDays = { budget: 7, standard: 14, premium: 30 };
    const gbPerCamDay = { budget: 6, standard: 10, premium: 16 };
    const totalGb = camQty * gbPerCamDay[pkgId] * storageDays[pkgId];
    const hddSize = totalGb <= 1000 ? '1tb' : totalGb <= 2000 ? '2tb' : '4tb';

    // Cable meters
    const cableM = Math.ceil(Math.sqrt(area) * camQty * 1.4);

    // Prices
    const camPrice   = getPrice(`pkg_${pkgId}_cam`, pkgId === 'budget' ? 2200 : pkgId === 'standard' ? 4500 : 9800);
    const nvrPrice   = getPrice(`nvr_${nvrCh}ch`, nvrCh === 4 ? 4500 : nvrCh === 8 ? 7200 : 12500);
    const hddPrice   = getPrice(`hdd_${hddSize}`, hddSize === '1tb' ? 3200 : hddSize === '2tb' ? 5500 : 9200);
    const installPer = getPrice('install_per_cam', 1800);
    const cablePrice = getPrice('cable_per_meter', 35);
    const basePrice  = getPrice('install_base', 3500);

    const camTotal     = camQty * camPrice;
    const nvrTotal     = nvrPrice;
    const hddTotal     = hddPrice;
    const cableTotal   = cableM * cablePrice;
    const installTotal = basePrice + camQty * installPer;

    let extraItems = [];
    if (options.soundRecord)  extraItems.push({ name: '🎤 Микрофоны', price: camQty * 800, qty: camQty });
    if (options.hasInternet)  extraItems.push({ name: '🌐 4G-роутер', price: getPrice('internet_router', 3200), qty: 1 });
    if (options.maintenance)  extraItems.push({ name: '🛠️ ТО (ежемес.)', price: 1500, qty: 1, monthly: true });

    const extrasTotal = extraItems.reduce((s, e) => s + e.price * (e.qty || 1), 0);

    // Discount
    const discountBase = pkgId === 'standard' ? getPrice('discount_standard', 500) * camQty / 4
                        : pkgId === 'premium'  ? getPrice('discount_premium',  1500) * camQty / 4
                        : 0;
    const discount = Math.floor(discountBase);

    const total = camTotal + nvrTotal + hddTotal + cableTotal + installTotal + extrasTotal - discount;

    const pkgNames = { budget: 'ЭКОНОМ', standard: 'СТАНДАРТ', premium: 'ПРЕМИУМ' };
    const pkgColors = { budget: '#00ff94', standard: '#00d4ff', premium: '#ffd700' };

    return {
      camQty, nvrCh, hddSize, cableM,
      camPrice, nvrPrice, hddPrice, cableTotal, installTotal, extrasTotal,
      discount, total,
      pkgName: pkgNames[pkgId],
      pkgColor: pkgColors[pkgId],
      items: [
        { icon: '📷', name: `Камеры ${pkgNames[pkgId]}`, spec: `${camQty} шт × ${camPrice.toLocaleString('ru')} ₽`, price: camTotal },
        { icon: '📼', name: `NVR ${nvrCh}-канальный`, spec: `1 шт`, price: nvrTotal },
        { icon: '💾', name: `HDD ${hddSize.replace('tb',' ТБ')}`, spec: `${storageDays[pkgId]} дней хранения`, price: hddTotal },
        { icon: '🔌', name: 'Кабельная разводка', spec: `~${cableM} м`, price: cableTotal },
        { icon: '🔧', name: 'Монтаж и настройка', spec: `Базовый + ${camQty} камеры`, price: installTotal },
        ...extraItems.map(e => ({ icon: '➕', name: e.name, spec: e.monthly ? 'Ежемесячно' : `${e.qty} шт`, price: e.price * (e.qty || 1) })),
      ],
      discount,
    };
  }

  function renderSpec(spec) {
    const list = document.getElementById('result-items');
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
      </div>
    `).join('');

    summary.innerHTML = `
      ${spec.discount > 0 ? `
        <div class="discount-row">
          <span class="discount-label">🎁 Скидка ${spec.pkgName}</span>
          <span class="discount-value">−${spec.discount.toLocaleString('ru')} ₽</span>
        </div>` : ''}
      <div class="total-row total-final">
        <span class="total-label" style="color:${spec.pkgColor}">ИТОГО ПОД КЛЮЧ</span>
        <span class="total-value" style="font-size:26px;color:${spec.pkgColor}">${spec.total.toLocaleString('ru')} ₽</span>
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--text-muted);">
        Площадь: ${state.calcData.area} м² · Камер: ${spec.camQty} шт · NVR: ${spec.nvrCh}CH
      </div>
    `;
  }

  // Scanning animation + build spec
  function runScanningAnimation(cb) {
    const overlay = document.getElementById('scanning-overlay');
    const bar = document.getElementById('scanning-progress');
    const txt = document.getElementById('scanning-text');
    const steps = ['Анализируем площадь...', 'Подбираем оборудование...', 'Рассчитываем монтаж...', 'Формируем смету...'];
    if (!overlay) { cb(); return; }

    overlay.style.display = 'flex';
    if (bar) bar.style.width = '0%';
    let step = 0;

    const advance = () => {
      if (step >= steps.length) {
        overlay.style.display = 'none';
        cb();
        return;
      }
      if (txt) txt.textContent = steps[step];
      if (bar) bar.style.width = ((step + 1) / steps.length * 100) + '%';
      step++;
      setTimeout(advance, 500);
    };
    setTimeout(advance, 100);
  }

  // ─── ORDER SUBMIT ──────────────────────────────────────────────────────────
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
    };

    const btn = document.getElementById('btn-calc3-order');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Отправляем...'; }

    try {
      await StorageService.submitOrder(orderData);
      state.user.order_count = (state.user.order_count || 0) + 1;

      // Show success
      const successEl = document.getElementById('order-success');
      const orderIdEl = document.getElementById('order-id-display');
      if (successEl) successEl.classList.add('show');
      if (orderIdEl) orderIdEl.textContent = '#' + orderId;

      document.querySelector('#calc-step-3 .step-footer-actions')?.style && (
        document.querySelector('#calc-step-3 .step-footer-actions').style.display = 'none'
      );

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

  // ─── PROFILE ──────────────────────────────────────────────────────────────
  async function renderProfile() {
    const u = state.user;
    if (!u) return;

    // Guest banner
    const guestBanner = document.getElementById('guest-banner');
    if (guestBanner) guestBanner.style.display = state.isGuest ? 'block' : 'none';

    const name = u.full_name || u.username || 'Пользователь';
    const initials = name.split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase() || 'П';

    const elInit  = document.getElementById('profile-initials');
    const elName  = document.getElementById('profile-display-name');
    const elEmail = document.getElementById('profile-display-email');
    const elOrders = document.getElementById('profile-stat-orders');
    const elStatus = document.getElementById('profile-client-status');
    const elRowName = document.getElementById('profile-row-name');
    const elRowEmail = document.getElementById('profile-row-email');
    const elRowPhone = document.getElementById('profile-row-phone');
    const elRowAddr  = document.getElementById('profile-row-address');
    const vipBadge   = document.getElementById('vip-badge');
    const chatBtn    = document.getElementById('chat-engineer-btn-wrap');

    if (elInit)   elInit.textContent   = initials;
    if (elName)   elName.textContent   = name;
    if (elEmail)  elEmail.textContent  = u.email || (u.username ? '@' + u.username : 'Telegram пользователь');
    if (elOrders) elOrders.textContent = u.order_count || 0;

    const orders = u.order_count || 0;
    const clientStatus = orders >= 5 ? 'VIP' : orders >= 2 ? 'Постоянный' : 'Базовый';
    if (elStatus) elStatus.textContent = clientStatus;
    if (vipBadge) vipBadge.style.display = clientStatus === 'VIP' ? 'inline-block' : 'none';
    if (chatBtn)  chatBtn.style.display  = orders > 0 ? 'block' : 'none';

    if (elRowName)  elRowName.textContent  = u.full_name || '—';
    if (elRowEmail) elRowEmail.textContent = u.email || '—';

    if (elRowPhone) {
      elRowPhone.textContent = u.phone || 'Не указан — нажмите чтобы добавить';
      elRowPhone.classList.toggle('placeholder', !u.phone);
    }
    if (elRowAddr) {
      elRowAddr.textContent = u.address || 'Не указан';
      elRowAddr.classList.toggle('placeholder', !u.address);
    }

    // Fill edit form with current values
    const editName  = document.getElementById('edit-name');
    const editPhone = document.getElementById('edit-phone');
    const editEmail = document.getElementById('edit-email');
    const editAddr  = document.getElementById('edit-address');
    if (editName)  editName.value  = u.full_name || '';
    if (editPhone) editPhone.value = u.phone     || '';
    if (editEmail) editEmail.value = u.email     || '';
    if (editAddr)  editAddr.value  = u.address   || '';

    // Order history
    loadOrderHistory();

    // Referral
    if (!state.isGuest) loadReferralData();
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
      listEl.innerHTML = orders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
        const statusMap = { new: '🆕 Новая', processing: '⚙️ В работе', done: '✅ Выполнена', cancelled: '❌ Отменена' };
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
          </div>`;
      }).join('');
    } catch {}
  }

  async function loadReferralData() {
    try {
      const data = await StorageService.getReferralData();
      if (!data) return;

      const codeEl   = document.getElementById('ref-code-display');
      const bonusEl  = document.getElementById('ref-bonus-display');
      const secEl    = document.getElementById('ref-invites-section');
      const listEl   = document.getElementById('ref-invites-list');

      if (codeEl && data.code) codeEl.textContent = data.code;
      if (bonusEl) bonusEl.textContent = (data.balance || 0).toLocaleString('ru');

      if (data.invites && data.invites.length > 0 && secEl && listEl) {
        secEl.style.display = 'block';
        listEl.innerHTML = data.invites.map(inv => `
          <div class="invite-pill">
            <span style="font-size:13px;">${inv.full_name || 'Пользователь'}</span>
            <span style="font-size:11px;color:var(--text-muted);">${new Date(inv.created_at).toLocaleDateString('ru')}</span>
          </div>`).join('');
      }
    } catch {}
  }

  async function saveProfile() {
    const full_name = document.getElementById('edit-name')?.value.trim() || '';
    const phone     = document.getElementById('edit-phone')?.value.trim() || '';
    const email     = document.getElementById('edit-email')?.value.trim() || '';
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

  // ─── ADMIN ────────────────────────────────────────────────────────────────
  async function loadAdminStats() {
    const u = state.user;
    if (!u || u.role !== 'admin') { showScreen('home'); return; }

    try {
      const stats = await StorageService.getAdminStats();
      const container = document.getElementById('admin-stats-container');
      if (container) {
        container.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            ${[
              ['💰 Выручка', (stats.total_revenue || 0).toLocaleString('ru') + ' ₽'],
              ['📦 Заказы', stats.total_orders || 0],
              ['👥 Пользователи', stats.total_users || 0],
              ['🆕 За неделю', stats.recent_orders || 0],
            ].map(([l, v]) => `
              <div style="background:var(--bg-card);border:1px solid var(--glass-border);border-radius:14px;padding:16px;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${l}</div>
                <div style="font-size:22px;font-weight:800;color:var(--accent);">${v}</div>
              </div>`).join('')}
          </div>`;
      }

      // Chart
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
    } catch (e) { showToast('Ошибка загрузки статистики', 'error'); }

    loadAdminOrders();
    loadAdminPrices();
  }

  async function loadAdminOrders() {
    try {
      const orders = await StorageService.apiRequest('/admin/orders');
      const el = document.getElementById('admin-orders-list');
      if (!el) return;
      if (!orders.length) { el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Заказов пока нет</p>'; return; }
      el.innerHTML = orders.map(o => `
        <div class="admin-order-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:700;color:var(--accent);">#${o.id}</span>
            <select onchange="App.updateOrderStatus('${o.id}', this.value)"
              style="background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--glass-border);border-radius:8px;padding:4px 8px;font-size:12px;">
              ${['new','processing','done','cancelled'].map(s =>
                `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div style="font-size:13px;margin-bottom:4px;">👤 ${o.full_name || '—'}</div>
          <div style="font-size:12px;color:var(--text-muted);">📞 ${o.phone || '—'}</div>
          <div style="font-size:15px;font-weight:700;color:var(--accent);margin-top:8px;">${Number(o.total_price).toLocaleString('ru')} ₽</div>
        </div>`).join('');
    } catch {}
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

  async function updateOrderStatus(orderId, status) {
    try {
      await StorageService.updateOrderStatus(orderId, status);
      showToast('Статус обновлён', 'success');
    } catch { showToast('Ошибка', 'error'); }
  }

  async function updatePrice(key, value) {
    try {
      await StorageService.apiRequest('/admin/prices', 'POST', { key, value: Number(value) });
      state.prices[key] = Number(value);
      showToast('Цена обновлена', 'success');
    } catch { showToast('Ошибка', 'error'); }
  }

  // ─── CHAT / SUPPORT ───────────────────────────────────────────────────────
  async function loadChatMessages() {
    if (state.isGuest) return;
    const msgsEl = document.getElementById('support-chat-messages');
    if (!msgsEl) return;
    try {
      const msgs = await StorageService.apiRequest('/chat');
      if (msgs && msgs.length) {
        msgsEl.innerHTML = msgs.map(m => `
          <div class="chat-msg ${m.sender === 'user' ? 'user' : 'admin'}"
            style="align-self:${m.sender==='user'?'flex-end':'flex-start'};background:${m.sender==='user'?'rgba(0,212,255,0.15)':'var(--bg-card)'};border-radius:${m.sender==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px'};">
            ${m.text}
          </div>`).join('');
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    } catch {}
  }

  async function sendChatMessage() {
    if (state.isGuest) { showToast('Войдите через Telegram', 'warning'); return; }
    const input = document.getElementById('support-input');
    const text = input?.value.trim();
    if (!text) return;
    input.value = '';
    try {
      await StorageService.apiRequest('/chat', 'POST', { text });
      setTimeout(loadChatMessages, 1200);
    } catch {}
  }

  // ─── PRO MODE ─────────────────────────────────────────────────────────────
  function initProMode() {
    const proItems = {
      camera: [
        { id: 'cam_2mp_bullet', name: '📷 2МП Уличная Bullet', spec: 'FullHD, ИК 30м', priceKey: 'pro_cam_2mp_bullet', defPrice: 2800 },
        { id: 'cam_4mp_dome',   name: '⚪ 4МП Купольная Dome', spec: '4МП, ИК 20м, IP67', priceKey: 'pro_cam_4mp_dome', defPrice: 4200 },
        { id: 'cam_8mp_bullet', name: '🔫 8МП 4K Bullet',      spec: '4K, ИК 60м, умная аналитика', priceKey: 'pro_cam_8mp_bullet', defPrice: 8900 },
        { id: 'cam_ptz',        name: '🔄 PTZ Поворотная',     spec: '4МП, зум ×18, авто-трекинг', priceKey: 'pro_cam_ptz', defPrice: 14500 },
      ],
      dvr: [
        { id: 'nvr_4ch',  name: '📼 NVR 4-канальный',  spec: 'H.265+, 1×HDD, 4К вход', priceKey: 'pro_nvr_4ch',  defPrice: 4500 },
        { id: 'nvr_8ch',  name: '📼 NVR 8-канальный',  spec: 'H.265+, 2×HDD, 4К вход', priceKey: 'pro_nvr_8ch',  defPrice: 7200 },
        { id: 'nvr_16ch', name: '📼 NVR 16-канальный', spec: 'H.265+, 4×HDD, 4К вход', priceKey: 'pro_nvr_16ch', defPrice: 12500 },
      ],
      hdd: [
        { id: 'hdd_2tb', name: '💾 HDD 2TB WD Purple', spec: '24/7, 3 года гарантии', priceKey: 'pro_hdd_2tb', defPrice: 5500 },
        { id: 'hdd_4tb', name: '💾 HDD 4TB WD Purple', spec: '24/7, 3 года гарантии', priceKey: 'pro_hdd_4tb', defPrice: 9200 },
      ],
    };

    const renderCat = (cat) => {
      const items = proItems[cat];
      const listEl = document.getElementById(`pro-${cat}-list`) || document.getElementById(`pro-${cat === 'dvr' ? 'dvr' : cat}-list`);
      const targetId = cat === 'dvr' ? 'pro-dvr-list' : cat === 'hdd' ? 'pro-hdd-list' : 'pro-cameras-list';
      const el = document.getElementById(targetId);
      if (!el) return;
      el.innerHTML = items.map(item => {
        const price = getPrice(item.priceKey, item.defPrice);
        const cartItem = state.proCart.find(c => c.id === item.id);
        const qty = cartItem ? cartItem.qty : 0;
        return `
          <div class="pro-item-card ${qty > 0 ? 'selected' : ''}" data-pro-id="${item.id}">
            <div class="pro-item-info">
              <div class="pro-item-name">${item.name}</div>
              <div class="pro-item-spec">${item.spec}</div>
            </div>
            <div style="text-align:right;">
              <div class="pro-item-price">${price.toLocaleString('ru')} ₽</div>
              <div class="pro-qty-picker">
                <button class="pro-qty-btn" onclick="App.proQty('${item.id}', -1, '${cat}')">−</button>
                <span class="pro-qty-val" id="pro-qty-${item.id}">${qty}</span>
                <button class="pro-qty-btn" onclick="App.proQty('${item.id}', 1, '${cat}', ${price}, '${item.name}')">+</button>
              </div>
            </div>
          </div>`;
      }).join('');
    };

    renderCat('camera');
    renderCat('dvr');
    renderCat('hdd');
    updateProTotal();
  }

  function proQty(itemId, delta, cat, price, name) {
    const existing = state.proCart.findIndex(c => c.id === itemId);
    if (existing >= 0) {
      state.proCart[existing].qty = Math.max(0, state.proCart[existing].qty + delta);
      if (state.proCart[existing].qty === 0) state.proCart.splice(existing, 1);
    } else if (delta > 0) {
      state.proCart.push({ id: itemId, name, price, qty: 1 });
    }
    const qtyEl = document.getElementById('pro-qty-' + itemId);
    const cartItem = state.proCart.find(c => c.id === itemId);
    if (qtyEl) qtyEl.textContent = cartItem ? cartItem.qty : 0;
    updateProTotal();
  }

  function updateProTotal() {
    const total = state.proCart.reduce((s, i) => s + i.price * i.qty, 0);
    const totalCams = state.proCart.filter(i => i.id.startsWith('cam')).reduce((s, i) => s + i.qty, 0);
    const priceEl = document.getElementById('pro-total-price');
    const camEl   = document.getElementById('pro-cam-qty');
    if (priceEl) priceEl.textContent = total.toLocaleString('ru') + ' ₽';
    if (camEl)   camEl.textContent   = totalCams || 0;
  }

  function addProToCart() {
    if (!state.proCart.length) { showToast('Добавьте товары', 'warning'); return; }
    state.cart = [...state.proCart];
    renderCart();
    showScreen('cart');
    TelegramService.Haptic.impact('medium');
  }

  // ─── CART ─────────────────────────────────────────────────────────────────
  function renderCart() {
    const listEl  = document.getElementById('cart-list');
    const totalEl = document.getElementById('cart-total-price');
    if (!listEl || !state.cart.length) {
      if (listEl) listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px;">Корзина пуста</p>';
      if (totalEl) totalEl.textContent = '0 ₽';
      return;
    }
    const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    listEl.innerHTML = state.cart.map(i => `
      <div class="invoice-row">
        <div class="invoice-row-body">
          <div class="invoice-row-name">${i.name}</div>
          <div class="invoice-row-spec">${i.qty} шт × ${i.price.toLocaleString('ru')} ₽</div>
        </div>
        <div class="invoice-row-price">${(i.price * i.qty).toLocaleString('ru')} ₽</div>
      </div>`).join('');
    if (totalEl) totalEl.textContent = total.toLocaleString('ru') + ' ₽';
  }

  // ─── OPERATORS LIST ───────────────────────────────────────────────────────
  function renderOperators() {
    const ops = [
      'МТС', 'МегаФон', 'Билайн', 'Теле2', 'Ростелеком', 'ЭР-Телеком',
      'Дом.ру', 'МГТС', 'Yota', 'SkyLink'
    ];
    const el = document.getElementById('operators-list');
    if (!el) return;
    el.innerHTML = ops.map(op => `
      <div class="checkbox-row" onclick="this.classList.toggle('checked')">
        <div class="custom-checkbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="checkbox-body"><div class="checkbox-title">${op}</div></div>
      </div>`).join('');
  }

  // ─── BIND EVENTS ──────────────────────────────────────────────────────────
  function bindEvents() {
    // ── Landing buttons ──
    document.getElementById('btn-landing-start')?.addEventListener('click', () => {
      if (TelegramService.isTelegramUser()) {
        showScreen('auth');
        doTelegramAuth();
      } else {
        showScreen('auth');
      }
    });

    document.getElementById('btn-landing-guest')?.addEventListener('click', enterAsGuest);

    // ── Auth screen ──
    document.getElementById('btn-guest-enter')?.addEventListener('click', enterAsGuest);
    document.getElementById('btn-guest-link-tg')?.addEventListener('click', (e) => { e.preventDefault(); });
    document.getElementById('btn-auth-retry')?.addEventListener('click', doTelegramAuth);

    // ── Nav items ──
    document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        TelegramService.Haptic.selection();
        showScreen(btn.dataset.screen);
      });
    });

    // ── Home promo / packages ──
    document.getElementById('promo-to-calc')?.addEventListener('click', () => showScreen('calculator'));
    document.getElementById('home-pkg-budget')?.addEventListener('click', () => { state.calcData.pkgId = 'budget'; showScreen('calculator'); });
    document.getElementById('home-pkg-standard')?.addEventListener('click', () => { state.calcData.pkgId = 'standard'; showScreen('calculator'); });
    document.getElementById('home-pkg-premium')?.addEventListener('click', () => { state.calcData.pkgId = 'premium'; showScreen('calculator'); });

    // ── Calc step 1 ──
    document.querySelectorAll('.cam-type-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.cam-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.calcData.cameraType = card.dataset.type;
        TelegramService.Haptic.selection();
      });
    });

    document.getElementById('btn-calc1-next')?.addEventListener('click', () => {
      const area = parseFloat(document.getElementById('area-input')?.value);
      if (!area || area < 10) { showToast('Введите площадь (минимум 10 м²)', 'error'); return; }
      state.calcData.area = area;
      // Pre-select camera type
      const selected = document.querySelector('.cam-type-card.selected');
      if (selected) state.calcData.cameraType = selected.dataset.type;
      showCalcStep(2);
      TelegramService.Haptic.impact('light');
    });

    // ── Calc step 2 ──
    document.querySelectorAll('.pkg-card[data-pkg]').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.pkg-card[data-pkg]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.calcData.pkgId = card.dataset.pkg;
        renderPkgPreview(card.dataset.pkg);
        TelegramService.Haptic.selection();
      });
    });

    // Pre-select package if set from home
    if (state.calcData.pkgId) {
      const preCard = document.querySelector(`.pkg-card[data-pkg="${state.calcData.pkgId}"]`);
      preCard?.classList.add('selected');
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
        TelegramService.Haptic.selection();
      });
    });

    document.getElementById('btn-calc2-back')?.addEventListener('click', () => showCalcStep(1));

    document.getElementById('btn-calc2-next')?.addEventListener('click', () => {
      if (!state.calcData.pkgId) { showToast('Выберите пакет', 'error'); return; }
      runScanningAnimation(() => {
        const spec = calcSpec();
        state.calcData.spec = spec;
        state.calcData.totalPrice = spec?.total || 0;
        renderSpec(spec);
        initProMode();
        showCalcStep(3);
        // Hide success if showing
        document.getElementById('order-success')?.classList.remove('show');
        const footerActions = document.querySelector('#calc-step-3 .step-footer-actions');
        if (footerActions) footerActions.style.display = '';
      });
    });

    // ── Calc step 3 ──
    document.getElementById('btn-calc3-back')?.addEventListener('click', () => showCalcStep(2));
    document.getElementById('btn-calc3-order')?.addEventListener('click', submitOrder);
    document.getElementById('btn-new-order')?.addEventListener('click', () => {
      state.calcData = { area: null, cameraType: 'mixed', pkgId: null, options: {}, spec: null, totalPrice: 0 };
      state.proCart = [];
      document.getElementById('area-input') && (document.getElementById('area-input').value = '');
      document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
      document.querySelectorAll('.cam-type-card').forEach(c => c.classList.remove('selected'));
      document.querySelectorAll('.option-checkbox').forEach(c => { c.classList.remove('checked'); });
      document.getElementById('internet-operators-panel').style.display = 'none';
      showCalcStep(1);
    });

    // ── Pro mode ──
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

    // ── Show guide ──
    document.getElementById('btn-show-guide')?.addEventListener('click', () => {
      const g = document.getElementById('visual-guide');
      if (g) g.style.display = g.style.display === 'none' ? 'block' : 'none';
    });

    // ── Cart order ──
    document.getElementById('btn-cart-order')?.addEventListener('click', () => {
      if (!state.cart.length) return;
      // Build spec from cart for order
      const cartTotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const installCost = getPrice('install_base', 3500) + state.cart.filter(i => i.id.startsWith('cam')).reduce((s, i) => s + i.qty, 0) * getPrice('install_per_cam', 1800);
      state.calcData.spec = { total: cartTotal + installCost, items: state.cart, discount: 0 };
      state.calcData.totalPrice = cartTotal + installCost;
      state.calcData.pkgId = state.calcData.pkgId || 'custom';
      submitOrder();
    });

    // ── Profile ──
    ['btn-edit-profile', 'btn-edit-profile-2', 'btn-edit-profile-3'].forEach(id => {
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

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      StorageService.clearSession();
      state.user = null;
      state.isGuest = false;
      showScreen('landing');
      showToast('Выход выполнен');
    });

    document.getElementById('btn-link-telegram')?.addEventListener('click', () => {
      showScreen('auth');
    });

    // ── Referral ──
    document.getElementById('btn-copy-ref-code')?.addEventListener('click', () => {
      const code = document.getElementById('ref-code-display')?.textContent || '';
      const appUrl = window.location.origin;
      navigator.clipboard?.writeText(`${appUrl}?start=${code}`)
        .then(() => showToast('Ссылка скопирована!', 'success'))
        .catch(() => showToast('Код: ' + code, 'success'));
      TelegramService.Haptic.impact('light');
    });

    document.getElementById('btn-share-ref-tg')?.addEventListener('click', () => {
      const code = document.getElementById('ref-code-display')?.textContent || '';
      const appUrl = process?.env?.APP_URL || window.location.origin;
      const text = encodeURIComponent(`Рассчитай систему видеонаблюдения в GAZE и получи скидку 5000 ₽ по моему коду: ${code}`);
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(appUrl + '?start=' + code)}&text=${text}`;
      window.open(tgUrl, '_blank');
    });

    document.getElementById('btn-share-ref')?.addEventListener('click', () => {
      const code = document.getElementById('ref-code-display')?.textContent || '';
      const shareData = { title: 'GAZE — Видеонаблюдение', text: `Скидка 5000 ₽ по коду: ${code}`, url: window.location.origin };
      if (navigator.share) navigator.share(shareData).catch(() => {});
      else showToast('Скопируйте ссылку выше', 'warning');
    });

    // ── Admin tabs ──
    document.querySelectorAll('.admin-tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.admin-panel-tab').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('admin-tab-' + tab.dataset.tab);
        if (panel) panel.style.display = 'block';
      });
    });

    // ── Support chat ──
    document.getElementById('btn-send-support')?.addEventListener('click', sendChatMessage);
    document.getElementById('support-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });

    // ── Map ──
    document.getElementById('btn-map-open')?.addEventListener('click', openMap);
    document.getElementById('btn-map-close')?.addEventListener('click', () => {
      document.getElementById('full-map-view').style.display = 'none';
    });
    document.getElementById('btn-map-confirm')?.addEventListener('click', confirmMapAddress);
    document.getElementById('btn-map-manual')?.addEventListener('click', () => {
      document.getElementById('full-map-view').style.display = 'none';
    });

    // ── Connection status click ──
    document.getElementById('conn-status')?.addEventListener('click', async () => {
      try {
        await fetch('/api/health');
        showToast('Сервер доступен ✓', 'success');
      } catch {
        showToast('Нет связи с сервером', 'error');
      }
    });

    // ── guide / faq item toggle ──
    document.querySelectorAll('.faq-item').forEach(item => {
      item.addEventListener('click', () => item.classList.toggle('guide-item-active'));
    });

    // data-screen buttons anywhere
    document.querySelectorAll('[data-screen]').forEach(el => {
      if (!el.classList.contains('nav-item')) {
        el.addEventListener('click', () => showScreen(el.dataset.screen));
      }
    });
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

  // ─── MAP (Yandex) ─────────────────────────────────────────────────────────
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
      state.mapInstance = new ymaps.Map('big-map', {
        center: [55.75, 37.57], zoom: 11,
        controls: ['zoomControl', 'searchControl']
      });

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

  // ─── PUBLIC API ────────────────────────────────────────────────────────────
  return {
    init,
    showScreen,
    bindEvents,
    updateOrderStatus,
    updatePrice,
    proQty,
  };
})();

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.bindEvents();
  App.init();
});
