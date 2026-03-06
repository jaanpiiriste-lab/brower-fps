# Browser FPS (Vanilla JS)

A simple first-person shooter that runs fully in the browser using only HTML, CSS, and JavaScript.

## Features

- First-person camera with pointer lock mouse look
- WASD movement with wall collision
- Jump mechanic with simple gravity
- Raycast world with stylized 3D-like shading and post effects
- In-world 3D props for shop/checkpoint terminals
- 3D pit geometry (no floating ring markers)
- 4-gun loadout (Pistol, SMG, Shotgun, Rifle) with hotbar
- New guns are shop unlocks (start with pistol only)
- Enemy spawning, patrol movement, enemy gunfire, and dash monster attacks
- Parkour pit section with real hole-style visuals
- Casino checkpoint + guarded sentry objective
- Shop zone for weapon unlocks and utility upgrades
- 3 playable maps with in-game map cycling
- Loot drops (ammo, fake cash, med, armor)
- Health + armor + score + ammo + weapon + objective HUD
- Minimap for player, enemies, checkpoint, and shop
- Procedural background music (Web Audio API)
- Game Over screen with restart button
- Runs offline with no dependencies

## Project Structure

```text
fps-game/
|-- index.html
|-- style.css
|-- game.js
`-- README.md
```

## Controls

- `Click`: Lock pointer / start focus
- `Mouse`: Look around
- `W A S D`: Move
- `Space`: Jump
- `Left Mouse Button`: Shoot
- `1-4` or `Mouse Wheel`: Swap weapons
- `M`: Switch to next map (resets run on that map)
- `E`: Interact (checkpoint/shop)
- Music starts after first click/pointer lock

## How To Run

1. Download or clone this repository.
2. Open `index.html` directly in Chrome, Edge, or Firefox.

No install, build step, package manager, or server is required.

## GitHub Pages Deployment

1. Create a new repository on GitHub.
2. Upload `index.html`, `style.css`, `game.js`, and `README.md`.
3. Open `Settings -> Pages`.
4. Under "Build and deployment", choose source: `Deploy from a branch`.
5. Select branch: `main` and folder: `/ (root)`.
6. Save.

Your game URL will be:

```text
https://yourusername.github.io/repository-name/
```

## Screenshot Placeholder

Add screenshots here later:

- `screenshots/gameplay-1.png`
- `screenshots/game-over.png`

## Notes

- The game targets smooth rendering with `requestAnimationFrame` and delta-time movement.
- Everything is implemented in vanilla browser APIs and works offline.
