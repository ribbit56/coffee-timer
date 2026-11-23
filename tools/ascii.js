// Prints 3 frames of the mug as plain text: full, half and empty, at different angles.
// Loads only the <script id="engine"> block from index.html, which has no DOM access.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) { console.error("engine script block not found in index.html"); process.exit(1); }

const mod = { exports: {} };
vm.runInNewContext(m[1], { module: mod, Math, Float32Array, Uint8Array, String });
const { buildGeo, makeFrame, renderMug, frameToText, FULL, EMPTY } = mod.exports;

const geo = buildGeo();
const fr = makeFrame();
const shots = [
  ["full", FULL, 0.6],
  ["half", (FULL + EMPTY) / 2, 2.2],
  ["empty", EMPTY, 4.1],
];
for (const [name, lvl, angle] of shots) {
  renderMug(geo, fr, angle, lvl, 0);
  console.log(`--- ${name} (level ${lvl.toFixed(2)}, angle ${angle}) ---`);
  console.log(frameToText(fr).replace(/ +$/gm, ""));
}
