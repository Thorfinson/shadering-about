// Line icons for the high-fidelity consoles (neon-2d.html, neon-3d.html).
// useHifiIcons() swaps the atlas' pixel icons — the nav's icon.*, the cards'
// row icons ri.* — for these drawings, rendered at four times the pixel
// icon's size so they stay sharp on any screen. Paths are SVG path data on a
// 24 × 24 grid; a leading "!" draws that part in the accent colour.
// Load after assets/os/engine.js; call from the world's decorateChrome().
const HIFI_ICONS = {
  "icon.city": ["M3 21V11h5v10", "M8 21V4h7v17", "M15 21v-9h6v9", "M2 21h20", "!M10.5 7.5h2M10.5 11h2M10.5 14.5h2M17.5 15h1.5"],
  "icon.agents": ["M3 15l2.5-4.5c.4-.6 1-1 1.7-1h7.6c.5 0 1 .2 1.4.5L20 13v2", "M3 15h17", "!M5 19h14", "M9.5 9.5l1.5 3.5h5"],
  "icon.observe": ["M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z", "!M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  "icon.knowledge": ["M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z", "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "!M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"],
  "icon.repos": ["M6 3v12", "M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "!M18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M18 9c0 5-6 4-11 7.5"],
  "icon.documents": ["M6 2.5h8l5 5V21.5H6z", "M14 2.5v5h5", "!M9 13h7M9 17h5"],
  "icon.memory": ["M7 7h10v10H7z", "M9.5 2.5v4.5M14.5 2.5v4.5M9.5 17v4.5M14.5 17v4.5M2.5 9.5H7M2.5 14.5H7M17 9.5h4.5M17 14.5h4.5", "!M10 10h4v4h-4z"],
  "icon.tests": ["M12 2.5l8 3v6c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-6z", "!M8.5 12l2.5 2.5 4.5-5"],
  "icon.models": ["M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z", "M3.5 7.3L12 12l8.5-4.7", "!M12 12v9.5"],
  "icon.deploy": ["M12 2.5c3 2.2 4.8 6 4.8 10L15 17H9l-1.8-4.5c0-4 1.8-7.8 4.8-10z", "M9 17l-2.5 4M15 17l2.5 4", "!M12 8.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"],
  "ri.paper": ["M6 3h8l4 4v14H6z", "!M9 12h6M9 16h6"],
  "ri.report": ["M6 4h12v17H6z", "M9 2.5h6v3H9z", "!M9 11h6M9 15h4"],
  "ri.data": ["M4 5h16v14H4z", "M4 10h16M4 15h16M10 5v14", "!M14 12.5h3"],
  "ri.web": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M3 12h18", "!M12 3c-3 3-3 15 0 18 3-3 3-15 0-18z"],
  "ri.note": ["M5 4h14v12l-5 5H5z", "M14 21v-5h5", "!M8 9h8M8 13h5"],
  "ri.spec": ["M9 5h11M9 12h11M9 19h11", "!M4 5l1.2 1.2L7 4M4 12l1.2 1.2L7 11M4 19l1.2 1.2L7 18"],
  "ri.design": ["M4 20L16 8l2.5-4.5L20.5 6 16 8.5 4 20z", "!M4 20l3-1-2-2z", "M13 11l2 2"],
  "ri.diagram": ["M5 4h5v5H5zM14 15h5v5h-5z", "!M5 15h5v5H5z", "M7.5 9v6M10 17.5h4M16.5 15V9.5H10"],
  "ri.model": ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "!M12 12v9M4 7.5l8 4.5 8-4.5"],
  "ri.repo": ["M6 4v11", "M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "!M18 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M18 10c0 4.5-5.5 4-10.5 7"],
  "ri.check": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "!M8 12.5l2.8 2.8L16.5 9.5"],
  "ri.clock": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "!M12 7v5.5l3.5 2"],
  "ri.grid": ["M4 4h7v7H4zM13 13h7v7h-7z", "!M13 4h7v7h-7zM4 13h7v7H4z"],
  "ri.pearl": ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "!M9 9.5a2.5 2.5 0 0 1 3-2"],
  "ri.env": ["M4 4h16v6H4zM4 14h16v6H4z", "!M7.5 7h.1M7.5 17h.1"],
  "ri.sim": ["M3 12c2.2-5 4.2-5 6 0s3.8 5 6 0 3.8-5 6 0", "!M3 18h18"],
  "ri.eye": ["M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z", "!M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"],
};

// Draws one icon into a w × h canvas.
function drawHifiIcon(g, name, w, h, { ink, accent, weight }) {
  const parts = HIFI_ICONS[name];
  const s = Math.min(w, h) / 24;
  g.save();
  g.translate((w - 24 * s) / 2, (h - 24 * s) / 2);
  g.scale(s, s);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = weight;
  for (const d of parts) {
    const hi = d.startsWith("!");
    g.strokeStyle = hi ? accent : ink;
    g.shadowColor = hi ? accent : "transparent";
    g.shadowBlur = hi ? 1.5 : 0;
    g.stroke(new Path2D(hi ? d.slice(1) : d));
  }
  g.restore();
}

function useHifiIcons({ ink = "#e8f4ff", accent = "#3ef0ff", scale = 4 } = {}) {
  for (const name of Object.keys(HIFI_ICONS)) {
    const f = ATLAS.frames[name];
    if (!f) continue;
    const c = makeCanvas(f.w * scale, f.h * scale);
    // the row icons show at 9 px: thicker strokes keep them legible
    drawHifiIcon(c.getContext("2d"), name, c.width, c.height, { ink, accent, weight: name.startsWith("ri.") ? 2.4 : 1.7 });
    FR.set(name, { c, flip: null });
  }
  ICON_URL.clear();
}
