'use strict';

/**
 * GAZE Pricing Engine v2.1
 * Алгоритм: Средняя_цена_СНГ_2026 × 0.93 (−7% от рынка)
 * Источники: Яндекс.Маркет, DNS, OZON — май 2026
 */

const MARKET_FACTOR = 0.93; // −7% от рынка

// ─── РЫНОЧНЫЕ ЦЕНЫ 2026 (РФ/СНГ) ─────────────────────────────────────────────
const MARKET_PRICES_2026 = {
  // ── Камеры Hikvision / HiWatch ────────────────────────────────────────────
  'hiwatch_2mp_bullet':     Math.round(2800  * MARKET_FACTOR), // HiWatch DS-I226
  'hiwatch_4mp_dome':       Math.round(4200  * MARKET_FACTOR), // HiWatch DS-I452
  'hikvision_8mp_bullet':   Math.round(8900  * MARKET_FACTOR), // DS-2CD2T83G2
  'hikvision_4mp_acupick':  Math.round(6500  * MARKET_FACTOR), // DS-2CD2T47 AcuPick
  'hikvision_ptz_25x':      Math.round(14500 * MARKET_FACTOR), // DS-2DE4A425
  'dahua_2mp_bullet':       Math.round(2600  * MARKET_FACTOR), // IPC-HFW2249S
  'dahua_4mp_dome':         Math.round(3900  * MARKET_FACTOR), // IPC-HDW2449T

  // ── NVR ───────────────────────────────────────────────────────────────────
  'nvr_4ch_hiwatch':        Math.round(4500  * MARKET_FACTOR),
  'nvr_8ch_hiwatch':        Math.round(7200  * MARKET_FACTOR),
  'nvr_16ch_hikvision':     Math.round(12500 * MARKET_FACTOR),
  'nvr_32ch_hikvision':     Math.round(21000 * MARKET_FACTOR),

  // ── HDD WD Purple ─────────────────────────────────────────────────────────
  'wd_purple_1tb':          Math.round(3200  * MARKET_FACTOR),
  'wd_purple_2tb':          Math.round(5500  * MARKET_FACTOR),
  'wd_purple_4tb':          Math.round(9200  * MARKET_FACTOR),
  'wd_purple_8tb':          Math.round(16000 * MARKET_FACTOR),

  // ── ИБП (12V DC для видеонаблюдения) ─────────────────────────────────────
  // Специфика: 12V DC UPS для камер (не бытовой 220V)
  // APC Back-UPS / Powercom серия VRT / Crown серия для CCTV
  'ups_4cam_12v':           Math.round(4500  * MARKET_FACTOR), // ~15Вт × 4 камеры, 2ч
  'ups_8cam_12v':           Math.round(7500  * MARKET_FACTOR), // ~15Вт × 8 камер, 2ч
  'ups_16cam_12v':          Math.round(12000 * MARKET_FACTOR), // Powercom SPT-1500
  'ups_nvr_ups':            Math.round(3200  * MARKET_FACTOR), // Отдельно для NVR

  // ── Wi-Fi оборудование ────────────────────────────────────────────────────
  'wifi_extender_outdoor':  Math.round(3000  * MARKET_FACTOR), // TP-Link EAP225-Outdoor
  'wifi_bridge_ubiquiti':   Math.round(5000  * MARKET_FACTOR), // Ubiquiti Bullet M2
  'wifi_cpe_long_range':    Math.round(4200  * MARKET_FACTOR), // TP-Link CPE710 5GHz

  // ── Солнечное питание для камер ───────────────────────────────────────────
  'solar_panel_30w':        Math.round(3500  * MARKET_FACTOR), // Панель 30Вт
  'solar_controller_20a':   Math.round(4000  * MARKET_FACTOR), // Контроллер 20А
  'solar_battery_100ah':    Math.round(9000  * MARKET_FACTOR), // АКБ 100Ач AGM
  'solar_full_kit':         Math.round(16500 * MARKET_FACTOR), // Комплект на 1 камеру

  // ── Монтаж ────────────────────────────────────────────────────────────────
  'install_per_cam':        Math.round(1800  * MARKET_FACTOR),
  'install_base':           Math.round(3500  * MARKET_FACTOR),
  'cable_per_meter':        Math.round(35    * MARKET_FACTOR),
  'wifi_install_per_point': Math.round(1200  * MARKET_FACTOR),
  'solar_install_per_cam':  Math.round(2500  * MARKET_FACTOR),
};

/**
 * Рассчитать спецификацию с учётом всех опций
 * @param {Object} params
 * @param {number} params.area — площадь в м²
 * @param {string} params.cameraType — indoor|outdoor|mixed
 * @param {string} params.pkgId — budget|standard|premium
 * @param {Object} params.options — выбранные опции
 * @param {Object} params.customPrices — цены из БД (override)
 * @returns {Object} spec
 */
function calculateSpec(params) {
  const { area, cameraType, pkgId, options = {}, customPrices = {} } = params;

  const price = (key, fallback) => {
    if (customPrices[key] !== undefined) return Number(customPrices[key]);
    return MARKET_PRICES_2026[key] || fallback || 0;
  };

  // ── Количество камер ──────────────────────────────────────────────────────
  const density = { indoor: 25, outdoor: 40, mixed: 30 };
  const camQty  = Math.max(2, Math.ceil(area / (density[cameraType] || 30)));

  // ── NVR каналы ────────────────────────────────────────────────────────────
  const nvrCh = camQty <= 4 ? 4 : camQty <= 8 ? 8 : camQty <= 16 ? 16 : 32;

  // ── HDD ───────────────────────────────────────────────────────────────────
  const storageDays   = { budget: 7, standard: 14, premium: 30 };
  const gbPerCamDay   = { budget: 6, standard: 10, premium: 16 };
  const totalGb       = camQty * gbPerCamDay[pkgId] * storageDays[pkgId];
  const hddKey        = totalGb <= 1000 ? 'wd_purple_1tb' : totalGb <= 2000 ? 'wd_purple_2tb' : totalGb <= 4000 ? 'wd_purple_4tb' : 'wd_purple_8tb';
  const hddLabel      = hddKey.replace('wd_purple_', '').toUpperCase();

  // ── Камеры по пакету ──────────────────────────────────────────────────────
  const camKeyMap = { budget: 'dahua_2mp_bullet', standard: 'hiwatch_4mp_dome', premium: 'hikvision_8mp_bullet' };
  const camKey    = camKeyMap[pkgId] || 'hiwatch_2mp_bullet';
  const camPrice  = price(camKey, pkgId === 'budget' ? 2050 : pkgId === 'standard' ? 4180 : 9110);

  // ── NVR цена ──────────────────────────────────────────────────────────────
  const nvrKeyMap = { 4: 'nvr_4ch_hiwatch', 8: 'nvr_8ch_hiwatch', 16: 'nvr_16ch_hikvision', 32: 'nvr_32ch_hikvision' };
  const nvrPrice  = price(nvrKeyMap[nvrCh], nvrCh === 4 ? 4185 : nvrCh === 8 ? 6700 : nvrCh === 16 ? 11620 : 19530);

  // ── Монтаж ────────────────────────────────────────────────────────────────
  const isWireless    = options.wireless || false;
  const installBase   = price('install_base', 3255);
  const installPerCam = isWireless
    ? price('wifi_install_per_point', 1116) + price('install_per_cam', 1674)
    : price('install_per_cam', 1674);

  // ── Кабель (только для проводной) ─────────────────────────────────────────
  const cableM     = isWireless ? 0 : Math.ceil(Math.sqrt(area) * camQty * 1.4);
  const cablePrice = price('cable_per_meter', 33);

  // ── ИБП — специализированный 12V DC для видеонаблюдения ───────────────────
  let upsItems = [];
  if (options.ups) {
    const upsKey   = camQty <= 4 ? 'ups_4cam_12v' : camQty <= 8 ? 'ups_8cam_12v' : 'ups_16cam_12v';
    const upsLabel = camQty <= 4 ? 'ИБП 12V DC (4 камеры)' : camQty <= 8 ? 'ИБП 12V DC (8 камер)' : 'ИБП 12V DC (16 камер)';
    upsItems.push({ icon: '🔋', name: upsLabel, spec: 'APC/Powercom 12V, автономность 2-4ч', price: price(upsKey, 4185), qty: 1 });
    upsItems.push({ icon: '🔋', name: 'ИБП для NVR (220V)', spec: 'APC BE650G2', price: price('ups_nvr_ups', 2976), qty: 1 });
  }

  // ── Wi-Fi оборудование ────────────────────────────────────────────────────
  let wifiItems = [];
  if (isWireless) {
    const pointsNeeded = Math.max(1, Math.ceil(camQty / 3));
    const selectedProvider = options.wifiProvider || 'tplink';
    const wifiKey   = selectedProvider === 'ubiquiti' ? 'wifi_bridge_ubiquiti' : 'wifi_extender_outdoor';
    const wifiLabel = selectedProvider === 'ubiquiti' ? 'Ubiquiti Bullet M2 (точка)' : 'TP-Link EAP225-Outdoor (точка)';
    wifiItems.push({
      icon: '📡', name: wifiLabel,
      spec: `${pointsNeeded} шт — покрытие до ${pointsNeeded * 3} камер`,
      price: price(wifiKey, 2790) * pointsNeeded,
      qty: 1
    });
  }

  // ── Солнечное питание ─────────────────────────────────────────────────────
  let solarItems = [];
  if (options.solar) {
    const remoteCams = options.remoteCamQty || Math.ceil(camQty / 2);
    solarItems.push({
      icon: '☀️', name: 'Комплект солнечного питания',
      spec: `${remoteCams} камеры × панель 30Вт + АКБ 100Ач`,
      price: price('solar_full_kit', 15345) * remoteCams,
      qty: 1
    });
    if (isWireless) {
      const installSolar = price('solar_install_per_cam', 2325) * remoteCams;
      solarItems.push({ icon: '🔧', name: 'Монтаж автономных камер', spec: `${remoteCams} шт`, price: installSolar, qty: 1 });
    }
  }

  // ── Прочие опции ──────────────────────────────────────────────────────────
  let extraItems = [];
  if (options.soundRecord) extraItems.push({ icon: '🎤', name: 'Микрофоны с шумоподавлением', spec: `${camQty} шт`, price: camQty * 744, qty: 1 });
  if (options.hasInternet) extraItems.push({ icon: '🌐', name: '4G-роутер', spec: '1 шт', price: price('internet_router', 2772), qty: 1 });
  if (options.maintenance) extraItems.push({ icon: '🛠️', name: 'ТО (ежемесячно)', spec: 'Выезд инженера + диагностика', price: price('service_basic', 1395), qty: 1, monthly: true });

  // ── Итог ──────────────────────────────────────────────────────────────────
  const camTotal     = camQty * camPrice;
  const hddTotal     = price(hddKey, 5116);
  const cableTotal   = cableM * cablePrice;
  const installTotal = installBase + camQty * installPerCam;
  const upsTotal     = upsItems.reduce((s, i) => s + i.price, 0);
  const wifiTotal    = wifiItems.reduce((s, i) => s + i.price, 0);
  const solarTotal   = solarItems.reduce((s, i) => s + i.price, 0);
  const extrasTotal  = extraItems.reduce((s, i) => s + i.price, 0);

  const pkgNames  = { budget: 'ЭКОНОМ', standard: 'СТАНДАРТ', premium: 'ПРЕМИУМ' };
  const pkgColors = { budget: '#00ff94', standard: '#00d4ff', premium: '#ffd700' };

  const discountMultiplier = { budget: 0, standard: 0.02, premium: 0.04 };
  const discount = Math.floor((camTotal + nvrPrice + hddTotal) * (discountMultiplier[pkgId] || 0));

  const subtotal = camTotal + nvrPrice + hddTotal + cableTotal + installTotal + upsTotal + wifiTotal + solarTotal + extrasTotal;
  const total    = Math.max(0, subtotal - discount);

  const allItems = [
    { icon: '📷', name: `Камеры ${pkgNames[pkgId]}`, spec: `${camQty} шт × ${camPrice.toLocaleString('ru')} ₽`, price: camTotal },
    { icon: '📼', name: `NVR ${nvrCh}-кан.`, spec: '1 шт', price: nvrPrice },
    { icon: '💾', name: `HDD ${hddLabel} WD Purple`, spec: `${storageDays[pkgId]} дней архива`, price: hddTotal },
    ...(cableM > 0 ? [{ icon: '🔌', name: 'Кабельная разводка', spec: `~${cableM} м Cat5e`, price: cableTotal }] : []),
    { icon: '🔧', name: isWireless ? 'Монтаж (беспроводной)' : 'Монтаж и настройка', spec: `База + ${camQty} точек`, price: installTotal },
    ...wifiItems,
    ...solarItems,
    ...upsItems,
    ...extraItems,
  ];

  return {
    camQty, nvrCh, hddLabel, cableM,
    subtotal, discount, total,
    pkgName:  pkgNames[pkgId]  || pkgId,
    pkgColor: pkgColors[pkgId] || '#00d4ff',
    items: allItems,
    storageDays: storageDays[pkgId],
    isWireless,
    marketFactor: MARKET_FACTOR,
  };
}

/**
 * Получить сводку цен для отображения на frontend
 */
function getPriceSummary() {
  return Object.entries(MARKET_PRICES_2026).reduce((acc, [k, v]) => {
    acc[k] = v; return acc;
  }, {});
}

module.exports = { calculateSpec, getPriceSummary, MARKET_PRICES_2026, MARKET_FACTOR };
