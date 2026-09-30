// Draws the planner mascot "수무" (a round blue chick) in six poses as transparent PNGs.
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const OUT = process.env.TEMP + "\\swz\\exe\\mascot";
fs.mkdirSync(OUT, { recursive: true });

const eyes = {
  open: `<ellipse cx="78" cy="96" rx="9" ry="11" fill="#1b2433"/><ellipse cx="122" cy="96" rx="9" ry="11" fill="#1b2433"/><circle cx="81" cy="92" r="3.5" fill="#fff"/><circle cx="125" cy="92" r="3.5" fill="#fff"/>`,
  blink: `<path d="M69 97q9 6 18 0M113 97q9 6 18 0" stroke="#1b2433" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  angry: `<ellipse cx="78" cy="99" rx="8" ry="9" fill="#1b2433"/><ellipse cx="122" cy="99" rx="8" ry="9" fill="#1b2433"/><circle cx="80" cy="96" r="3" fill="#fff"/><circle cx="124" cy="96" r="3" fill="#fff"/><path d="M64 80l24 9M136 80l-24 9" stroke="#1b2433" stroke-width="5" stroke-linecap="round"/>`,
  happy: `<path d="M68 99q10-12 20 0M112 99q10-12 20 0" stroke="#1b2433" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  calm: `<path d="M69 96q9 5 18 0M113 96q9 5 18 0" stroke="#1b2433" stroke-width="4.5" fill="none" stroke-linecap="round"/>`
};
const mouth = {
  smile: `<path d="M92 118l8 8 8-8z" fill="#ff9d2e" stroke="#e57f0f" stroke-width="2" stroke-linejoin="round"/>`,
  shout: `<path d="M90 114h20l-10 16z" fill="#ff9d2e" stroke="#e57f0f" stroke-width="2" stroke-linejoin="round"/><path d="M95 118h10l-5 7z" fill="#b8451a"/>`,
  open: `<path d="M90 115q10-4 20 0l-10 15z" fill="#ff9d2e" stroke="#e57f0f" stroke-width="2" stroke-linejoin="round"/>`
};
const props = {
  none: "",
  pencil: `<g transform="translate(150 118) rotate(28)"><rect x="-6" y="-34" width="12" height="46" rx="2" fill="#ffcf4a" stroke="#d99a12" stroke-width="2"/><rect x="-6" y="-40" width="12" height="8" rx="2" fill="#ff8fa3"/><path d="M-6 12l6 12 6-12z" fill="#f6d7a7" stroke="#d99a12" stroke-width="2"/><path d="M-2 20l2 4 2-4z" fill="#333"/></g>`,
  bell: `<g transform="translate(156 92) rotate(18)"><path d="M-16 14q0-30 16-30t16 30l5 5h-42z" fill="#ffcf4a" stroke="#d99a12" stroke-width="2.5" stroke-linejoin="round"/><circle cx="0" cy="24" r="5" fill="#d99a12"/><path d="M-26 -12q-8 8-6 20M26 -12q8 8 6 20" stroke="#ffb020" stroke-width="3" fill="none" stroke-linecap="round"/></g>`,
  cup: `<g transform="translate(150 134)"><path d="M-16 -14h30l-3 26q-1 6-7 6h-10q-6 0-7-6z" fill="#fff" stroke="#8fb3d9" stroke-width="2.5"/><path d="M14 -8q10 0 10 8t-11 8" fill="none" stroke="#8fb3d9" stroke-width="2.5"/><path d="M-6 -22q-4-6 0-12M4 -22q-4-6 0-12" stroke="#9fb8d0" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`,
  star: `<g fill="#ffcf4a" stroke="#e7a50f" stroke-width="2" stroke-linejoin="round"><path d="M160 58l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z"/><path d="M36 66l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" transform="scale(.9) translate(4 6)"/></g>`,
  sweat: `<path d="M150 70q8 10 0 16q-8-6 0-16z" fill="#8fd3ff" stroke="#4aa8e0" stroke-width="2"/>`
};
const wing = {
  down: `<path d="M34 128q-14 10-8 26 12-2 22-14z" fill="#5aa7f5" stroke="#2f7fd9" stroke-width="2.5" stroke-linejoin="round"/><path d="M166 128q14 10 8 26-12-2-22-14z" fill="#5aa7f5" stroke="#2f7fd9" stroke-width="2.5" stroke-linejoin="round"/>`,
  up: `<path d="M36 118q-22-10-22-32 16 2 30 20z" fill="#5aa7f5" stroke="#2f7fd9" stroke-width="2.5" stroke-linejoin="round"/><path d="M164 118q22-10 22-32-16 2-30 20z" fill="#5aa7f5" stroke="#2f7fd9" stroke-width="2.5" stroke-linejoin="round"/>`,
  point: `<path d="M34 128q-14 10-8 26 12-2 22-14z" fill="#5aa7f5" stroke="#2f7fd9" stroke-width="2.5" stroke-linejoin="round"/><path d="M164 120q24-8 30-26-18-4-34 14z" fill="#5aa7f5" stroke="#2f7fd9" stroke-width="2.5" stroke-linejoin="round"/>`
};
function chick({ e, m, p, w, blush = true }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs><radialGradient id="b" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="#bfe3ff"/><stop offset=".55" stop-color="#6db8ff"/><stop offset="1" stop-color="#3a8ef0"/></radialGradient>
  <radialGradient id="belly" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eaf5ff"/></radialGradient></defs>
  <ellipse cx="100" cy="186" rx="52" ry="7" fill="rgba(20,40,80,.18)"/>
  <path d="M80 176l-6 8h14zM120 176l-6 8h14z" fill="#ff9d2e" stroke="#e57f0f" stroke-width="2" stroke-linejoin="round"/>
  ${wing[w]}
  <path d="M100 30c44 0 70 36 70 80 0 44-30 70-70 70s-70-26-70-70c0-44 26-80 70-80z" fill="url(#b)" stroke="#2f7fd9" stroke-width="3"/>
  <path d="M100 30q-4-16 6-24 2 10 10 12-10 2-16 12z" fill="#6db8ff" stroke="#2f7fd9" stroke-width="2.5" stroke-linejoin="round"/>
  <ellipse cx="100" cy="140" rx="42" ry="36" fill="url(#belly)"/>
  ${blush ? '<ellipse cx="64" cy="116" rx="10" ry="6" fill="#ff9fb4" opacity=".7"/><ellipse cx="136" cy="116" rx="10" ry="6" fill="#ff9fb4" opacity=".7"/>' : ''}
  ${eyes[e]}${mouth[m]}${props[p]}
</svg>`;
}
const poses = {
  idle: { e: "open", m: "smile", p: "pencil", w: "down" },
  blink: { e: "blink", m: "smile", p: "pencil", w: "down" },
  nag: { e: "angry", m: "shout", p: "sweat", w: "point" },
  bell: { e: "open", m: "open", p: "bell", w: "up" },
  rest: { e: "calm", m: "smile", p: "cup", w: "down" },
  cheer: { e: "happy", m: "open", p: "star", w: "up" }
};
(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
  const pg = await b.newPage();
  await pg.setViewport({ width: 200, height: 200, deviceScaleFactor: 1 });
  let sheet = "";
  for (const [name, pose] of Object.entries(poses)) {
    const svg = chick(pose);
    await pg.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await pg.screenshot({ path: `${OUT}\\${name}.png`, omitBackground: true, clip: { x: 0, y: 0, width: 200, height: 200 } });
    sheet += `<div style="display:inline-block;text-align:center;font:14px sans-serif">${svg}<br>${name}</div>`;
  }
  await pg.setViewport({ width: 1240, height: 240 });
  await pg.setContent(`<html><body style="margin:10px;background:#f4f7fb">${sheet}</body></html>`);
  await pg.screenshot({ path: `${OUT}\\sheet.png` });
  await b.close();
  console.log("ok");
})();
