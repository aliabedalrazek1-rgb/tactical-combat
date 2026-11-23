"""Run against Vite dev or preview with Python Playwright and Chromium.

Example: python tests/browser_layout.py http://127.0.0.1:5173/tactical-combat/ --chromium /usr/bin/chromium
"""

import argparse

from playwright.sync_api import expect, sync_playwright

LAYOUT = """(firearm) => {
  // Ensure the longest reload label is present for the layout check.
  document.querySelector('#reload-state').textContent = firearm ? 'EMPTY · RELOAD' : 'HEAVY PUNCH';
  const selectors = ['.brand', '.objective', '.pause', '.vitals', '.weapon',
    '#reload-state', '#joystick', '.touch-actions button:not([hidden])'];
  const panels = selectors.flatMap(selector =>
    Array.from(document.querySelectorAll(selector), element =>
      [element.id || element.textContent.trim(), element.getBoundingClientRect()]));
  const problems = [];
  for (const [i, [name, a]] of panels.entries()) {
    if (!a.width || !a.height || a.left < 0 || a.top < 0 ||
        a.right > innerWidth || a.bottom > innerHeight) {
      problems.push(name + ' is hidden or outside the viewport');
    }
    for (const [other, b] of panels.slice(i + 1)) {
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
        problems.push(name + ' overlaps ' + other);
      }
    }
  }
  return problems;
}"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--chromium")
    args = parser.parse_args()
    sizes = [(390, 844), (641, 360), (667, 375), (820, 1180), (1180, 820)]
    failures = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=args.chromium,
            args=["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
        )
        for width, height in sizes:
            page = browser.new_page(
                viewport={"width": width, "height": height},
                is_mobile=True,
                has_touch=True,
            )
            page.goto(args.url)
            expect(page.locator("#loading")).to_be_hidden(timeout=20000)
            failures.extend(f"{width}x{height} firearm: {problem}" for problem in page.evaluate(LAYOUT, True))
            page.keyboard.press("KeyH")
            expect(page.locator("#weapon")).to_have_text("UNARMED")
            failures.extend(f"{width}x{height} melee: {problem}" for problem in page.evaluate(LAYOUT, False))
            page.close()

    if failures:
        parser.exit(1, "\n".join(failures) + "\n")
    print("Touch HUD layout passed at all five viewports.")


if __name__ == "__main__":
    main()
