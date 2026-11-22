# Tactical Combat

A browser-based third-person training range. Explore Yard 01, use its cover, and knock down all five practice targets. Restart the range from the pause menu to reset the targets and ammunition. The range has no hostile opponents.

## Run locally

Requires Node.js 22.12+ in the 22.x series, or Node.js 24+. The browser needs WebGL 2.

```sh
npm install
npm run dev
```

Open the address Vite prints with the `/tactical-combat/` path. To serve the production build locally, run `npm run build` and then `npm run preview`. Pass `-- --host 0.0.0.0` to either server to test from a reachable device.

| Keyboard | Action |
| --- | --- |
| W / A / S / D | Move |
| Arrow keys | Look |
| J | Fire |
| K | Hold to aim |
| Shift | Hold to run |
| Space | Jump |
| R | Reload |
| Escape | Pause or resume |

With a mouse or touchpad, drag with the right button to look and aim and press the left button to fire. On a touchscreen, use the left joystick to move and swipe the right side of the arena to look. The action buttons accept independent touches so looking, movement, and firing can overlap. The pause menu saves sensitivity, button size, and graphics settings on the current browser. Low quality reduces resolution and disables shadows.

## Development

- `npm run typecheck` checks TypeScript.
- `npm test` runs the Vitest suite, including tests against Rapier's real collision queries.
- `npm run build` type-checks and builds into `dist/`.
- `src/main.ts` connects the fixed-step simulation to rendering and the HUD.
- `src/input.ts`, `movement.ts`, `physics.ts`, and `camera.ts` handle player control and collision.
- `src/weapon.ts` contains the pistol definition and weapon timing. `src/combat.ts` handles damage and classifies shot results.
- `src/arena.ts`, `rendering.ts`, and `animation.ts` build and render the yard, targets, character, and shot effects. The static arena uses instanced geometry, and shadow updates run at a reduced rate.
- `src/ui.ts` and `settings.ts` handle the HUD and local preferences. The arena and character use original procedural geometry with no external asset downloads.

## GitHub Pages

Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The workflow checks pull requests and deploys successful builds from `main` at `/tactical-combat/`.
