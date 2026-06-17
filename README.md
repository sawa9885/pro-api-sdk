# BetterExport

BetterExport is an EasyEDA Pro extension that extracts colorful silkscreen image primitive metadata from the current PCB document.

The primary output is a JSON file containing each detected `OBJ` image primitive placement and its EasyEDA `blob:<hash>` reference. This is intended as the first step toward rebuilding Blender/OBJ texture assignments for colorful silkscreen artwork.

## Why this exists

EasyEDA Pro's default OBJ/MTL export currently emits flat material colors. It does not include `map_Kd` texture references for colorful silkscreen image primitives, so Blender cannot automatically recover the original placed PNG artwork from the OBJ export alone.

BetterExport reads the PCB source through `eda.sys_FileManager.getDocumentSource()` and extracts image primitive rows such as:

```json
["OBJ", "e5", 0, 3, "SOILDATA-ai-color-logo-wht.png", -639.7638, 639.7638, 1279.5276, 1279.5276, 0, 0, "blob:3b4870846fa879ae2dcc5573c5fda159991730aa1985c92b719d7133581eef60", 0]
```

## Build

```sh
npm install
npm run build
```

The generated extension package is written to:

```text
./build/dist/
```

## Install in EasyEDA Pro

1. Build the extension with `npm run build`.
2. In EasyEDA Pro, import the generated `.eext` package from `./build/dist/`.
3. Enable the installed extension.
4. Enable the extension's External Interactions permission.
5. Open the PCB document.
6. Run `BetterExport -> Export Textured OBJ + MTL` to export EasyEDA's OBJ with recovered PNG files and BetterExport-injected textured board artwork.

## Output

When the command runs, it:

1. Calls `eda.sys_FileManager.getDocumentFile(..., "epro2")`.
2. Parses the returned EasyEDA ZIP file.
3. Reads `PCB/*.epcb` files for `OBJ` image primitive rows.
4. Reads `BLOB/*.eblob` files for PNG data URLs keyed by blob hash.
5. Prompts you to save recovered PNG files.
6. Prompts you to save a timestamped JSON file.
7. Shows a popup summary of the detected image primitives and save status.

The JSON includes:

   - primitive id
   - layer number
   - filename
   - x
   - y
   - width
   - height
   - rotation
   - mirror flag
   - blob reference
The JSON filename looks like:

```text
better-export-pcb-image-primitives-2026-06-10T04-00-00-000Z.json
```

The PNG and JSON exports intentionally use EasyEDA's save/download dialog instead of silently writing into EasyEDA's documents folder. This makes every output location explicit.

The current main export uses `eda.sys_FileManager.getDocumentFile(..., "epro2")` because it returns a ZIP containing both the PCB source and the blob assets. `PCB/*.epcb` contains the image placements and `BLOB/*.eblob` contains the PNG data URLs.

`eda.pcb_PrimitiveImage.getAll()` remains useful as a placement-only fallback, but it does not expose filename, `blob:<hash>`, or PNG bytes.

## PNG recovery status

BetterExport resolves `blob:<hash>` references by parsing the exported document ZIP. BLOB filenames are base64-encoded blob hashes, and each `.eblob` file contains a `["BLOB", hash, filename, dataUrl]` row.

## Textured OBJ export

EasyEDA's built-in OBJ export does not include texture coordinates for colorful silkscreen images, so adding `map_Kd` lines to the existing MTL is not enough. BetterExport therefore:

1. Calls EasyEDA's built-in OBJ exporter for component models and vias. Built-in silkscreen is omitted because the recovered image texture becomes the visual board artwork.
2. Recovers PNGs from `BLOB/*.eblob`.
3. Adds each PNG beside the OBJ/MTL and also into `textures/` inside the OBJ ZIP.
4. Adds a new MTL material with `map_Kd` for each recovered image.
5. Injects textured geometry into the OBJ for each image primitive, using the image primitive placement, layer, rotation, and mirror data.
6. Corrects bottom-side image placement by treating EasyEDA bottom-layer `OBJ` x coordinates as the mirrored right edge of the image box.
7. Clips injected image geometry to the best matching board outline, then triangulates that clipped shape for OBJ export. BetterExport first tries EasyEDA PCB source layer-11 line/arc outline segments; if this EasyEDA runtime does not expose parseable outline rows, it derives a fallback outline from the board body in EasyEDA's base OBJ export using top boundary edges when available, then a projected outer silhouette when the board body is exported as a closed solid.
8. Maps texture coordinates from the actual placed image primitive corners so clipped and unclipped meshes keep the same orientation, with a physical-view U flip for bottom-side image primitives.
9. Places the top texture decal very close to the board surface so components can render above it.
10. Generates raised ENIG pad meshes from EasyEDA footprint `PAD` rows, including dense boards. Pad placement uses the component side: top components render pads above the top image, while bottom components mirror footprint coordinates and render pads below the bottom image.
11. Generates ENIG annular rings from bottom-layer EasyEDA copper `POLY` circle strokes with line width.
12. Strips likely EasyEDA-generated blue signal/body overlay material faces after board-outline detection, then relies on BetterExport-generated ENIG pad and copper meshes above the recovered board texture.
13. Collapses OBJ object/group records so Blender imports the export as one object.

This gives Blender actual textured geometry to render instead of relying on missing UVs from the original OBJ export.

The output ZIP also includes `better-export-image-primitives.json` with `textureMappings` diagnostics. These diagnostics list each image primitive's source corners, exported corner UVs, whether board-outline clipping was applied, and the UV bounds of the clipped board outline.

For the SoilData circular board test case, the textured OBJ metadata should report six generated top footprint pads and four generated bottom copper circles. The matching bottom soldermask circle rows are intentionally ignored; they are openings for the copper strokes, not extra metal.

## Expected success case

For a PCB source containing:

```json
[
	["OBJ", "e5", 0, 3, "SOILDATA-ai-color-logo-wht.png", -639.7638, 639.7638, 1279.5276, 1279.5276, 0, 0, "blob:3b4870846fa879ae2dcc5573c5fda159991730aa1985c92b719d7133581eef60", 0],
	["OBJ", "e9", 0, 4, "SOILDATA-ai-color-logo-wht.png", 639.7638, 639.7638, 1279.5276, 1279.5276, 0, 0, "blob:3b4870846fa879ae2dcc5573c5fda159991730aa1985c92b719d7133581eef60", 0]
]
```

the exported JSON should contain two image primitive entries with primitive ids `e5` and `e9` and the shared blob reference.
