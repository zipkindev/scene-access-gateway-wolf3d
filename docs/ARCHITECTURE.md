# Extension architecture

Scene Access Gateway loads optional extensions from protected read-only mounts.
This repository supplies two such inputs:

1. `runtime/` is served beneath `/wolf3d/` by the gateway backend.
2. `integration/future-wolf3d-crt.js` controls the in-scene CRT, boot sequence,
   game selection, exit behavior, viewport messaging, and WIDE integration.

The core repository owns the surrounding scene, editor, gateway, and access
workflow. This extension owns the game runtime and its game-specific browser
controller. Commercial datasets remain ignored local runtime inputs.
