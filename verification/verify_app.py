from playwright.sync_api import sync_playwright
import os

def run_verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Try to load the app
        try:
            print("Navigating to http://localhost:3000...")
            page.goto("http://localhost:3000", timeout=30000)
            page.wait_for_timeout(2000)

            # Take screenshot of the landing page
            os.makedirs("verification/screenshots", exist_ok=True)
            page.screenshot(path="verification/screenshots/landing.png")
            print("Landing page screenshot saved.")

            # Click start button
            start_btn = page.query_selector("#btn-landing-start")
            if start_btn:
                print("Clicking start button...")
                start_btn.click()
                page.wait_for_timeout(3000)
                page.screenshot(path="verification/screenshots/auth_screen.png")
                print("Auth screen screenshot saved.")
            else:
                print("Start button not found.")

            # Check for error message
            status = page.query_selector("#auth-status")
            if status:
                print(f"Auth status: {status.inner_text()}")

        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run_verify()
