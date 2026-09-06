/**
 * 小程序静态检查：页面跳转目标存在性 + switchTab 合法性
 */
const fs = require('fs');
const path = require('path');

const appJson = JSON.parse(fs.readFileSync('miniapp/app.json', 'utf8'));
const pages = appJson.pages;
const pageSet = new Set(pages);
const tabPages = new Set((appJson.tabBar.list || []).map((t) => t.pagePath));

let issues = [];

function checkFile(full) {
  const content = fs.readFileSync(full, 'utf8');
  const re = /\/pages\/[a-zA-Z\-/]+/g;
  let m;
  while ((m = re.exec(content))) {
    const p = m[0].split('?')[0].replace(/\/$/, '');
    if (!pageSet.has(p.slice(1))) {
      issues.push(full.split(path.sep).join('/') + ' → ' + p + ' (页面不存在)');
    }
  }
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (f.endsWith('.wxml') || f.endsWith('.js')) checkFile(full);
  }
}

walk('miniapp/pages');
for (const f of ['miniapp/app.js', 'miniapp/utils/request.js', 'miniapp/utils/auth.js', 'miniapp/utils/api.js']) {
  if (fs.existsSync(f)) checkFile(f);
}

console.log(issues.length === 0 ? '✅ 所有页面跳转目标均存在' : '❌ 发现问题:\n' + issues.join('\n'));

const tabIssues = [];
for (const p of pages) {
  for (const ext of ['js', 'wxml']) {
    const f = 'miniapp/' + p + '.' + ext;
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, 'utf8');
    const re = /switchTab\(\{[^}]*url: '([^']+)'/g;
    let m;
    while ((m = re.exec(content))) {
      const target = m[1].slice(1).split('?')[0];
      if (!tabPages.has(target)) tabIssues.push(p + ' switchTab → ' + target + ' (非 TabBar 页)');
    }
  }
}
console.log(tabIssues.length === 0 ? '✅ switchTab 目标全部合法' : '❌\n' + tabIssues.join('\n'));
