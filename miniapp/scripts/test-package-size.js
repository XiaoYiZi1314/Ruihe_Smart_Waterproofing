const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function packagedFiles(applyPackRules = true) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json')));
  function walk(dir) {
    return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
      const file = path.join(dir, entry.name);
      const rel = path.relative(root, file).split(path.sep).join('/');
      if (applyPackRules && config.packOptions.ignore.some(rule => rule.type === 'folder' ? rel === rule.value || rel.startsWith(rule.value + '/') : rel === rule.value)) return [];
      return entry.isDirectory() ? walk(file) : [{file:rel,size:fs.statSync(file).size}];
    });
  }
  return walk(root);
}
test('miniapp source package stays below 1.8MB with margin for compilation', () => {
  const files=packagedFiles();const bytes=files.reduce((sum,item)=>sum+item.size,0);
  console.log(`Packaged source: ${bytes} bytes (${(bytes/1024).toFixed(1)} KiB)`);
  assert(bytes < 1.8*1024*1024, `Package too large: ${bytes} bytes; largest files: ${JSON.stringify(files.sort((a,b)=>b.size-a.size).slice(0,5))}`);
});

// The quality scan budgets image/audio resources together, not one image at a time.
// Use decimal 200 KB conservatively, and also scan files before pack exclusions.
test('combined image and audio resources stay within the 200 KB quality budget', () => {
  const mediaExtension = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|heic|mp3|wav|ogg|aac|m4a|flac|aiff?|opus)$/i;
  for (const applyPackRules of [true, false]) {
    const media = packagedFiles(applyPackRules).filter(item => mediaExtension.test(item.file));
    const bytes = media.reduce((sum, item) => sum + item.size, 0);
    console.log(`Image/audio ${applyPackRules ? 'packaged' : 'all source'}: ${bytes} bytes`);
    assert(bytes <= 200000, `Media total exceeds 200 KB: ${bytes} bytes`);
  }
});
