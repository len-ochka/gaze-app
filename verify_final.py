import asyncio
from playwright.async_api import async_playwright
import os
import subprocess

async def run():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        context = await browser.new_context(viewport={'width': 390, 'height': 844})
        page = await context.new_page()

        # Start server
        server_proc = subprocess.Popen(['node', 'server/app.js'], env=os.environ)
        await asyncio.sleep(5)

        try:
            await page.goto('http://localhost:3000')
            await asyncio.sleep(1)
            await page.screenshot(path='v_1_landing.png')

            # Click landing start
            await page.click('#btn-landing-start')
            await asyncio.sleep(2)
            await page.screenshot(path='v_2_auth.png')

            # Click guest enter
            await page.click('#btn-guest-enter')
            await asyncio.sleep(2)
            await page.screenshot(path='v_3_home.png')

            # Close welcome modal if it appears
            try:
                await page.click('text=Остаться гостем', timeout=3000)
                await asyncio.sleep(1)
            except:
                pass

            # Go to calculator
            await page.click('[data-screen="calculator"]')
            await asyncio.sleep(1)
            await page.fill('#area-input', '100')
            await page.click('.cam-type-card[data-type="indoor"]')
            await page.click('#btn-calc1-next')
            await asyncio.sleep(1)
            await page.screenshot(path='v_4_calc_step2.png')

            # Select package
            await page.click('.pkg-card[data-pkg="standard"]')
            await page.click('#btn-calc2-next')

            # Wait for scanning animation
            await asyncio.sleep(2)
            await page.screenshot(path='v_5_scanning.png')

            # Wait for result
            await asyncio.sleep(4)
            await page.screenshot(path='v_6_result.png')

            # Go to Profile and check Referral Hub
            await page.click('[data-screen="profile"]')
            await asyncio.sleep(1)
            await page.screenshot(path='v_7_profile_ref_hub.png')

        finally:
            server_proc.terminate()
            await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
