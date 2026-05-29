from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(2000)

    # Bypass auth and go to Home
    page.evaluate("""
        localStorage.setItem('gaze_seen_landing', 'true');
        App.state.user = {
            id: 1,
            full_name: 'Иван Иванов',
            role: 'admin',
            referral_code: 'abcd1234',
            bonus_balance: 500
        };
        App.state.orderCount = 5;
        App.showScreen('home');
    """)
    page.wait_for_timeout(1000)
    page.screenshot(path="verification/screenshots/home.png")

    # 1. Calculator
    page.click("button[data-screen='calculator']")
    page.wait_for_timeout(1000)
    page.fill("#area-input", "150")
    page.click(".camera-type-card[data-type='indoor']")
    page.click("#btn-calc1-next")
    page.wait_for_timeout(1000)

    page.click(".pkg-card[data-pkg='standard']")
    page.wait_for_timeout(500)
    page.click(".days-hint[data-val='30']")
    page.screenshot(path="verification/screenshots/calc_step2.png")

    page.click("#btn-calc2-next")
    page.wait_for_timeout(1000)
    page.screenshot(path="verification/screenshots/calc_result.png")

    # 2. Profile (Referral)
    page.click("button[data-screen='profile']")
    page.wait_for_timeout(1000)
    page.screenshot(path="verification/screenshots/profile.png")

    # 3. Admin Panel
    page.click("button[data-screen='admin']")
    page.wait_for_timeout(1000)
    # Mock stats response for visual
    page.evaluate("""
        const statsCont = document.getElementById('admin-stats-container');
        if (statsCont) statsCont.innerHTML = `
            <div class="stat-box"><div class="stat-box-label">Выручка</div><div class="stat-box-value">450 000 ₽</div></div>
            <div class="stat-box"><div class="stat-box-label">Заказы</div><div class="stat-box-value">24</div></div>
            <div class="stat-box"><div class="stat-box-label">Клиенты</div><div class="stat-box-value">18</div></div>
            <div class="stat-box"><div class="stat-box-label">За неделю</div><div class="stat-box-value">+5</div></div>
        `;
    """)
    page.screenshot(path="verification/screenshots/admin_stats.png")

    page.click(".admin-tab[data-tab='orders']")
    page.wait_for_timeout(500)
    page.screenshot(path="verification/screenshots/admin_orders.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos",
            viewport={'width': 390, 'height': 844}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
