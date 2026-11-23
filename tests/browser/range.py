"""Run against a built, running Vite preview with Python Playwright and Chromium."""
import os
import shutil
import sys

from playwright.sync_api import expect, sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/tactical-combat/"
ERRORS = []
MANUAL_FRAMES = """(() => {
  const pending = [];
  let time;
  window.requestAnimationFrame = callback => pending.push(callback);
  window.advanceFrames = (fps, count) => {
    time ??= performance.now();
    for (let i = 0; i < count; i++) {
      time += 1000/fps;
      pending.splice(0).forEach(callback => callback(time));
    }
  };
})()"""


def open_yard(browser, width, height, touch=False, manual_frames=False):
    page = browser.new_page(viewport={"width": width, "height": height},
                            has_touch=touch, is_mobile=touch)
    if manual_frames:
        page.add_init_script(MANUAL_FRAMES)
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.on("console", lambda message: ERRORS.append(message.text) if message.type == "error" else None)
    page.goto(URL)
    expect(page.locator("#loading")).to_be_hidden(timeout=20000)
    page.locator("#pause").click()
    page.locator("#quality").select_option("low")
    page.locator("#resume").click()
    return page


def wait_sim(page, seconds):
    # Match the production catch-up cap so these waits track simulation time.
    page.evaluate("""duration => new Promise(done => {
      if (window.advanceFrames) {
        advanceFrames(60, Math.ceil(duration * 60));
        return done();
      }
      let previous, elapsed = 0;
      function frame(t) {
        if (previous !== undefined) elapsed += Math.min(.25,(t-previous)/1000);
        previous=t;
        if (elapsed >= duration) done(); else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    })""", seconds)


def select_item(page, item):
    page.keyboard.press("KeyB")
    pick = page.locator("#loadout")
    expect(pick).to_be_focused()
    pick.select_option(item)
    label = pick.locator("option:checked").inner_text().upper()
    page.keyboard.press("Escape")
    expect(page.locator("#menu")).to_be_hidden()
    page.evaluate("() => window.advanceFrames?.(60, 28)")
    expect(page.locator("#weapon")).to_have_text(label)
    page.wait_for_function("!document.querySelector('#reload-state').textContent")


def observe_text(page):
    page.evaluate("""() => {
      window.messages = [];
      for (const selector of ['#reload-state','#feedback','#weapon']) {
        const node=document.querySelector(selector);
        new MutationObserver(() => window.messages.push(node.textContent))
          .observe(node,{childList:true,subtree:true,characterData:true});
      }
    }""")


def desktop_checks(browser):
    page = open_yard(browser, 960, 600)
    page.keyboard.press("Escape")
    page.get_by_text("Controls", exact=True).click()
    page.get_by_text("Keyboard and pointer bindings", exact=True).click()
    page.get_by_role("button", name="Fire / strike / counter — J", exact=True).click()
    page.keyboard.press("KeyW")
    expect(page.locator("#binding-status")).to_contain_text("Forward")
    page.locator("#cancel-binding").click()
    page.get_by_role("button", name="Fire / strike / counter — J", exact=True).click()
    page.keyboard.press("KeyF")
    page.keyboard.press("Escape")
    expect(page.locator("#menu")).to_be_hidden()
    page.keyboard.press("KeyF")
    expect(page.locator("#ammo")).to_have_text("11")
    page.reload()
    expect(page.locator("#loading")).to_be_hidden()
    page.keyboard.press("KeyJ")
    wait_sim(page,.25)
    expect(page.locator("#ammo")).to_have_text("12")
    page.keyboard.press("KeyF")
    expect(page.locator("#ammo")).to_have_text("11")

    # Independent aim, movement, drag-look and firing, then actual explicit pointer lock.
    page.keyboard.down("KeyW")
    page.mouse.move(400,275)
    page.mouse.down(button="right")
    page.mouse.move(460,270,steps=4)
    expect(page.locator("#crosshair")).to_have_class("crosshair aim")
    wait_sim(page,.25)
    page.mouse.click(460,270)
    expect(page.locator("#ammo")).to_have_text("10")
    page.mouse.up(button="right")
    page.keyboard.up("KeyW")
    page.keyboard.press("Escape")
    page.get_by_text("Controls", exact=True).click()
    page.locator("#lock").click()
    page.wait_for_function("document.pointerLockElement === document.querySelector('#surface')")
    page.mouse.move(490,280,steps=3)
    page.keyboard.press("KeyP")
    expect(page.locator("#menu")).to_be_visible()
    page.wait_for_function("!document.pointerLockElement")
    page.locator("#restart").click()

    # Assignment 1 regression: the original P9 can clear the opening plate while held.
    page.keyboard.down("KeyF")
    expect(page.locator("#score")).to_have_text("1 / 5",timeout=8000)
    page.keyboard.up("KeyF")
    page.keyboard.press("Escape")
    page.locator("#restart").click()
    observe_text(page)
    options = page.locator("#loadout optgroup:not(:first-child) option").evaluate_all(
        "options => options.map(o=>[o.value,o.text])")
    assert len(options) == 13
    for value, name in options:
        select_item(page,value)
        expect(page.locator("#weapon")).to_have_text(name.upper())
        capacity = int(page.locator("#ammo").inner_text())
        page.keyboard.press("KeyF")
        expect(page.locator("#ammo")).to_have_text(str(capacity-1))
        page.keyboard.press("KeyR")
        expect(page.locator("#reload-state")).to_have_text("RELOADING…")
        if value in ["p9","slide","flux","spire"]:
            expect(page.locator("#ammo")).to_have_text(str(capacity), timeout=10000)
    select_item(page,"unarmed")
    print("Desktop bindings, drag, pointer lock, 13 equips/shots/reloads passed",flush=True)

    page.close()


def spar_checks(browser):
    page = open_yard(browser, 860, 560)
    observe_text(page)

    def restart_spar():
        page.keyboard.press("Escape")
        page.locator("#restart").click()
        page.keyboard.press("KeyH")
        wait_sim(page,.40)
        page.keyboard.down("KeyW")
        wait_sim(page,.52)
        page.keyboard.up("KeyW")
        expect(page.locator("#weapon")).to_have_text("UNARMED")

    restart_spar()
    # The partner guards during approach. Attack in the visible opening.
    page.wait_for_function("document.querySelector('#partner-state').textContent === 'guard'")
    page.wait_for_function("document.querySelector('#partner-state').textContent === 'Ready'")
    page.keyboard.press("KeyJ")
    expect(page.locator("#feedback")).to_have_text("HIT")
    expect(page.locator("#partner-health")).to_have_js_property("value",90)
    page.wait_for_function("!document.querySelector('#reload-state').textContent")
    page.keyboard.press("KeyI")
    wait_sim(page,.22)
    assert "KICK" in page.evaluate("window.messages"), page.evaluate("window.messages")
    page.keyboard.press("Escape")
    value = page.locator("#stamina").get_attribute("value")
    page.wait_for_timeout(600)
    assert value == page.locator("#stamina").get_attribute("value")
    page.locator("#restart").click()
    expect(page.locator("#health")).to_have_text("100")
    expect(page.locator("#ammo")).to_have_text("12")

    page.close()
    page = open_yard(browser, 860, 560, manual_frames=True)
    observe_text(page)
    restart_spar()
    # Drive render frames explicitly so input arrives in the visible parry window even on a slow renderer.
    preparing = page.evaluate("""() => {
      const state = document.querySelector('#partner-state');
      for (let i = 0; i < 150 && state.textContent !== 'Preparing Heavy punch'; i++)
        advanceFrames(60, 1);
      return state.textContent;
    }""")
    assert preparing == "Preparing Heavy punch"
    wait_sim(page,.17)
    page.keyboard.down("KeyK")
    wait_sim(page,.12)
    expect(page.locator("#feedback")).to_contain_text("PARRIED",timeout=2000)
    page.keyboard.press("KeyJ")
    page.keyboard.up("KeyK")
    wait_sim(page,.12)
    expect(page.locator("#partner-health")).to_have_js_property("value",78)
    assert "COUNTER" in page.evaluate("window.messages")
    wait_sim(page,.50)
    page.keyboard.press("KeyL")
    wait_sim(page,.05)
    expect(page.locator("#reload-state")).to_have_text("DODGE")
    wait_sim(page,.50)
    for item, move in [("knife","TRAINING BLADE"),("baton","BATON SWING")]:
        select_item(page,item)
        page.keyboard.press("KeyJ")
        wait_sim(page,.12)
        page.wait_for_function("move => window.messages.includes(move)",arg=move)
        wait_sim(page,.9)
    select_item(page,"p9")
    page.keyboard.press("KeyJ")
    wait_sim(page,.05)
    expect(page.locator("#ammo")).to_have_text("11")
    print("Desktop sparring contact, kick, pause/restart, parry, counter, dodge and gear transitions passed",flush=True)
    page.close()


def touch_checks(browser):
    page = open_yard(browser,390,844,True)
    cdp = page.context.new_cdp_session(page)

    def point(selector, identifier):
        box = page.locator(selector).bounding_box()
        return {"id":identifier,"x":box["x"]+box["width"]/2,"y":box["y"]+box["height"]/2}

    def touches(kind, *points):
        cdp.send("Input.dispatchTouchEvent",{"type":kind,"touchPoints":list(points)})

    stick = point("#joystick",1)
    look = {"id":2,"x":210,"y":300}
    fire = point("[data-action=fire]",3)
    touches("touchStart",stick)
    touches("touchStart",stick,look)
    touches("touchStart",stick,look,fire)
    touches("touchMove",{**stick,"y":stick["y"]-28},{**look,"x":220},fire)
    expect(page.locator("#ammo")).to_have_text("11")
    assert "translate" in page.locator("#knob").get_attribute("style")
    touches("touchCancel")
    expect(page.locator("[data-action=fire]")).not_to_have_class("held")
    page.locator("[data-action=holster]").tap()
    wait_sim(page,.42)
    page.locator("[data-action=fire]").tap()
    expect(page.locator("#reload-state")).to_have_text("JAB")
    page.locator("#pause").tap()
    page.get_by_text("Controls",exact=True).tap()
    page.get_by_text("Touch layout editor",exact=True).tap()
    expect(page.locator("#layout")).to_have_value("phone")
    page.locator("#left-handed").check()
    page.locator("#touch-item").select_option("fire")
    page.locator("#touch-x").fill("34")
    page.locator("#touch-y").fill("53")
    page.locator("#touch-size").fill("1.2")
    page.locator("#resume").tap()
    moved = point("[data-action=fire]",3)
    assert abs(moved["x"]-390*.34)<2
    page.reload()
    expect(page.locator("#loading")).to_be_hidden()
    assert abs(point("[data-action=fire]",3)["x"]-moved["x"])<2
    page.set_viewport_size({"width":844,"height":390})
    wait_sim(page,.1)
    firebox = page.locator("[data-action=fire]").bounding_box()
    assert 0<firebox["y"]<390-firebox["height"]
    page.close()
    page = open_yard(browser,1024,768,True)
    for action in ["fire","aim","run","jump","reload","dodge","holster"]:
        expect(page.locator("[data-action="+action+"]")).to_be_in_viewport()
    page.locator("#pause").tap()
    page.get_by_text("Controls",exact=True).tap()
    page.get_by_text("Touch layout editor",exact=True).tap()
    expect(page.locator("#layout")).to_have_value("tablet")
    page.get_by_text("Keyboard and pointer bindings",exact=True).tap()
    page.get_by_role("button",name="Kick — I",exact=True).tap()
    page.locator("#binding-choice").select_option("KeyV")
    expect(page.get_by_role("button",name="Kick — V",exact=True)).to_be_visible()
    print("Phone three-pointer movement/look/fire, touch attack, layout persistence, rotation and tablet passed",flush=True)
    page.close()


def remap_checks(browser):
    page = open_yard(browser,960,600)
    page.keyboard.press("Escape")
    page.get_by_text("Controls",exact=True).click()
    page.get_by_text("Keyboard and pointer bindings",exact=True).click()
    page.get_by_role("button",name="Fire / strike / counter — add binding").click()
    page.keyboard.press("Space")
    expect(page.locator("#binding-status")).to_contain_text("Jump")
    page.locator("#move-binding").click()
    expect(page.get_by_role("button",name="Fire / strike / counter — Space",exact=True)).to_be_visible()
    expect(page.get_by_role("button",name="Fire / strike / counter — J",exact=True)).to_be_visible()
    page.keyboard.press("Escape")
    page.locator("#pause").focus()
    expect(page.locator("#pause")).to_be_focused()
    page.keyboard.press("Space")
    expect(page.locator("#menu")).to_be_visible()
    expect(page.locator("#ammo")).to_have_text("12")
    page.locator("#default-bindings").click()
    expect(page.get_by_role("button",name="Jump — Space",exact=True)).to_be_visible()
    page.keyboard.press("Escape")
    page.keyboard.press("KeyJ")
    expect(page.locator("#ammo")).to_have_text("11")
    page.close()
    print("Alternate binding, conflict reassignment, keyboard Pause and default reset passed",flush=True)


def touch_overlap_checks(browser):
    page = open_yard(browser,390,844,True)
    page.locator("#pause").tap()
    page.get_by_text("Controls",exact=True).tap()
    page.get_by_text("Touch layout editor",exact=True).tap()
    marker = page.get_by_role("button",name="Position fire",exact=True)
    marker.scroll_into_view_if_needed()
    before = marker.bounding_box()
    page.mouse.move(before["x"]+before["width"]/2,before["y"]+before["height"]/2)
    page.mouse.down()
    page.mouse.move(before["x"]-70,before["y"]-35,steps=5)
    page.mouse.up()
    expect(page.locator("#touch-item")).to_have_value("fire")
    assert marker.bounding_box()["x"] < before["x"]-30
    expect(page.locator("#ammo")).to_have_text("12")
    for action in ["aim","fire"]:
        page.locator("#touch-item").select_option(action)
        page.locator("#touch-x").fill("50")
        page.locator("#touch-y").fill("0")
        page.locator("#touch-size").fill("1.5")
    page.locator("#resume").tap()
    page.locator("[data-action=holster]").tap()
    expect(page.locator("#weapon")).to_have_text("UNARMED")
    expect(page.locator("#partner")).to_be_visible()

    def reachable():
        return page.evaluate("""() => {
          const nodes = [...document.querySelectorAll('[data-action]:not([hidden]),#joystick')];
          const hud = document.querySelector('#partner').getBoundingClientRect();
          return nodes.every(node => {
            const b = node.getBoundingClientRect();
            const onTop = node.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));
            const coversHud = b.left < hud.right && b.right > hud.left && b.top < hud.bottom && b.bottom > hud.top;
            return b.width > 0 && onTop && !coversHud &&
              b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
          });
        }""")

    assert reachable(), "touch control or sparring HUD is obstructed in portrait"
    page.set_viewport_size({"width":844,"height":390})
    wait_sim(page,.12)
    assert reachable(), "touch control or sparring HUD is obstructed in landscape"
    page.close()
    print("Touch preview drag, combat isolation and overlapping layout in both orientations passed",flush=True)


def timing_checks(browser):
    outcomes = {}
    for fps in [10,30,120]:
        page = browser.new_page(viewport={"width":640,"height":400})
        page.add_init_script(MANUAL_FRAMES)
        page.add_init_script("""localStorage.setItem('tactical-combat.settings.v1', '{"quality":"low"}')""")
        page.goto(URL)
        expect(page.locator("#loading")).to_be_hidden(timeout=20000)
        page.keyboard.press("KeyB")
        page.locator("#loadout").select_option("flux")
        page.keyboard.press("Escape")
        page.evaluate("advanceFrames(60,30)")
        expect(page.locator("#ammo")).to_have_text("36")
        page.keyboard.down("KeyJ")
        page.evaluate("fps => advanceFrames(fps, fps*1.2)",fps)
        page.keyboard.up("KeyJ")
        rounds = int(page.locator("#ammo").inner_text())

        page.keyboard.press("KeyH")
        page.evaluate("advanceFrames(60,30)")
        expect(page.locator("#weapon")).to_have_text("UNARMED")
        page.keyboard.press("KeyU")
        page.evaluate("fps => advanceFrames(fps, fps)",fps)
        outcomes[fps] = (rounds,page.locator("#reload-state").inner_text())
        page.close()
    assert len(set(outcomes.values())) == 1 and outcomes[120][1] == "", outcomes
    print(f"Fixed-step firearm and melee timing matched at 10, 30 and 120 FPS: {outcomes}",flush=True)


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.getenv("CHROMIUM") or shutil.which("chromium"),
            args=["--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        checks = {"desktop":desktop_checks, "spar":spar_checks, "touch":touch_checks,
                  "remap":remap_checks, "overlap":touch_overlap_checks, "timing":timing_checks}
        for group in sys.argv[2:] or checks:
            checks[group](browser)
        assert not ERRORS, ERRORS
        browser.close()

