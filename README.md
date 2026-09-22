# Scene Access Gateway — Wolf3D extension

Optional Wolfenstein 3D and Spear of Destiny browser-runtime integration for
[Scene Access Gateway](../scene-access-gateway).

This repository contains the adapted browser engine, CRT controller, mobile
controls, data verification manifest, and installation tooling. It does **not**
contain commercial Wolfenstein 3D or Spear of Destiny game data.

## Requirements

- Node.js 22 or newer for validation and data import;
- a local checkout of `scene-access-gateway`;
- legally obtained, supported Wolfenstein 3D and/or Spear of Destiny data files.

## Import game data

The importer accepts a directory containing the original data files. It
matches filenames case-insensitively and copies only files whose byte length
and SHA-256 match `manifests/supported-data.json`.

```sh
./scripts/import-game-data.sh /path/to/owned/game/files WL6
./scripts/import-game-data.sh /path/to/owned/game/files SOD
./scripts/verify-game-data.sh
```

Use `ALL` instead of `WL6` or `SOD` to import both supported datasets. Imported
files live directly under `runtime/`, are ignored by Git, and must never be
committed or redistributed.

## Use with Scene Access Gateway

Set the absolute path to this checkout, then merge the extension definition:

```sh
export SAG_WOLF3D_EXTENSION_DIR=/absolute/path/to/scene-access-gateway-wolf3d
docker compose \
  -f /path/to/scene-access-gateway/compose.yaml \
  -f compose.extension.yaml \
  up -d
```

The extension mounts the runtime and CRT controller read-only into the backend.
The main repository remains buildable and runnable when this extension is not
installed.

## Source and rights boundary

The browser runtime was adapted from
[`dibdot/uWolf`](https://github.com/dibdot/uWolf), an original browser
raycaster released under GPL-3.0. The local runtime was audited against
upstream commit `80571bbde9897881ca2d9ecaf30e81cb308f37bb`: nine of its twelve
JavaScript modules, both favicons, and the GPL license remain byte-identical;
the other runtime files contain the Scene Access Gateway adaptations.

This repository is distributed under GPL-3.0. See [`LICENSE`](LICENSE),
[`NOTICE.md`](NOTICE.md), and [`SOURCES.md`](SOURCES.md) for the license,
authorship, modification, and source record. The upstream project excludes
Wolfenstein/Spear game content and so do we.

See [`SOURCES.md`](SOURCES.md) and [`docs/PUBLISHING-REVIEW.md`](docs/PUBLISHING-REVIEW.md)
before making this repository public. Wolfenstein 3D, Spear of Destiny, id
Software, Bethesda, ZeniMax, Microsoft, and related marks and game content
belong to their respective owners. This project is not affiliated with or
endorsed by them.
