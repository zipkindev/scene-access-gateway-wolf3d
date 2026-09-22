# Publishing review

The local repository is usable for development, but these gates remain before
creating a public remote:

- Confirm the license chain for the adapted `lazarv/wolf3d` JavaScript source.
- Confirm that `runtime/LICENSE` applies to every redistributed engine file.
- Retain upstream notices and publish corresponding modified source as required.
- Confirm no `.WL*`, `.SOD`, `.SD*`, extracted commercial artwork, audio, maps,
  or save data is tracked anywhere in Git history.
- Choose a license for the independently developed integration/controller code
  that is compatible with the engine's confirmed license.
- Run the clean-checkout and extension Compose acceptance tests.

Public source availability is not, by itself, a license grant. This review is
separate from the user's right to run locally owned game data.
