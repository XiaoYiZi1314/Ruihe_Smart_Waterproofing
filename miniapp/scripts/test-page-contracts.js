const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
let pages = 0;
for (const page of JSON.parse(fs.readFileSync(path.join(root, 'app.json'))).pages) {
  const js = fs.readFileSync(path.join(root, page + '.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, page + '.wxml'), 'utf8');
  let definition;
  const helper = new Proxy(function(){return '';}, { get(){return helper;} });
  vm.runInNewContext(js, { Page: value => {definition=value;}, require:()=>helper, getApp:()=>({globalData:{}}), wx:helper, console, setTimeout, clearTimeout });
  assert(definition, page + ' must register Page');
  for (const match of wxml.matchAll(/(?:bind|catch):?[\w-]+="([A-Za-z_$][\w$]*)"/g)) {
    assert.equal(typeof definition[match[1]], 'function', page + ': missing event handler ' + match[1]);
  }
  pages++;
}
let resources;
vm.runInNewContext(fs.readFileSync(path.join(root,'utils/resources.js'),'utf8'),{module:{set exports(value){resources=value;}}, getApp:()=>({globalData:{apiBaseUrl:'https://example.test'}})});
const data=resources.normalizeResources({images:[{image_url:'/api/upload/file/id?expires=1&signature=x'}],cover_image:'/uploads/cover.png',avatar_url:'/assets/avatar.png'});
assert.equal(data.images[0].image_url,'https://example.test/api/upload/file/id?expires=1&signature=x');
assert.equal(data.avatar_url,'/assets/avatar.png');
assert.equal(resources.addRealCovers([{name:'屋顶防水'}])[0].cover_image,'/assets/services/roof.jpg');
console.log(`${pages} page event contracts and resource URL tests passed`);
