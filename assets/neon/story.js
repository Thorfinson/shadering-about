// The story every NEON console tells: the runners, the blocks they fly to,
// the three projects with their orders, edits and test runs, what the cards
// show and the city's own words. neon-os.html, neon-2d.html, neon-2d-pixel.html,
// neon-3d.html and neon-3d-pixel.html all run it; each draws its own city.
//
// Load after assets/os/engine.js (the texts format with its helpers), then
//   startOS({ ...NEON_STORY, stations: NEON_STORY.place({ hub: [fx, fy, prefer?], … }), …world })
window.NEON_STORY = (() => {
  "use strict";
  const QUOTES = [
    ["“Read everything. Trust the logs.”", "Halcyon · boot banner"],
    ["“Every lit window is somebody still shipping.”", "Graffiti · Sector 7"],
    ["“Build it before the rain stops.”", "Night-market saying"],
    ["“The firewall remembers every face.”", "Sign on the Firewall Lab"],
    ["“Ship to the grid. Sleep at dawn.”", "Skyport flight board"],
  ];

  // fx/fy: where each block sits on screen in neon-os.html, as a fraction of the
  // map. The other consoles move them with place().
  const STATIONS = {
    hub:       { name: "Agent Orchestrator", sub: "Plan · Coordinate · Execute", frame: "hub.orchestrator", icon: "icon.observe", color: "cyan3", fx: 0.48, fy: 0.6, prefer: ["below", "above"] },
    knowledge: { name: "Knowledge Base", frame: "station.knowledge", icon: "icon.knowledge", color: "research", fx: 0.17, fy: 0.36, prefer: ["below", "right", "left"] },
    documents: { name: "Documents", frame: "station.documents", icon: "icon.documents", color: "analyze", fx: 0.6, fy: 0.3, prefer: ["right", "left", "below"] },
    models:    { name: "Model Registry", frame: "station.models", icon: "icon.models", color: "model", fx: 0.87, fy: 0.34, prefer: ["below", "left"] },
    repos:     { name: "Repositories", frame: "station.repos", icon: "icon.repos", color: "build", fx: 0.15, fy: 0.7, prefer: ["below", "right", "above"] },
    tests:     { name: "Testing Lab", frame: "station.tests", icon: "icon.tests", color: "test", fx: 0.75, fy: 0.64, prefer: ["below", "left", "right"] },
    memory:    { name: "Memory", frame: "station.memory", icon: "icon.memory", color: "remember", fx: 0.37, fy: 0.88, prefer: ["right", "left", "above"] },
    deploy:    { name: "Deployments", frame: "station.deploy", icon: "icon.deploy", color: "deploy", fx: 0.89, fy: 0.87, prefer: ["left", "above"] },
  };

  const ROW_ICON = {
    knowledge: { papers: "ri.paper", reports: "ri.report", datasets: "ri.data", web: "ri.web" },
    documents: { project: "ri.paper", specs: "ri.spec", notes: "ri.note", designs: "ri.design", diagrams: "ri.diagram" },
    tests: { unit: "ri.check", integration: "ri.check", eval: "ri.model", sim: "ri.sim", data: "ri.data" },
    memory: { short: "ri.clock", long: "ri.pearl", episodic: "ri.note", vector: "ri.grid" },
  };

  const AGENTS = [
    { id: "kade", name: "Kade", role: "Researcher", home: "knowledge", color: "research", verb: "Researching", blurb: "pulls papers, field logs and datasets off the net" },
    { id: "nyx", name: "Nyx", role: "Analyst", home: "documents", color: "analyze", verb: "Analyzing", blurb: "cuts the findings into specs and plans" },
    { id: "juno", name: "Juno", role: "Engineer", home: "repos", color: "build", verb: "Coding", blurb: "writes the code; burns down failing tests" },
    { id: "rook", name: "Rook", role: "Model engineer", home: "models", color: "model", verb: "Training", blurb: "trains, evaluates and ships models" },
    { id: "vex", name: "Vex", role: "Tester", home: "tests", color: "test", verb: "Testing", blurb: "runs the suites, sims and evals against the firewall" },
    { id: "sable", name: "Sable", role: "Launcher", home: "deploy", color: "deploy", verb: "Deploying", blurb: "flies every release out to the grid" },
    { id: "echo", name: "Echo", role: "Chronicler", home: "memory", color: "remember", verb: "Remembering", blurb: "keeps the city's memory — long-term" },
  ];

  const EDITS = {
    translate: {
      file: "api/translate.js", hunk: "@@ -0,0 +1,8 @@", create: true,
      lines: [
        '+import { translate } from "../models/lingo-net.js";',
        "+",
        "+export async function getTranslation(req) {",
        "+  const clip = await req.audio();",
        '+  const { text, confidence } = await translate(clip, { v: "1.0" });',
        '+  if (confidence < 0.6) return { text: null, confidence };',
        "+  return { text, confidence };",
        "+}",
      ],
    },
    routes: {
      file: "api/routes.js", hunk: "@@ -12,4 +12,5 @@",
      lines: [
        ' router.get("/districts", listDistricts);',
        ' router.get("/districts/:id", getDistrict);',
        '+router.get("/translate/:id", getTranslation);',
        ' router.get("/health", health);',
      ],
    },
    speed: {
      file: "rail/speed.js", hunk: "@@ -10,4 +10,4 @@ line 9",
      lines: [
        " // top speed on the airport line",
        "-export const MAX_KMH = 400;",
        "+export const MAX_KMH = 600;      // the city's ask",
        " export const ACCEL = 1.2;         // m/s²",
      ],
    },
    brakes: {
      file: "rail/brakes.js", hunk: "@@ -38,5 +38,8 @@ function brake",
      lines: [
        " function brake(train, force) {",
        "   const v = speed(train);",
        "+  if (v > 500) {                  // km/h",
        "+    return staged(train, force, v);",
        "+  }",
        "   return drive(train, force, v);",
        " }",
      ],
    },
    pylons: {
      file: "rail/pylons.js", hunk: "@@ -4,3 +4,4 @@",
      lines: [
        "-export const BRACE_MM = 40;      // rated 400 km/h",
        "+export const BRACE_MM = 65;      // rated 650 km/h",
        "+export const CROSS_BRACED = true;",
        " export const SPAN_M = 30;",
      ],
    },
    icealert: {
      file: "alerts/ice.js", hunk: "@@ -0,0 +1,8 @@", create: true,
      lines: [
        '+import { model } from "../models/sentinel.js";',
        "+",
        "+export function onPacket(burst) {",
        "+  const p = model.score(burst);                // 0..1",
        "+  if (p > 0.8 && burst.hops < 3) {",
        '+    alarm("ice", { port: burst.port, warnS: burst.hops / burst.hopsPerS });',
        "+  }",
        "+}",
      ],
    },
  };

  // A project runs research (parallel) → analyze → build (parallel) → test → deploy.
  const PROJECTS = [
    {
      id: "lingo", name: "Night Market Translator", meter: 400,
      order: "The market speaks forty dialects and the sign-bots understand six. Fix it, Kade. Start with the street slang.",
      ticket: "Ship Lingo-Net v1.0 behind the Street API",
      research: [
        { agent: "kade", station: "knowledge", task: "Survey the dialect corpora", doing: "Reading papers",
          steps: [["read", "papers", "Harbour Creole · a grammar", 6200], ["read", "reports", "Street recordings · 90 nights", 2900], ["read", "datasets", "Sign photos · 52k", 1800]],
          report: "Slang is in 31% of the recordings, and the training set has no label for it.", rtok: 180 },
        { agent: "nyx", station: "documents", task: "Read the Street API spec", doing: "Reading specs",
          steps: [["docread", "specs", "Street API v2", 2100], ["docread", "notes", "Meeting notes · 12 March", 900]],
          report: "The API serves /translate/{id}; the model must return a confidence.", rtok: 120 },
        { agent: "echo", station: "memory", task: "Recall the last rollout", doing: "Recalling",
          steps: [["recall", "Last rollout: slang was tagged as noise", 420]],
          report: "Memory: slang was tagged as noise last time.", rtok: 60 },
      ],
      analyze: { agent: "nyx", station: "documents", task: "Write the research brief and the plan", doing: "Writing the brief",
        steps: [["docwrite", "project", "Research brief · Lingo-Net v1.0"], ["plan"]], report: "Brief filed; five-step plan.", rtok: 140 },
      plan: [
        ["Add a slang label to the training set", "rook", 2],
        ["Train Lingo-Net v1.0", "rook", 2],
        ["Serve /translate on the Street API", "juno", 2],
        ["Validate on held-out market nights", "vex", 3],
        ["Deploy to staging, production and the sign-bots", "sable", 4],
      ],
      build: [
        { agent: "juno", station: "repos", task: "Serve /translate on the Street API", doing: "Coding",
          steps: [["grep", "street-api", "router.get", ["api/routes.js"]], ["edit", "street-api", "feature/translate", "translate"], ["edit", "street-api", "feature/translate", "routes"]],
          report: "GET /translate/{id} returns text and a confidence.", rtok: 110 },
        { agent: "rook", station: "models", task: "Train Lingo-Net v1.0", doing: "Training",
          steps: [["train", "Lingo-Net", "1.0", "52k signs, 90 nights, slang label added"]], report: "v1.0 trained: 0.93 accuracy overall.", rtok: 120 },
      ],
      test: {
        agent: "vex", task: "Run the suites and the model eval", doing: "Testing",
        first: [["suite", "unit", 346, null], ["suite", "integration", 128, null], ["suite", "eval", 12, "street slang: precision 0.69 < 0.85"]],
        fix: { agent: "rook", station: "models", task: "Retrain with more slang", doing: "Retraining",
               steps: [["train", "Lingo-Net", "1.0", "+2,400 slang labels"]], report: "Slang precision 0.69 → 0.91.", rtok: 100 },
        rerun: [["suite", "eval", 12, null], ["suite", "data", 89, null]],
        report: "All green: unit 346, integration 128, eval 12/12, data 89/89.", rtok: 70,
      },
      deploy: [
        { agent: "sable", station: "deploy", task: "Release Lingo 1.0", doing: "Deploying",
          steps: [["deploy", "staging", "lingo 1.0"], ["deploy", "production", "lingo 1.0"], ["deploy", "edge", "model 1.0"], ["deploy", "api", "lingo 1.0"]],
          report: "Lingo 1.0 is live on staging, production, the sign-bots and the Street API.", rtok: 90 },
        { agent: "juno", station: "repos", task: "Merge the feature branch", doing: "Merging",
          steps: [["merge", "street-api", "1a9b0c", "translate: serve lingo-net v1.0"]], report: "Merged into main.", rtok: 40 },
        { agent: "echo", station: "memory", task: "Record the lesson", doing: "Remembering",
          steps: [["remember", "Slang needs its own label — never “noise”"]], report: "Lesson stored.", rtok: 30 },
      ],
    },
    {
      id: "maglev", name: "Maglev 600", meter: 400, finalMeter: 600,
      order: "The city wants the airport line at six hundred. Make the maglev do it without shaking the towers down.",
      ticket: "Raise the maglev limit to 600 km/h",
      research: [
        { agent: "kade", station: "knowledge", task: "Survey the maglev literature", doing: "Reading the manual",
          steps: [["read", "papers", "Line 9 Manual §4 · Pylons", 3400], ["read", "papers", "On high-speed levitation", 5200]],
          report: "The pylons are rated for 400 km/h; expect 1.6× the load at 600.", rtok: 160 },
        { agent: "juno", station: "repos", task: "Find every speed limit in the code", doing: "Searching code",
          steps: [["grep", "maglev", "MAX_KMH", ["rail/speed.js", "rail/brakes.js"]]],
          report: "MAX_KMH is set in rail/speed.js and read by rail/brakes.js.", rtok: 120 },
        { agent: "echo", station: "memory", task: "Recall past upgrades", doing: "Recalling",
          steps: [["recall", "Pylon tests are slow — run them last", 380]], report: "Memory: the pylon suite is slow; run it last.", rtok: 50 },
      ],
      analyze: { agent: "nyx", station: "documents", task: "Write the speed envelope and the plan", doing: "Writing the spec",
        steps: [["docwrite", "specs", "Spec · Speed envelope to 600 km/h"], ["plan"]], report: "Spec filed; five-step plan.", rtok: 130 },
      plan: [
        ["Raise MAX_KMH to 600", "juno", 2],
        ["Stage the brakes above 500 km/h", "juno", 2],
        ["Simulate the airport run", "vex", 3],
        ["Run the pylon suite last", "vex", 3],
        ["Ship rail 2.4 to Line 9", "sable", 4],
      ],
      build: [
        { agent: "juno", station: "repos", task: "Raise the limit and stage the brakes", doing: "Coding",
          steps: [["edit", "maglev", "feature/line-600", "speed"], ["edit", "maglev", "feature/line-600", "brakes"]],
          report: "MAX_KMH 600; brakes staged above 500 km/h.", rtok: 110 },
      ],
      test: {
        agent: "vex", task: "Simulate the run, then the pylon suite", doing: "Testing",
        first: [["suite", "sim", 3, null], ["suite", "unit", 342, "pylon.test.js › pylons hold at 600 km/h — rated 400"]],
        fix: { agent: "juno", station: "repos", task: "Burn down the failing pylon test", doing: "Fixing rail/pylons.js",
               steps: [["edit", "maglev", "feature/line-600", "pylons"]], report: "Pylons cross-braced: rated 650 km/h.", rtok: 100 },
        rerun: [["suite", "unit", 342, null]],
        report: "Simulations 3/3; pylon suite 342/342.", rtok: 60,
      },
      deploy: [
        { agent: "sable", station: "deploy", task: "Ship rail 2.4", doing: "Deploying",
          steps: [["deploy", "staging", "rail 2.4 · test track"], ["deploy", "production", "rail 2.4 · Line 9"]],
          report: "rail 2.4 is running on Line 9.", rtok: 70 },
        { agent: "juno", station: "repos", task: "Merge the feature branch", doing: "Merging",
          steps: [["merge", "maglev", "600a1f", "rail: line 9 to 600 km/h"]], report: "Merged into main.", rtok: 40 },
        { agent: "echo", station: "memory", task: "Record the lesson", doing: "Remembering",
          steps: [["remember", "Speed changes need a pylon review"]], report: "Lesson stored.", rtok: 30 },
      ],
    },
    {
      id: "ice", name: "ICE early warning", meter: 600,
      order: "Something black is probing the firewall at night. I want warning before it gets in.",
      ticket: "Detect ICE on the wire before contact",
      research: [
        { agent: "kade", station: "knowledge", task: "Study black ICE", doing: "Reading papers",
          steps: [["read", "papers", "Intrusion countermeasures · a field guide", 4400], ["read", "datasets", "Packet captures · 214 probes", 3100]],
          report: "ICE shows as slow, broad bursts on port 7; 9 of 214 probes match.", rtok: 170 },
        { agent: "nyx", station: "documents", task: "Read the lockdown drill", doing: "Reading the runbook",
          steps: [["docread", "notes", "Runbook · lockdown drill", 1200]], report: "The firewall needs 90 s of warning to seal.", rtok: 90 },
        { agent: "echo", station: "memory", task: "Recall past false alarms", doing: "Recalling",
          steps: [["recall", "Ad-bot traffic set off the last alarm", 400]], report: "Memory: ad-bots triggered the last false alarm.", rtok: 50 },
      ],
      analyze: { agent: "nyx", station: "documents", task: "Design the alert pipeline", doing: "Drawing the design",
        steps: [["docwrite", "designs", "Design · Wire alert pipeline"], ["docwrite", "diagrams", "Diagram · Packet to alarm"], ["plan"]], report: "Design and diagram filed; five-step plan.", rtok: 150 },
      plan: [
        ["Train Sentinel v0.3 with ad-bots as negatives", "rook", 2],
        ["Wire the alarm into wire-alerts", "juno", 2],
        ["Evaluate false alarms", "vex", 3],
        ["Simulate five intrusions", "vex", 3],
        ["Ship to the drones and the arcology", "sable", 4],
      ],
      build: [
        { agent: "rook", station: "models", task: "Train Sentinel v0.3", doing: "Training",
          steps: [["train", "Sentinel", "0.3", "214 probes, ad-bots as negatives"]], report: "v0.3: recall 0.97, false alarms 2%.", rtok: 110 },
        { agent: "juno", station: "repos", task: "Wire the alarm", doing: "Coding",
          steps: [["edit", "wire-alerts", "feature/ice-alarm", "icealert"]], report: "onPacket() raises an ICE alarm inside 3 hops.", rtok: 90 },
      ],
      test: {
        agent: "vex", task: "Evaluate, simulate, integrate", doing: "Testing",
        first: [["suite", "eval", 12, null], ["suite", "sim", 5, null], ["suite", "integration", 128, null]],
        report: "Eval 12/12, five simulated intrusions caught, integration 128/128.", rtok: 60,
      },
      deploy: [
        { agent: "sable", station: "deploy", task: "Ship sentinel 0.3", doing: "Deploying",
          steps: [["deploy", "edge", "sentinel 0.3"], ["deploy", "production", "sentinel 0.3"]], report: "sentinel 0.3 is live on the drones and in the arcology.", rtok: 70 },
        { agent: "juno", station: "repos", task: "Merge the feature branch", doing: "Merging",
          steps: [["merge", "wire-alerts", "1ce0a1", "alerts: ICE early warning"]], report: "Merged into main.", rtok: 40 },
        { agent: "echo", station: "memory", task: "Record the lesson", doing: "Remembering",
          steps: [["remember", "Train sentinels with ad-bot traffic as negatives"]], report: "Lesson stored.", rtok: 30 },
      ],
      finale: [
        ["sys", "Sentinel · ICE 2.4 hops out on port 7 — 96 s of warning", "alarm"],
        ["persona", "ports sealed · the ICE slides past the firewall"],
      ],
    },
  ];

  // What the cards and popovers show
  function freshState() {
    return {
      knowledge: { rows: { papers: ["Papers", 12430], reports: ["Field logs", 2981], datasets: ["Datasets", 1204], web: ["Net sources", 890] }, read: [] },
      documents: { rows: { project: ["Project docs", 342], specs: ["Specifications", 28], notes: ["Meeting notes", 76], designs: ["Designs", 19], diagrams: ["Diagrams", 41] }, written: [], read: [] },
      models: {
        list: [
          { name: "City-LLM", v: "2.1", status: "live" },
          { name: "StreetVision", v: "1.4", status: "live" },
          { name: "Lingo-Net", v: "0.9", status: "live" },
          { name: "Sentinel", v: "0.2", status: "draft" },
          { name: "Embedding-XL", v: "3.0", status: "live" },
        ],
        log: [],
      },
      repos: {
        list: [
          { name: "street-api", branch: "main", add: 0, del: 0 },
          { name: "maglev", branch: "main", add: 0, del: 0 },
          { name: "wire-alerts", branch: "main", add: 0, del: 0 },
          { name: "data-pipeline", branch: "dev", add: 0, del: 0 },
          { name: "infrastructure", branch: "main", add: 0, del: 0 },
        ],
        commits: [["a3f9c1", "maglev", "brakes: pad wear 12 → 10 mm"], ["7be2d0", "street-api", "districts: add the night market"], ["e41a77", "wire-alerts", "wire: drop ad-bot noise"]],
      },
      tests: {
        suites: {
          unit: { name: "Unit tests", done: 342, total: 342, state: "pass" },
          integration: { name: "Integration", done: 128, total: 128, state: "pass" },
          eval: { name: "Model eval", done: 6, total: 12, state: "idle" },
          sim: { name: "Simulations", done: 0, total: 0, state: "queued" },
          data: { name: "Data validation", done: 89, total: 89, state: "pass" },
        },
      },
      memory: {
        rows: { short: ["Short-term", 42, "notes"], long: ["Long-term", 1208, "lessons"], episodic: ["Episodic", 316, "runs"], vector: ["Vector store", 88410, "vectors"] },
        lessons: ["Pylon tests are slow — run them last", "Stage risky rail changes behind a flag", "Ad-bot traffic set off the last alarm", "Last rollout: slang was tagged as noise"],
      },
      deploy: {
        envs: {
          staging: { name: "Staging", v: "lingo 0.9", status: "healthy" },
          production: { name: "Production", v: "lingo 0.9", status: "healthy" },
          edge: { name: "Edge (drones)", v: "7 drones", status: "syncing" },
          api: { name: "Street API", v: "lingo 0.9", status: "healthy" },
        },
        log: [],
      },
      hub: { plan: [], ctx: 0, reports: 0 },
      visited: new Set(),
      hot: {},
    };
  }

  // A fresh set of stations, moved to where this console draws them:
  // { key: [fx, fy, prefer?] }. Keys left out keep their neon-os.html spot.
  function place(layout = {}) {
    return Object.fromEntries(Object.entries(STATIONS).map(([k, s]) => {
      const [fx, fy, prefer] = layout[k] ?? [s.fx, s.fy];
      return [k, { ...s, fx, fy, prefer: prefer ?? s.prefer }];
    }));
  }

  return {
    stations: place(),
    place,
    agents: AGENTS,
    who: { halcyon: ["Halcyon", "var(--cyan)"], sys: ["System", "var(--faint)"], ice: ["ICE", "var(--bad)"] },
    persona: "halcyon",
    villain: { id: "ice" },
    rowIcons: ROW_ICON,
    quotes: QUOTES,
    projects: PROJECTS,
    edits: EDITS,
    freshState,
    nav: [
      ["city", "icon.city", "City View"], ["agents", "icon.agents", "Runners"], ["hub", "icon.observe", "Orchestrator"],
      ["knowledge", "icon.knowledge", "Knowledge"], ["repos", "icon.repos", "Repositories"], ["documents", "icon.documents", "Documents"],
      ["memory", "icon.memory", "Memory"], ["tests", "icon.tests", "Tests"], ["models", "icon.models", "Models"], ["deploy", "icon.deploy", "Deployments"],
    ],
    clockStart: 23 * 60 + 40,
    text: {
      run: "run", runs: "runs", crew: "runners", Crew: "Runners",
      idle: "Parked", docked: "parked at the arcology", orders: "orders", pipeNote: "From the order to the grid",
      meter: (v) => `${fmtNum(v)} km/h`,
      villainRises: (fail) => `breaches the Testing Lab · ✗ ${esc(fail)}`,
      villainSinks: "is burned off the wire and dissolves",
      settled: (v) => `Line 9 runs at <b>${fmtNum(v)} km/h</b>; the towers don't shake`,
      done: "run complete · <q>Ship to the grid. Sleep at dawn.</q>",
      about: {
        hub: "Halcyon, the arcology's AI, holds the order, sends the runners out to the blocks, and keeps only the short reports that come back.",
        knowledge: "Papers, field logs, datasets and net sources, racked in the data archive. Runners read here; nothing is changed.",
        documents: "Specs, notes, designs and the plans the city writes, floating over the holo kiosk.",
        models: "Every model the city runs, with the version in service, in the AI lab.",
        repos: "The codebase, stacked in the containers. Branches open while a runner works and close when the change merges.",
        tests: "Suites, simulations and model evals behind the firewall. A failing test lets the ICE in.",
        memory: "What the city keeps between runs, in the pagoda. Recalled before work; a lesson is stored after it.",
        deploy: "Where releases lift off from the skyport.",
      },
    },
    meterStep: 10,
  };
})();
