# Emulsion transfer animation

`emulsion_transfer.py` extracts the interface-crossing scene from the team-provided Manim animation. It preserves the molecular wrapping and camera zoom, while omitting the pipetting and centrifuge overview scenes.

Render with Manim Community 0.22.1:

```sh
python -m manim -qm --media_dir media tools/animations/emulsion_transfer.py EmulsionTransferWeb
```

The published asset is `videos/experiment-emulsion-transfer.mp4` (720p, H.264). The poster is `images/experiment-emulsion-transfer.jpg`.

This is a schematic explanation, not experimental evidence. Molecular sizes, distances, colors, and elapsed time are illustrative.
