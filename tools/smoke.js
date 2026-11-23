// Loads index.html in jsdom with a fake window.claude db, then adds, focuses and checks off
// tasks and prints what ended up on the page and in the fake database.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures++; };

// --- fake artifact db: one in-memory store, onSnapshot + set ---
function fakeClaude(store) {
  const listeners = {};
  const emit = p => (listeners[p] || []).forEach(fn => fn({
    exists: store.has(p), data: () => JSON.parse(store.get(p)),
    metadata: { fromCache: false, hasPendingWrites: false },
  }));
  const db = {
    doc: p => ({
      async set(d) { store.set(p, JSON.stringify(d)); setTimeout(() => emit(p), 5); },
      onSnapshot(fn) { (listeners[p] = listeners[p] || []).push(fn); setTimeout(() => emit(p), 5); return () => {}; },
    }),
  };
  const user = { id: async () => "u_test" };
  return { use: async name => (name === "db" ? db : name === "user" ? user : null) };
}

async function main() {
  const store = new Map();
  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/",
    beforeParse(win) { win.claude = fakeClaude(store); },
  });
  const { window } = dom, { document } = window;
  await new Promise(r => window.addEventListener("load", r));
  await wait(50);

  const $ = id => document.getElementById(id);
  const addTask = t => { $("newTask").value = t; $("addForm").dispatchEvent(new window.Event("submit", { cancelable: true })); };
  const rows = () => [...document.querySelectorAll("#todos li")];
  const rowText = li => li.querySelector(".txt").textContent;

  addTask("Write Q4 summary");
  addTask("Reply to emails");
  addTask("   ");
  check(rows().length === 2, "two tasks added, blank one ignored");

  rows()[0].querySelector(".txt").click();
  check(rows()[0].classList.contains("focus"), "first task is brewing");
  check($("focusline").textContent === "brewing: Write Q4 summary", "focus line shows brewing task");

  rows()[0].querySelector(".chk").click();
  check(rowText(rows()[1]) === "Write Q4 summary" && rows()[1].classList.contains("done"), "checked task moves to the end");
  check($("focusline").textContent === "", "checking off the brewing task un-brews it");
  check($("count").textContent === "1/2 done", "count shows 1/2 done");

  await wait(700); // debounce is 450 ms
  const saved = JSON.parse(store.get("data/users/u_test/todos") || "null");
  check(saved && saved.items.length === 2, "list written to data/users/<uid>/todos");

  $("clearDone").click();
  check(rows().length === 1 && rowText(rows()[0]) === "Reply to emails", "clear done removes finished tasks");

  check(/^\d\d:\d\d$/.test($("time").textContent), `timer shows ${$("time").textContent}`);
  check($("art").textContent.trim().length > 0, "mug frame rendered into <pre>");

  const root = document.documentElement;
  const label = btn => btn.querySelector("span:not(.off)").textContent;
  check(root.dataset.theme === "dark" && label($("theme")) === "lights: low", "starts in dark theme");
  $("theme").click();
  check(root.dataset.theme === "light" && label($("theme")) === "lights: up", "toggle switches to light theme");
  check(window.localStorage.getItem("ct-theme") === "light", "light theme is remembered");
  $("theme").click();
  check(root.dataset.theme === "dark" && window.localStorage.getItem("ct-theme") === "dark", "toggle switches back to dark");

  // reorder (Alt+arrow runs the same apply-and-save path as a drag drop)
  addTask("Stretch"); addTask("Water plants");
  const names = () => rows().map(rowText).join(" / ");
  check(rows().every(li => li.querySelector(".grip")), "every row has a drag grip");
  const altKey = (li, key) => li.querySelector(".chk").dispatchEvent(new window.KeyboardEvent("keydown", { key, altKey: true, bubbles: true }));
  altKey(rows()[0], "ArrowDown");
  check(names() === "Stretch / Reply to emails / Water plants", "Alt+Down moves a task down");
  altKey(rows()[2], "ArrowUp");
  check(names() === "Stretch / Water plants / Reply to emails", "Alt+Up moves a task up");
  rows()[0].querySelector(".chk").click();   // finish "Stretch": it drops into the done group
  altKey(rows()[1], "ArrowDown");
  check(names() === "Water plants / Reply to emails / Stretch", "tasks can't be moved into the done group");
  await wait(700);
  const order = JSON.parse(store.get("data/users/u_test/todos")).items.filter(x => !x.done).map(x => x.text).join(" / ");
  check(order === "Water plants / Reply to emails", "new order is saved");

  console.log("\npage list:", rows().map(li => li.querySelector(".chk").textContent + " " + rowText(li)).join(" | "));
  await wait(700);
  console.log("db doc:", store.get("data/users/u_test/todos"));
  window.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
