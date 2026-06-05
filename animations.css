/* ─── GAZE ANIMATIONS — Clean & Minimal ─────────────────────────────────────── */

/* Spin utility */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Fade-in */
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Gentle rise */
@keyframes riseUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Soft scale-in */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

/* Slide in from right */
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Pulse for online-dot */
@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.6; transform: scale(1.3); }
}

/* Shimmer skeleton */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

/* Success check */
@keyframes checkDraw {
  from { stroke-dashoffset: 100; }
  to   { stroke-dashoffset: 0; }
}

/* Orb drift — subtle, slow */
@keyframes orbDrift {
  0%   { transform: translate(0, 0)    scale(1); }
  33%  { transform: translate(18px, -12px) scale(1.04); }
  66%  { transform: translate(-10px, 8px)  scale(0.97); }
  100% { transform: translate(0, 0)    scale(1); }
}

/* Number count-up visual (opacity trick, no flicker) */
@keyframes countUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Invoice row entrance */
@keyframes invoiceRow {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* Toast slide-up */
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes toastOut {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0; transform: translateX(-50%) translateY(8px); }
}

/* Guide item zoom sticker */
@keyframes zoomIn {
  from { transform: scale(0.82); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

/* ─── UTILITY CLASSES ────────────────────────────────────────────────────────── */

.animate-in {
  animation: riseUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.fade-in {
  animation: fadeIn 0.4s ease both;
}

.scale-in {
  animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Stagger children */
.stagger-children > * {
  opacity: 0;
  animation: riseUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.stagger-children > *:nth-child(1)  { animation-delay: 0.04s; }
.stagger-children > *:nth-child(2)  { animation-delay: 0.09s; }
.stagger-children > *:nth-child(3)  { animation-delay: 0.14s; }
.stagger-children > *:nth-child(4)  { animation-delay: 0.19s; }
.stagger-children > *:nth-child(5)  { animation-delay: 0.24s; }
.stagger-children > *:nth-child(6)  { animation-delay: 0.29s; }

/* ─── SHIMMER SKELETON ───────────────────────────────────────────────────────── */
.shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(255,255,255,0.07) 50%,
    rgba(255,255,255,0.03) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border-radius: 10px;
}

/* ─── ORB BACKGROUND ─────────────────────────────────────────────────────────── */
.auth-bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
  animation: orbDrift 18s ease-in-out infinite;
}
.auth-bg-orb-1 {
  width: 260px; height: 260px;
  background: radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%);
  top: -80px; right: -60px;
  animation-delay: 0s;
}
.auth-bg-orb-2 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(0,255,148,0.06) 0%, transparent 70%);
  bottom: 80px; left: -40px;
  animation-delay: -6s;
}

/* ─── INVOICE ROWS ───────────────────────────────────────────────────────────── */
.invoice-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 13px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  animation: invoiceRow 0.4s ease both;
}
.invoice-row:last-child { border-bottom: none; }

/* ─── SUCCESS ICON ───────────────────────────────────────────────────────────── */
.order-success {
  display: none;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 20px;
  animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.order-success.show {
  display: flex;
}
.success-icon {
  width: 68px; height: 68px;
  border-radius: 50%;
  background: rgba(0,255,148,0.1);
  border: 2px solid rgba(0,255,148,0.3);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 18px;
  animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
}
.success-icon svg {
  width: 30px; height: 30px;
  color: var(--accent-2);
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
  animation: checkDraw 0.6s ease 0.3s both;
}

/* ─── TOAST ──────────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 90px; left: 50%;
  transform: translateX(-50%) translateY(12px);
  background: rgba(20,25,35,0.95);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  padding: 10px 20px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  z-index: 9999;
  opacity: 0;
  pointer-events: none;
  backdrop-filter: blur(16px);
  transition: opacity 0.25s, transform 0.25s;
  max-width: calc(100vw - 48px);
  text-align: center;
}
.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.toast.error  { border-color: rgba(255,80,80,0.4);   background: rgba(30,10,10,0.95); }
.toast.success { border-color: rgba(0,255,148,0.3);   background: rgba(5,20,12,0.95);  }
.toast.warning { border-color: rgba(255,200,0,0.3);   background: rgba(20,18,5,0.95);  }

/* ─── NAV ITEM PRESS ─────────────────────────────────────────────────────────── */
.nav-item:active {
  transform: scale(0.9);
  transition: transform 0.1s;
}

/* ─── BUTTON RIPPLE ──────────────────────────────────────────────────────────── */
.btn {
  position: relative; overflow: hidden;
  transition: transform 0.15s, opacity 0.15s, box-shadow 0.2s;
}
.btn:active {
  transform: scale(0.97);
  opacity: 0.9;
}

/* ─── CARD HOVER ─────────────────────────────────────────────────────────────── */
.camera-type-card,
.pkg-card,
.kit-card {
  transition: transform 0.2s cubic-bezier(0.16,1,0.3,1),
              border-color 0.2s ease,
              box-shadow 0.2s ease;
}
.camera-type-card:active,
.pkg-card:active,
.kit-card:active {
  transform: scale(0.98);
}
.camera-type-card.selected,
.pkg-card.selected {
  transform: scale(1.01);
}

/* ─── GUIDE ITEM EXPAND ──────────────────────────────────────────────────────── */
.guide-item {
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  overflow: hidden;
}
.guide-item h4 { margin: 0 0 0 0; font-size: 14px; font-weight: 600; }
.guide-item p  { display: none; margin: 10px 0 0; font-size: 13px; line-height: 1.6; color: var(--text-secondary); }
.guide-item-active { border-color: rgba(0,212,255,0.2); background: rgba(0,212,255,0.03); }
.guide-item-active h4 { color: var(--accent); }
.guide-item-active p  {
  display: block;
  animation: riseUp 0.3s ease both;
}
.guide-item-zoom {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.guide-item-active .guide-item-zoom {
  transform: scale(1.18);
}

/* ─── FAQ ITEM ───────────────────────────────────────────────────────────────── */
.faq-item {
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.2s;
}
.faq-item h4 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
.faq-item p  { margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-secondary); }

/* ─── SPINNER ────────────────────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: middle;
}

/* ─── ONLINE PULSE ───────────────────────────────────────────────────────────── */
.online-pulse {
  animation: pulseDot 2s ease-in-out infinite;
}

/* ─── STEP PROGRESS ──────────────────────────────────────────────────────────── */
.step-dot-circle {
  transition: background 0.3s, border-color 0.3s, transform 0.3s;
}
.step-dot.active .step-dot-circle {
  transform: scale(1.15);
}
.step-dot.done .step-dot-circle {
  transition-delay: 0.05s;
}

/* ─── INPUT FOCUS GLOW ───────────────────────────────────────────────────────── */
.input-group input:focus,
.input-group textarea:focus {
  animation: none;
  box-shadow: 0 0 0 2px rgba(0,212,255,0.2);
  border-color: rgba(0,212,255,0.4);
  transition: box-shadow 0.2s, border-color 0.2s;
}

/* ─── CHECKBOX CHECK ANIMATION ───────────────────────────────────────────────── */
.checkbox-row .custom-checkbox svg {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  transition: stroke-dashoffset 0.25s ease;
}
.checkbox-row.checked .custom-checkbox svg {
  stroke-dashoffset: 0;
}

/* ─── PRO ITEM CARD ──────────────────────────────────────────────────────────── */
.pro-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
}
.pro-item-card:active  { transform: scale(0.98); }
.pro-item-card.selected {
  border-color: rgba(0,212,255,0.4);
  background: rgba(0,212,255,0.04);
}
.pro-item-name  { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
.pro-item-spec  { font-size: 11px; color: var(--text-muted); }
.pro-item-price { font-size: 13px; font-weight: 700; color: var(--accent); white-space: nowrap; margin-left: 10px; }

.pro-qty-picker {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
}
.pro-qty-btn {
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(0,212,255,0.12); border: 1px solid rgba(0,212,255,0.2);
  color: var(--accent); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.pro-qty-btn:active { background: rgba(0,212,255,0.25); }
.pro-qty-val { font-size: 15px; font-weight: 700; min-width: 20px; text-align: center; }

/* ─── SCANNING SPIN ──────────────────────────────────────────────────────────── */
#scanning-overlay .spin-ring {
  animation: spin 0.8s linear infinite;
}

/* ─── REMOVE ALL LEGACY EFFECTS ──────────────────────────────────────────────── */
/* Удалены: .cctv-scanline, .radar-scan, .digit-flicker, .glitch, .crt-* */

/* ─── STAGGER INDIVIDUAL ─────────────────────────────────────────────────────── */
.stagger-1 { animation-delay: 0.04s !important; }
.stagger-2 { animation-delay: 0.09s !important; }
.stagger-3 { animation-delay: 0.14s !important; }
.stagger-4 { animation-delay: 0.19s !important; }
