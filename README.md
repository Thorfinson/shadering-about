# Shadering

A collection of self-contained generative-art and shader studies. Every study is a
single standalone HTML file — no build step, no framework, no dependencies. Open it
in a browser and it runs.

![Reef — procedural underwater isometric islands](screenshots/reef-islands.png)

## Studies

### Reef — procedural underwater islands ([reef-islands.html](reef-islands.html))

A seed-deterministic Canvas 2D generator for stylized underwater isometric islands:
stepped terraces, coral and kelp props, drifting fish and jellyfish, god rays, and
distance haze. Island archetypes (volcanic, ruins, round reef, …), island count,
prop density, and seed are all configurable from the in-page UI.

| Volcanic | Round reef |
|---|---|
| ![Volcanic archetype](screenshots/reef-islands-volcanic.png) | ![Round reef archetype](screenshots/reef-islands-roundreef.png) |

### Nautilus — agents under the sea ([nautilus-agents.html](nautilus-agents.html))

A pixel-art explainer of agent orchestration in the style of *Twenty Thousand Leagues
Under the Sea*. The Nautilus is the orchestrator; brass-helmeted divers are
sub-agents that leave the airlock with a fresh context and one narrow job. They read
the **sunken library** (knowledge base), recall from the **giant pearl** (memory),
search and carve the stone tablets of **Atlantis** (the repository, one tablet per
file) and read the coin stacks of the **Vigo Bay wreck** (git history). Four voyages
walk through survey → plan → build → verify → merge; a failing test rises as the
**kraken** and has to be harpooned, fixed and re-run. The captain's log, live diffs,
test output, Conseil's plan and a context ledger (tokens read by the crew vs. held by
the orchestrator) update alongside the scene. Hover anything on the canvas for what it
stands for; `?voyage=3` starts at a later voyage and `?at=60` fast-forwards.

Its sprites come from the [sprite pipeline](#sprite-pipeline) below.

![Nautilus](screenshots/nautilus-agents.png)

### Aqua — 16-bit underwater study ([aqua-16bit.html](aqua-16bit.html))

A WebGL fragment-shader scene in a retro 16-bit palette: radial sun shafts from a
single source, ordered dithering, drifting particles, and a warm seafloor glow.

![Aqua](screenshots/aqua-16bit.png)

### Nine — nine ways to draw a cosmic web ([nine-cosmic-webs.html](nine-cosmic-webs.html))

One reference plate — an orange-violet cellular tessellation cut by a
horizon-grazing beam — recreated nine times as procedural fragment shaders.
Same palette, same composition, nine different mathematical paths to get there.

![Nine](screenshots/nine-cosmic-webs.png)

### Cosmic Filament — clustered knowledge graph ([cosmic-filament.html](cosmic-filament.html))

A knowledge graph rendered as a cosmic web: clusters tinted per region, nodes as
stars, edges as filaments. The renderer lives in
[cosmic-filament.js](cosmic-filament.js) as a reusable ES module, so this is the
one study that needs a local HTTP server (see below).

![Cosmic Filament](screenshots/cosmic-filament.png)

### Colors — caustic study, HDR pipeline ([caustic-hdr.html](caustic-hdr.html))

Luminance pattern first; color is a transformation; HDR runs hot until the final
tone map. Gradient endpoints, heightmap shaping, and cell/warp parameters are all
tweakable live.

![Colors](screenshots/caustic-hdr.png)

### POC — constellation as heightmap, caustic below ([constellation-caustic.html](constellation-caustic.html))

A multi-pass experiment: a constellation drives a heightmap, which drives a caustic
layer underneath; the composite blend is adjustable per layer.

![POC](screenshots/constellation-caustic.png)

### Playground ([index.html](index.html))

A landing page with three live cosmic-web studies — triangulated Voronoi cells,
filled Voronoi with a beam, and a hand-placed constellation.

![Playground](screenshots/index.png)

## Running

Open any `.html` file directly in a browser — everything is self-contained.

`nautilus-agents.html` loads its sprite atlas from `assets/nautilus/atlas.js` — a
plain script tag, so it still works from `file://`. The one exception is
`cosmic-filament.html`, which imports an ES module and therefore needs to be served
over HTTP:

```sh
python -m http.server 8765
# or: npx serve .
```

then open <http://localhost:8765/cosmic-filament.html>.

## Sprite pipeline

The Nautilus sprites are built from source by a dependency-free Node script:

```sh
npm run sprites          # build the atlas
npm run sprites:watch    # rebuild on every change to assets/nautilus/src
npm run sprites:check    # exit 1 if the committed atlas is stale (also run in CI)
```

| Source (`assets/nautilus/src/`) | What it holds |
|---|---|
| `palette.txt` | Every colour, one per line — a key character for sprites and a name for code |
| `sprites/*.sprite` | Hand-drawn pixel art as text: rows of palette keys, plus directives for outline, recolour variants and anchor points |
| `procedural.mjs` | Generators for the big set pieces (the Nautilus, Atlantis, library, wreck, clam, kraken, corals) |

[tools/build-sprites.mjs](tools/build-sprites.mjs) parses and validates the sources,
renders every frame with [tools/pixelkit.mjs](tools/pixelkit.mjs), shelf-packs them
into one sheet and writes:

| Output (`assets/nautilus/`) | Used by |
|---|---|
| `atlas.png` | The packed sprite sheet |
| `atlas.json` | Frame rectangles, palette, anchor points, content hash |
| `atlas.js` | The page — the same data with the PNG inlined as a data URI |
| `atlas-preview.png` | Review — the sheet at 4× on a checkerboard |

A `.sprite` file is plain text, so a sprite diff is readable in review:

```
@sprite crab
@outline ink

@frame walk0
q.......q
qq.0.0.qq
.qqrrrqq.
.qqqqqqq.
q.q...q.q
```

Directives: `@sprite name`, `@outline colour`, `@thin chars` (drawn after the outline,
for hair-thin details), `@map K=colour`, `@variant name K=colour …` (one recoloured
copy of every frame — how the five divers get their suits), `@point name x,y` (an
anchor exported to `atlas.json`), and `@frame name` followed by the pixel rows. Colours
are palette names or `#rrggbb`; `.` is transparent.

![Sprite atlas](assets/nautilus/atlas-preview.png)

## Regenerating screenshots

Screenshots are captured headless with Playwright (WebGL via SwiftShader, so no GPU
is required):

```sh
npm install
npm run shots           # capture everything into screenshots/
npm run shots -- reef   # capture only studies matching "reef"
```

## License

[MIT](LICENSE)
