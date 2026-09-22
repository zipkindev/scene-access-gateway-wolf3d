# Sources and notices

## Browser runtime

- Upstream: <https://github.com/lazarv/wolf3d>
- Description: HTML5/JavaScript Wolfenstein 3D browser port.
- Local status: substantially adapted for same-origin binary data loading,
  Wolfenstein/Spear profiles, audio, mobile controls, saves, and portal framing.
- License artifact: the migrated runtime contained `runtime/LICENSE`, a copy of
  GPL-3.0. Confirm its applicability and preserve all required corresponding
  source/notices before public distribution.

## Original engine source reference

- id Software Wolfenstein 3D source: <https://github.com/id-Software/wolf3d>

## Portal integration

- `integration/future-wolf3d-crt.js` was developed as part of the Scene Access
  Gateway portal work and is maintained here as the extension controller.

## Excluded content

No original game maps, sprites, textures, UI artwork, music, sound effects, or
binary datasets are intended for Git. The import manifest contains filenames,
sizes, and hashes solely to recognize supported user-supplied copies.
