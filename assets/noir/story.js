// The NOIR consoles tell the NEON story (assets/neon/story.js): the same
// runners, blocks, projects and cards. Only the city's own words change, for a
// city of rain, sodium light and pyramids. noir-3d.html and noir-3d-pixel.html.
//
// Load after assets/neon/story.js, then
//   startOS({ ...NOIR_STORY, ...world })
window.NOIR_STORY = (() => {
  "use strict";
  const N = window.NEON_STORY;
  return {
    ...N,
    quotes: [
      ["“Trust the logs. Memories can be made.”", "Halcyon · boot banner"],
      ["“Every lit window up there is somebody’s night shift.”", "Graffiti · Level 4"],
      ["“It rains on the pyramid too. It just never reaches the top.”", "Noodle-bar saying"],
      ["“They say the sky is clean on the colonies.”", "Off-world port, gate 9"],
      ["“The flares burn all night so the city can sleep.”", "Foundry shift board"],
    ],
    text: {
      ...N.text,
      docked: "parked on the pyramid’s pad",
      done: "run complete · <q>Trust the logs. Memories can be made.</q>",
      about: {
        hub: "Halcyon, the pyramid’s AI, holds the order, sends the runners out to the blocks, and keeps only the short reports that come back.",
        knowledge: "Papers, field logs, datasets and net sources, racked in the concrete archive. Runners read here; nothing is changed.",
        documents: "Specs, notes, designs and the plans the city writes, pinned up over the night market.",
        models: "Every model the city runs, with the version in service, under the eye of the Eye Works.",
        repos: "The codebase, stacked in the foundry yard. Branches open while a runner works and close when the change merges.",
        tests: "Suites, simulations and model evals in the precinct. A failing test lets the ICE in.",
        memory: "What the city keeps between runs, under the memory dome. Recalled before work; a lesson is stored after it.",
        deploy: "Where releases lift off from the off-world port.",
      },
    },
  };
})();
