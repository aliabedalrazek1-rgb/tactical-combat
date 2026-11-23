# Tactical Combat

Yard 01 is a third-person browser training range. Knock down the five plates with the starting P9, or holster it and step onto the marked mat to spar with the partner in orange. The partner holds guard, telegraphs alternating attacks, and gets back up after a knockout. Restarting the range restores the player, partner, plates and ammunition.

## Run locally

Use Node.js 22.12+ in the 22.x series, or Node.js 24+, and a browser with WebGL 2.

```sh
npm ci
npm run dev
```

Open the Vite address at `/tactical-combat/`. To serve the production build, use `npm run build` and `npm run preview`. Add `-- --host 0.0.0.0` to either server to test from a reachable device.

## Controls

| Default input | Action |
| --- | --- |
| W / A / S / D | Move |
| Right-button drag, or arrow keys | Look |
| J or left click | Fire, strike, or counter during an opening |
| K or right button | Aim with a firearm, guard in close combat |
| U / I / O | Heavy strike / kick / shove |
| L | Dodge in the movement direction, or backstep while stationary |
| Shift / Space | Run / jump |
| R | Reload |
| H | Holster or draw the previous item |
| B | Open loadout |
| Escape or P | Pause or resume |

Open **Pause → Controls** to replace, add, remove or reset bindings. A conflict offers an explicit reassignment. Escape always works as a pause shortcut. Tab, Enter and the visible Pause button keep menus accessible. Camera settings include a drag button, separate horizontal and vertical sensitivity, inversion, and an explicit **Resume with pointer lock** button. The P9 retains the original hold-to-fire assist, which can be disabled here.

On a touchscreen, use the joystick, swipe anywhere on open ground to look, and use the action buttons with other fingers. Strike and Guard replace Fire and Aim when using a close-combat loadout. Open the touch layout editor to move controls in the preview or with sliders, resize individual controls, mirror either layout, or restore its defaults. Phones and tablets keep separate layout settings. Bindings and layouts save in the current browser.

## Practice

From spawn, holster and walk toward the orange partner. A jab needs close range and forward facing. A kick while approaching from farther away becomes a step kick. Heavy attacks and missed swings leave a recovery window. Guard toward the attacker to absorb a blow. Tap guard as the partner's windup ends, then press strike to counter. A timed dodge also creates a counter opening. The HUD shows the active move and sparring outcome. Running, attacking and defending spend stamina. Repeated blocks reduce balance and can break guard.

Select **Unarmed**, **Knife**, **Baton**, or a firearm in the paused loadout menu, then resume. The blade is quick at short range. The baton reaches farther, recovers more slowly and absorbs more impact while guarding. Switch requests made during an attack or stagger wait for recovery. Switching interrupts reloads and preserves each weapon's remaining rounds.

### Firearms

Damage, range and timing below are game balance values. Damage for the shotguns is per pellet.

| Weapon | Mode | Damage | Range | Capacity | Seconds between shots | Reload (s) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Field Assault Rifle | Auto | 27 | 92 | 30 | 0.105 | 1.80 |
| Forge Heavy Rifle | Auto | 36 | 108 | 22 | 0.150 | 2.20 |
| Swift Compact Carbine | Auto | 23 | 73 | 26 | 0.090 | 1.55 |
| Arc Bullpup | Auto | 30 | 95 | 28 | 0.115 | 1.95 |
| P9 Pistol | Semi | 34 | 65 | 12 | 0.240 | 1.15 |
| Anvil Heavy Pistol | Semi | 49 | 72 | 8 | 0.350 | 1.40 |
| Needle Machine Pistol | Auto | 16 | 40 | 20 | 0.075 | 1.25 |
| Kite Compact SMG | Auto | 19 | 49 | 25 | 0.085 | 1.36 |
| Flux Rapid SMG | Auto | 15 | 43 | 36 | 0.060 | 1.63 |
| Slide Pump Shotgun | Pump | 8 × 12 | 33 | 6 | 0.830 | 2.40 |
| Echo Semi Shotgun | Semi | 7 × 10 | 29 | 8 | 0.360 | 2.15 |
| Ridge Marksman Rifle | Semi | 54 | 140 | 12 | 0.390 | 2.10 |
| Spire Bolt Rifle | Bolt | 90 | 175 | 5 | 1.080 | 2.75 |

## Development and verification

```sh
npm run typecheck
npm test
npm run build
```

The Vitest suite covers bindings, pointer ownership, movement and Rapier collisions, attack phases, defensive reactions, melee equipment, all 13 firearm definitions, ammo transitions and restart poses. For the browser checks, start the preview server and run the following with Python Playwright and Chromium installed.

```sh
python tests/browser/range.py http://localhost:4173/tactical-combat/
```

Set `CHROMIUM` to use a specific executable. The browser script exercises the production page through keyboard, mouse and emulated touch input. Its optional trailing arguments select `desktop`, `spar`, `touch`, `remap`, `overlap`, or `timing`. These checks use Chromium's software renderer. Physical Android, tablet, Windows and touchpad performance require separate hardware testing.

The fixed-step loop in `src/main.ts` connects gameplay input, Rapier movement, combat, animation and the HUD. `fighter.ts` handles timed actions and directional contact. `weapon.ts` owns weapon definitions, ammo, spread and the loadout. `sparring.ts` runs the scripted mat partner. Character animation and weapon geometry are procedural. Costume geometry is batched by animated bone and shot effects are pooled.

## GitHub Pages

Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow checks pull requests and deploys successful builds from `main` at `/tactical-combat/`.
