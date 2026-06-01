from playwright.sync_api import sync_playwright
import os

def run_verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="verification/videos")
        page = context.new_page()

        try:
            print("Navigating to http://localhost:3000...")
            page.goto("http://localhost:3000", timeout=30000)
            page.wait_for_timeout(1000)

            # Start button on landing
            start_btn = page.query_selector("#btn-landing-start")
            if start_btn:
                print("Clicking start button...")
                start_btn.click()
                page.wait_for_timeout(1000)

            # Guest Login button on auth screen
            guest_btn = page.query_selector("#btn-guest-login")
            if guest_btn:
                print("Clicking guest login button...")
                guest_btn.click()
                page.wait_for_timeout(2000)

            # Check if we are on home screen
            home_title = page.query_selector("#home-username")
            if home_title:
                print(f"Reached home screen. Welcome, {home_title.inner_text()}")

            os.makedirs("verification/screenshots", exist_ok=True)
            page.screenshot(path="verification/screenshots/home_guest.png")
            print("Home screen screenshot saved.")

        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    run_verify()
