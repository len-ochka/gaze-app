import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Inject mock Telegram WebApp
        await page.add_init_script("""
            window.Telegram = {
                WebApp: {
                    initData: "user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22en%22%7D&auth_date=1620000000&hash=mock_hash",
                    initDataUnsafe: {
                        user: {
                            id: 12345,
                            first_name: "Test",
                            last_name: "User",
                            username: "testuser"
                        }
                    },
                    ready: () => {},
                    expand: () => {},
                    close: () => {},
                    sendData: (data) => { console.log("SendData called with:", data); }
                }
            };
        """)

        await page.goto("http://localhost:8080")

        # Click Start
        await page.click("text=Начать работу")
        await page.wait_for_timeout(1000)

        # Since we don't have a real hash, the backend will fail auth.
        # But for UI verification, we can see if the constructor screen is accessible if we bypass or if we just look at the code.
        # Let's try to trigger the screen change manually in the console if needed,
        # or just verify the elements exist in DOM.

        # Take screenshot of the constructor area (even if hidden)
        await page.evaluate("showScreen('constructor-screen')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="/home/jules/verification/screenshots/constructor.png")

        # Check if Map is initialized (it might fail if API key is invalid/missing but we check the container)
        await page.evaluate("showScreen('map-screen')")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/home/jules/verification/screenshots/map.png")

        # Admin Panel
        await page.evaluate("showScreen('admin-screen')")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="/home/jules/verification/screenshots/admin.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
