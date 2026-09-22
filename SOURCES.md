# Sources and notices

## Browser runtime

- Upstream: <https://github.com/dibdot/uWolf>
- Audited upstream commit: `80571bbde9897881ca2d9ecaf30e81cb308f37bb`
- Upstream author: Dirk Brenken, with Claude Opus 4.8 credited by upstream.
- Description: dependency-free JavaScript raycaster that reads user-supplied
  Wolfenstein 3D and Spear of Destiny data files directly.
- License: GNU General Public License version 3. The root `LICENSE` and
  `runtime/LICENSE` are byte-identical copies of uWolf's license file.
- Local status: nine of twelve JavaScript modules, both favicons, and the
  license matched the audited upstream commit byte-for-byte. `runtime/js/game.js`,
  `runtime/js/main.js`, `runtime/js/variants.js`, `runtime/css/style.css`, and
  `runtime/index.html` contain the portal, Spear, mobile, save, viewport, and
  presentation adaptations maintained by this project.

## Upstream implementation references

- uWolf documents its behavior and data-format implementation as ported and
  verified against GPL-licensed Wolf4SDL:
  <https://github.com/fabiangreffrath/wolf4sdl>
- The explicitly GPL-released id Software browser source is available at:
  <https://github.com/id-Software/wolf3d-browser>

## Portal integration

- `integration/future-wolf3d-crt.js` was developed as part of the Scene Access
  Gateway portal work and is maintained here as the extension controller under
  GPL-3.0 with the rest of this repository.

## Excluded content

No original game maps, sprites, textures, UI artwork, music, sound effects, or
binary datasets are intended for Git. The import manifest contains filenames,
sizes, and hashes solely to recognize supported user-supplied copies.
