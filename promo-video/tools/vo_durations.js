/* Measures each voiceover clip and writes its length into src/data/narration.json,
   then reports any line that runs past its window.
   Run: node tools/vo_durations.js [guide|final]   (default: final if it exists, else guide) */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src', 'data', 'narration.json');
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const dirFor = (set) => path.join(ROOT, 'public', 'audio', set === 'final' ? 'vo' : 'vo-guide');
const has = (set) => data.cues.every((c) => fs.existsSync(path.join(dirFor(set), c.file)));
const set = process.argv[2] || (has('final') ? 'final' : 'guide');
if (!has(set)) {
  const missing = data.cues.filter((c) => !fs.existsSync(path.join(dirFor(set), c.file))).map((c) => c.file);
  console.error(`missing in ${dirFor(set)}: ${missing.join(', ')}`);
  process.exit(1);
}

/* WAV length from its header: data bytes / byte rate. */
const wavSeconds = (file) => {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error(file + ' is not a WAV file');
  const byteRate = b.readUInt32LE(28);
  let p = 12;
  while (p < b.length - 8) {
    const id = b.toString('ascii', p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === 'data') return size / byteRate;
    p += 8 + size + (size % 2);
  }
  throw new Error('no data chunk in ' + file);
};

let over = 0;
data.set = set;
for (const c of data.cues) {
  c.dur = Math.round(wavSeconds(path.join(dirFor(set), c.file)) * 100) / 100;
  const room = Math.round((c.until - c.at) * 100) / 100;
  const flag = c.dur > room ? `  OVER by ${(c.dur - room).toFixed(2)} s` : '';
  if (flag) over++;
  console.log(`${c.id}  ${c.dur.toFixed(2)} s of ${room.toFixed(2)} s${flag}`);
}
fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 1));
console.log(over ? `${over} line(s) too long for their window` : `all lines fit (${set} voice)`);
