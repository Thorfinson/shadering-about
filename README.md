# Shadering

A collection of self-contained generative-art and shader studies. Every study is a
single standalone HTML file — no build step, no framework, no dependencies. Open it
in a browser and it runs.

![Reef — procedural underwater isometric islands](screenshots/reef-islands.png)

## Series: Von der Geraden zur Attention ([regression-to-attention/](regression-to-attention/index.html))

An interactive series (in German) that goes from linear regression to the Transformer
and Olah's circuits work. Each chapter adds exactly one idea to the previous chapter's
formula, and each idea is something to drag, drop and watch rather than read.

Each chapter is a scroll-driven story: one sticky stage, and every step plays its own
animation as it scrolls into view while the formula on top highlights the term that
is currently doing the work. The engine lives in `series.js` (`S.story`).

- **Chapter 1, *Die Gerade*** (scalar only): data, a line with two knobs, reading the
  formula, errors as squares, the loss landscape, the line on springs, outliers, a ball
  rolling down the 3D loss bowl (raw vs. standardized, too-large steps), the same
  formula on ice-cream sales and Hubble's law, the neuron.
- **Chapter 2, *Die Matrix***: vectors, then matrices as transformations from simple to
  general (stretch, reflect, rotate, shear, flatten, compose, SVD, 2D→3D, 3D→2D), and
  only then the regression as a matrix product and as an orthogonal projection.
- **Chapter 3, *Die Grenze***: pass/fail instead of a number, probability as a share, e to the z
  and the sigmoid built from it step by step, the logarithm and cross-entropy as surprise,
  the boundary perpendicular to w, the 3D ramp, softmax on three penguin species,
  temperature on next-word probabilities, and XOR where one boundary fails.
- **Chapter 4, *Den Raum falten***: ReLU as a kink, one neuron as a ramp over the plane,
  three ramps as coordinates of a hidden space (a creased sheet in 3D where a plane
  separates), a network trained live in the browser, the chain rule as gears in a chain,
  backpropagation, curves from kinks, folds on folds, the two spirals.
- **Chapter 5, *Viele Dimensionen***: a vector as a row of d numbers, length and direction,
  the dot product as a shadow, many small products cancelling, angle histograms built pair
  by pair, volume shrinking as 0.9^d, the table of all pairs, features as directions built
  by hand (120°, pentagon with a threshold), sparsity, superposition trained live (Toy
  Models, 2022), and the best shadow (principal components) in 2D and in 50D.
- **Chapter 6, *Bedeutung als Richtung***: why numbering words fails, one-hot vectors in 3D
  and in 65 dimensions, a hand-placed word map and its table, the lookup as a matrix product,
  counting neighbour pairs, count profiles (and why "der" hides their similarity), embeddings
  as compressed profiles, the guessing game, a four-word world in 2D showing scores, single
  gradient nudges and how shared neighbours pull words together, word vectors trained live
  on a small generated German corpus, cosine neighbours, the direction Frau − Mann, analogies,
  and "Bank" as one row for two meanings.
- **Chapter 7, *Mischen nach Relevanz*** (attention without new matrices): one vector for
  two meanings of "Bank", how we read ourselves, weighted means with numbers, points and
  vectors, mixing by hand, relevance as a dot product, softmax built from e^x, dividing and
  sharpness, the self-similarity trap, "Bank" moving towards money, seats or wood (with the
  chapter-6 vectors), the full table, and where it fails ("sie").
- **Chapter 8, *Fragen, Schilder, Werte***: one word in three roles, a matrix rotating a
  vector, the query of "sie", scores and weights, keys and values as their own matrices,
  everything as tables (X → Q, QKᵀ, row softmax, times V), the full formula, √d, multiple
  heads, and all of it learned.
- **Chapter 9, *Der Transformer***: the parts, adding instead of replacing (the residual
  stream as a notepad), the per-token MLP worked through with numbers, a block, why
  attention ignores word order and how position vectors fix it, next-word prediction, the
  causal mask, the output, the loss, the whole blueprint and real-world sizes.
- **Chapter 10, *Ein eigener Transformer***: a two-layer attention-only transformer
  (1856 parameters) trained live in the browser on repeating letter sequences: the task,
  learning backwards, one training step, the sudden drop in loss, predictions before and
  after, continuing patterns, and its limits.
- **Chapter 11, *Merkmale und Schaltkreise*** (Olah I): images as numbers, a filter slid
  over an image, several filters, ReLU, pooling, a hand-built second layer, then a small
  CNN trained live on four shapes: edge detectors, dataset examples, feature visualisation,
  curve units, a circuit read from the weights, the three claims of *Zoom In*, universality
  across two runs, and a polysemantic unit.
- **Chapter 12, *Schaltkreise im Transformer*** (Olah II): the same tools on the chapter-10
  model: a previous-token head and an induction head, the two-step algorithm, logit
  attribution per head, a letter walked through the OV circuit, the OV and QK circuits from
  the weights, K-composition, head ablations, the phase change, and an outlook on
  superposition, sparse autoencoders and attribution graphs.

Each chapter also carries learning aids grounded in instructional research: a short route
map at the top, prediction prompts that pause the animation at key moments ("Was glaubst
du?"), try-it controls after many steps (sliders, head switches, typing a sequence, drawing a
shape for the image net), and at the end three take-aways plus three self-test questions,
one of them about an earlier chapter. Readers can switch to a fast run of the core steps or
turn prompts and controls off; both choices are remembered per browser.

Unlike the studies below, the chapters share `series.css` and `series.js`; chapters 6 to 9
share `wordmodel.js` (the word vectors), chapters 10 and 12 share `transformer.js` (the
mini transformer with hand-written backpropagation), and chapter 11 uses `cnn.js` (the small
convolutional network). All are loaded as plain (non-module) files, so the pages still open
straight from `file://`.

## Studies

### Reef — procedural underwater islands ([reef-islands.html](reef-islands.html))

A seed-deterministic Canvas 2D generator for stylized underwater isometric islands:
stepped terraces, coral and kelp props, drifting fish and jellyfish, god rays, and
distance haze. Island archetypes (volcanic, ruins, round reef, …), island count,
prop density, and seed are all configurable from the in-page UI.

| Volcanic | Round reef |
|---|---|
| ![Volcanic archetype](screenshots/reef-islands-volcanic.png) | ![Round reef archetype](screenshots/reef-islands-roundreef.png) |

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

The one exception is `cosmic-filament.html`, which imports an ES module and
therefore needs to be served over HTTP:

```sh
python -m http.server 8765
# or: npx serve .
```

then open <http://localhost:8765/cosmic-filament.html>.

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
