/* ─── GAZE — Extra / Utility ─────────────────────────────────────────────────── */

/* ─── SCANNING PROGRESS BAR ──────────────────────────────────────────────────── */
#scanning-progress {
  transition: width 1.8s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ─── CHAT ───────────────────────────────────────────────────────────────────── */
.chat-msg {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}
.chat-msg.system {
  align-self: center;
  font-size: 12px;
  color: var(--text-muted);
  background: transparent;
  padding: 8px;
  border-radius: 0;
  max-width: 100%;
  text-align: center;
}

/* ─── ADMIN ───────────────────────────────────────────────────────────────────── */
.admin-order-card {
  background: var(--bg-card);
  padding: 14px;
  border-radius: 14px;
  margin-bottom: 10px;
  border-left: 4px solid var(--accent);
  transition: transform 0.15s;
}
.admin-order-card:active { transform: scale(0.99); }

/* ─── HOME PROMO CARD ────────────────────────────────────────────────────────── */
.home-screen .promo-card:hover {
  box-shadow: 0 8px 40px rgba(0,212,255,0.08);
}

/* ─── PROFILE AVATAR SHIMMER (loading) ───────────────────────────────────────── */
.profile-avatar.loading span {
  visibility: hidden;
}
.profile-avatar.loading::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

/* ─── GUIDE VISUAL ───────────────────────────────────────────────────────────── */
.visual-guide-panel {
  background: rgba(0,212,255,0.03);
  border: 1px solid rgba(0,212,255,0.1);
  border-radius: 14px;
  padding: 14px 16px;
  animation: riseUp 0.3s ease both;
}

/* ─── PKG CARD SELECT RING ───────────────────────────────────────────────────── */
.pkg-card.selected {
  box-shadow: 0 0 0 2px var(--accent);
}

/* ─── ORDER SUCCESS ──────────────────────────────────────────────────────────── */
.order-success h3 {
  font-family: var(--font-display);
  font-size: 20px; font-weight: 700;
  margin-bottom: 8px;
}
.order-success p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 14px;
}

/* ─── TOTAL CARD VARIANTS ────────────────────────────────────────────────────── */
.total-card.gold {
  border-color: rgba(255,215,0,0.25);
  background: rgba(255,215,0,0.03);
}

/* ─── REFERRAL SECTION ───────────────────────────────────────────────────────── */
.ref-invites-section .section-label {
  font-size: 11px; font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

/* ─── OPERATOR LIST ──────────────────────────────────────────────────────────── */
#operators-list .checkbox-row {
  padding: 10px 14px;
  border-radius: 10px;
}

/* ─── ERROR TEXT ─────────────────────────────────────────────────────────────── */
.error-text {
  font-size: 11px;
  color: #ff6060;
  margin-top: 3px;
  display: block;
}
.input-group input.error {
  border-color: rgba(255,80,80,0.5) !important;
}

/* ─── SCROLLABLE AREAS ───────────────────────────────────────────────────────── */
.home-scroll,
.profile-view-wrap,
.admin-scroll,
.faq-scroll,
#calc-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* ─── PLACEHOLDERS ───────────────────────────────────────────────────────────── */
.placeholder-row {
  height: 50px;
  background: var(--bg-card);
  border-radius: 10px;
  margin-bottom: 8px;
}

/* ─── MODAL ──────────────────────────────────────────────────────────────────── */
#center-modal {
  animation: fadeIn 0.2s ease both;
}
#center-modal > div {
  animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* ─── PRO MODE TABS SCROLL ───────────────────────────────────────────────────── */
.pro-tabs {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.pro-tabs::-webkit-scrollbar { display: none; }

/* ─── SUPPORT SCREEN ─────────────────────────────────────────────────────────── */
.support-screen {
  overflow: hidden;
}
#support-chat-messages {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ─── KEYBOARD OFFSET ────────────────────────────────────────────────────────── */
@media (max-height: 640px) {
  .auth-content { padding: 30px 24px 24px; gap: 16px; }
  .landing-hero h1 { font-size: 24px; }
}

/* ─── INVOICE ROWS (spec step 3) ─────────────────────────────────────────────── */
.invoice-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  animation: invoiceRow 0.3s ease both;
}
.invoice-row:last-child { border-bottom: none; }
.invoice-row-icon {
  font-size: 18px;
  width: 28px;
  flex-shrink: 0;
  margin-top: 1px;
}
.invoice-row-body { flex: 1; min-width: 0; }
.invoice-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}
.invoice-row-spec {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
.invoice-row-price-col { flex-shrink: 0; text-align: right; }
.invoice-row-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
}
.compat-results-list {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  margin: 0 20px 10px;
  overflow: hidden;
}
.total-card {
  margin: 0 20px;
}
.price-disclaimer {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  padding: 0 20px 10px;
}

/* ─── TOGGLE SWITCH ──────────────────────────────────────────────────────────── */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 24px;
  transition: background 0.25s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px; height: 18px;
  left: 3px; top: 3px;
  background: white;
  border-radius: 50%;
  transition: transform 0.25s;
}
.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
}
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

/* ─── ADMIN TABS ─────────────────────────────────────────────────────────────── */
.admin-tab {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: 20px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}
.admin-tab.active {
  background: var(--accent-dim);
  border-color: rgba(0,212,255,0.35);
  color: var(--accent);
}
.admin-tab:active { opacity: 0.7; }

.admin-order-filter {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.admin-order-filter.active {
  background: var(--accent-dim);
  border-color: rgba(0,212,255,0.35);
  color: var(--accent);
}

/* ─── PRO TABS ───────────────────────────────────────────────────────────────── */
.pro-tab {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: 16px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  flex-shrink: 0;
}
.pro-tab.active {
  background: rgba(255,215,0,0.1);
  border-color: rgba(255,215,0,0.35);
  color: var(--accent-gold);
}

/* ─── GUIDE / FAQ ITEMS ──────────────────────────────────────────────────────── */
.guide-item, .faq-item {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.guide-item h4, .faq-item h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.guide-item h4::after, .faq-item h4::after {
  content: '+';
  color: var(--accent);
  font-size: 18px;
  font-weight: 300;
  flex-shrink: 0;
  margin-left: 8px;
}
.guide-item p, .faq-item p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 10px;
  margin-bottom: 0;
  display: none;
}
.guide-item.guide-item-active h4::after,
.faq-item.guide-item-active h4::after { content: '−'; }
.guide-item.guide-item-active p,
.faq-item.guide-item-active p { display: block; }
.guide-item-zoom { font-size: 24px; margin-bottom: 8px; }

/* ─── KITS GRID (home) ───────────────────────────────────────────────────────── */
.kits-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.kit-card {
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  transition: border-color 0.2s;
}
.kit-card:active { opacity: 0.85; }
.kit-image-stub {
  width: 56px; height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.kit-info { flex: 1; min-width: 0; }
.kit-info h4 {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
}
.kit-info p {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 10px;
}
.kit-footer { display: flex; justify-content: space-between; align-items: center; }
.kit-price { font-size: 14px; font-weight: 700; }
.kit-add-btn {
  background: var(--accent-dim);
  border: 1px solid rgba(0,212,255,0.25);
  color: var(--accent);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.5px;
}

/* ─── STAR RATING ────────────────────────────────────────────────────────────── */
.star-btn {
  transition: transform 0.15s, opacity 0.15s;
}
.star-btn:active { transform: scale(1.2); }

/* ─── INVITE PILL ────────────────────────────────────────────────────────────── */
.invite-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 10px 14px;
}

/* ─── PROFILE ROW PLACEHOLDER ────────────────────────────────────────────────── */
.profile-row-value.placeholder {
  color: var(--accent);
  font-style: italic;
  font-size: 12px;
}

/* ─── SHIMMER SKELETON ───────────────────────────────────────────────────────── */
.shimmer {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.04) 25%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

/* ─── BTN ACCENT ─────────────────────────────────────────────────────────────── */
.btn-accent {
  background: linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,255,148,0.15));
  border: 1px solid rgba(0,212,255,0.35);
  color: var(--accent);
  border-radius: 14px;
  padding: 14px;
  font-size: 15px;
  font-weight: 700;
  width: 100%;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  font-family: var(--font-display);
}
.btn-accent:active { opacity: 0.8; transform: scale(0.98); }
.btn-accent:disabled { opacity: 0.4; cursor: not-allowed; }

/* ─── ADMIN SCREEN LAYOUT FIX ────────────────────────────────────────────────── */
.admin-screen {
  display: flex;
  flex-direction: column;
  padding-bottom: 80px;
}
.admin-screen .screen-header {
  padding: 20px 20px 12px;
  flex-shrink: 0;
}
.admin-tabs {
  flex-shrink: 0;
}

/* ─── GUIDE BADGE ────────────────────────────────────────────────────────────── */
.guide-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  background: var(--accent-dim);
  border: 1px solid rgba(0,212,255,0.3);
  color: var(--accent);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  vertical-align: middle;
  margin-left: 6px;
}
