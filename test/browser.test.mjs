import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const url = 'http://127.0.0.1:5176/';
let server, browser, directory;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'tracery-browser-'));
  let logs = '';
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], { cwd: root, stdio: ['ignore','pipe','pipe'] });
  server.stdout.on('data', chunk => { logs += chunk; }); server.stderr.on('data', chunk => { logs += chunk; });
  let ready = false;
  for(let i=0; i<100; i++) { if(server.exitCode!==null) throw new Error(logs); try { if((await fetch(url)).ok) { ready=true; break; } } catch {} await delay(100); }
  assert.ok(ready, 'Local browser-test server did not start: '+logs);
  browser = await chromium.launch({ headless: true });
}, {timeout:30000});
after(async () => { await browser?.close(); server?.kill('SIGTERM'); if(directory) await rm(directory,{recursive:true,force:true}); });

async function withPage(work, init) {
  const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:1000} });
  await context.route(/fonts\.(?:googleapis|gstatic)\.com/, route => route.abort());
  if(init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(url); await page.waitForFunction(()=>window.tracery?.settings);
    await work(page);
    assert.deepEqual(errors, [], 'Browser JavaScript errors');
  } catch(error) {
    await mkdir(join(root,'output/playwright'),{recursive:true});
    await page.screenshot({path:join(root,'output/playwright/failure.png'),fullPage:true}).catch(()=>{});
    throw error;
  } finally { await context.close(); }
}
function image(color, size=16) {
  const png=new PNG({width:size,height:size});
  for(let i=0;i<png.data.length;i+=4) png.data.set([...color,255],i);
  return PNG.sync.write(png);
}
async function upload(page,name='logo.png',bytes=image([255,0,100])) {
  await page.locator('#imgfile').setInputFiles({name,mimeType:'image/png',buffer:bytes});
  await page.waitForFunction(name=>window.tracery.project.image?.name===name&&!window.tracery.editor.busy,name);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function view(page, key) { await page.locator(`[data-view=${key}]`).click(); await frame(page); }
async function inspect(page, key) { await view(page,'editor'); await page.locator(`[data-inspector=${key}]`).click(); await frame(page); }
const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function control(page, label) {
  const pane = ['Hot Magenta','Phosphor'].includes(label) ? 'color' : label==='Reset everything'||label==='Full ██' ? 'output' : 'shape';
  await inspect(page,pane);
  await page.getByRole('button',{name:label,exact:true}).click();
  await frame(page);
}
async function looks(page) { await inspect(page,'shape'); const details=page.locator('details').filter({has:page.locator('#customLook')}); if(await details.getAttribute('open')===null) await details.locator('summary').click(); }
async function download(page, tab) {
  await view(page,'export');
  await page.getByRole('tab',{name:tab,exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#download').disabled);
  const event=page.waitForEvent('download'); await page.locator('#download').click(); const file=await event;
  const path=join(directory,file.suggestedFilename()); await file.saveAs(path);
  return {name:file.suggestedFilename(),path,bytes:await readFile(path)};
}
const flush=page=>page.evaluate(()=>window.tracery.storage.flushDraft());
const pixels=(page,selector='#cv')=>page.locator(selector).evaluate(canvas=>canvas.toDataURL()).then(data=>createHash('sha256').update(data).digest('hex'));

test('complete image projects survive reload and round-trip between browser and CLI',()=>withPage(async page=>{
  await upload(page); await control(page,'Hot Magenta'); await flush(page);
  const preview=await pixels(page);
  const project=await download(page,'Project'); const saved=JSON.parse(project.bytes);
  assert.equal(saved.image.name,'logo.png'); assert.equal(saved.format,'tracery');
  const raw=await download(page,'Raw ANSI');
  const cli=execFileSync(process.execPath,['dist/cli/tracery.js',project.path],{cwd:root});
  assert.deepEqual(cli,raw.bytes,'Browser and CLI image rendering differ');
  await page.reload(); await page.waitForFunction(()=>window.tracery?.editor.decodedImage); await view(page,'editor');
  assert.equal(await pixels(page),preview);
  await control(page,'Reset everything'); await page.waitForFunction(()=>window.tracery.settings.src==='ascii');
  await page.locator('#importFile').setInputFiles(project.path); await page.waitForFunction(()=>window.tracery.settings.src==='image'&&!window.tracery.editor.busy); await frame(page);
  assert.equal(await pixels(page),preview);
}));

test('invalid imports and bad embedded images leave the current project intact',()=>withPage(async page=>{
  await upload(page); const before=await page.evaluate(()=>window.tracery.project);
  for(const value of [{mode:'wrong'},{format:'tracery',version:2,settings:{}},{format:'tracery',version:1,settings:{src:'image'},image:{name:'bad',dataUrl:'data:image/png;base64,aGVsbG8='}}]) {
    await page.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    await page.waitForFunction(()=>document.querySelector('#importMsg').textContent.includes('Could not load'));
    assert.deepEqual(await page.evaluate(()=>window.tracery.project),before);
  }
}));

test('project library saves thumbnails, shares assets, and supports rename, duplicate, delete, and reopen',()=>withPage(async page=>{
  await upload(page); await page.locator('#projectName').fill('Banner A'); await page.locator('#saveProject').click();
  await view(page,'library'); await page.getByRole('button',{name:'Open Banner A',exact:true}).waitFor();
  assert.equal(await page.locator('#projectLibrary img').count(),1);
  await page.locator('#projectName').fill('Banner B'); await page.locator('#renameProject').click(); await page.getByRole('button',{name:'Open Banner B',exact:true}).waitFor();
  await page.locator('#duplicateProject').click(); await page.waitForFunction(()=>document.querySelector('#libraryMsg').textContent.includes('Created Banner B copy')); await view(page,'library'); await page.getByRole('button',{name:'Open Banner B copy',exact:true}).waitFor(); await flush(page);
  const assetCount=await page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('tracery',1);open.onsuccess=()=>{const db=open.result;const count=db.transaction('assets').objectStore('assets').count();count.onsuccess=()=>{resolve(count.result);db.close();};count.onerror=()=>reject(count.error);};}));
  assert.equal(assetCount,1,'Copies should share the saved source asset');
  await page.locator('#deleteProject').click(); await page.getByRole('button',{name:'Open Banner B copy',exact:true}).waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.tracery.settings.src),'image');
  await control(page,'Reset everything'); await page.waitForFunction(()=>window.tracery.settings.src==='ascii');
  await view(page,'library'); await page.getByRole('button',{name:'Open Banner B',exact:true}).click(); await page.waitForFunction(()=>window.tracery.settings.src==='image'); await flush(page);
  await page.reload(); await page.waitForFunction(()=>window.tracery?.editor.decodedImage); await view(page,'library'); await page.getByRole('button',{name:'Open Banner B',exact:true}).waitFor();
}));

test('saved looks preserve palettes and shapes without replacing the source',()=>withPage(async page=>{
  await upload(page); await control(page,'Hot Magenta'); await control(page,'Drop shadow');
  const before=await page.evaluate(()=>({stops:window.tracery.settings.stops,shadowOn:window.tracery.settings.shadowOn}));
  await looks(page); await page.locator('#lookName').fill('Neon shadow'); await page.locator('#saveLook').click(); await page.waitForFunction(()=>[...document.querySelector('#customLook').options].some(option=>option.textContent==='Neon shadow'));
  await control(page,'Clean'); await control(page,'Phosphor');
  await looks(page); await page.locator('#customLook').selectOption({label:'Neon shadow'}); await page.waitForFunction(()=>window.tracery.settings.shadowOn);
  assert.deepEqual(await page.evaluate(()=>({stops:window.tracery.settings.stops,shadowOn:window.tracery.settings.shadowOn})),before);
  assert.equal(await page.evaluate(()=>window.tracery.project.image.name),'logo.png'); await flush(page);
  await page.reload(); await page.waitForFunction(()=>window.tracery?.settings); await page.waitForFunction(()=>[...document.querySelector('#customLook').options].some(option=>option.textContent==='Neon shadow'));
  await looks(page); await page.locator('#customLook').selectOption({label:'Neon shadow'}); await page.locator('#deleteLook').click(); await page.waitForFunction(()=>document.querySelector('#customLook').options.length===1);
}));

test('column fitting changes the exported art and every download matches its tab',()=>withPage(async page=>{
  await control(page,'Full ██'); await page.locator('#targetCols').selectOption('80');
  const raw=await download(page,'Raw ANSI');
  for(const line of raw.bytes.toString().trimEnd().split('\n')) assert.ok([...line.replace(/\x1b\[[0-9;]*m/g,'')].length<=80);
  for(const [tab,name] of [['Install command','oneir.install.sh'],['Agent prompt','oneir.agent.txt'],['printf','oneir.printf.sh'],['PNG','oneir.png'],['Terminal image','oneir.graphics.sh'],['Project','oneir.tracery.json']]) {
    const file=await download(page,tab); assert.equal(file.name,name);
    if(tab==='PNG') assert.deepEqual([...file.bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    else { const shown=await page.locator('#out').innerText(); assert.equal(file.bytes.toString(),shown+'\n'); }
  }
  assert.equal(await page.locator('#cw').getAttribute('max'),'6');
  assert.equal(await page.locator('#pngCell').getAttribute('min'),'1');
}));

test('a pinned reference stays unchanged while the current preview changes',()=>withPage(async page=>{
  await page.locator('#pinComparison').click(); await page.locator('#comparison').waitFor({state:'visible'});
  const before=await pixels(page,'#referenceCanvas');
  await control(page,'Hot Magenta'); await control(page,'Bevel');
  await page.waitForFunction(()=>window.tracery.settings.bevel);
  assert.equal(await pixels(page,'#referenceCanvas'),before);
  assert.notEqual(await pixels(page),before);
  await page.locator('#clearComparison').click(); await page.locator('#comparison').waitFor({state:'hidden'});
}));

test('image undo, reset undo, keyboard shortcuts, and slider gesture grouping remain correct',()=>withPage(async page=>{
  await upload(page,'red.png',image([255,0,0])); await upload(page,'blue.png',image([0,0,255]));
  await page.locator('#undo').click(); await page.waitForFunction(()=>window.tracery.project.image?.name==='red.png');
  await page.locator('#redo').click(); await page.waitForFunction(()=>window.tracery.project.image?.name==='blue.png');
  await control(page,'Reset everything'); await page.waitForFunction(()=>window.tracery.settings.src==='ascii');
  await page.locator('#undo').click(); await page.waitForFunction(()=>window.tracery.settings.src==='image');
  await control(page,'Bare fill'); await control(page,'Double ring');
  await page.getByRole('heading',{name:'Tracery',exact:true}).click(); await page.keyboard.press('Control+z'); await page.waitForFunction(()=>window.tracery.settings.outline===0);
  await page.keyboard.press('Control+Shift+z'); await page.waitForFunction(()=>window.tracery.settings.outline===2);
  const slider=page.locator('#gap'); await slider.scrollIntoViewIfNeeded(); const before=await slider.inputValue(); const box=await slider.boundingBox();
  await page.mouse.move(box.x+box.width*0.3,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+box.width*0.98,box.y+box.height/2,{steps:8}); await page.mouse.up();
  await page.waitForFunction(()=>window.tracery.settings.gap===3); await page.locator('#undo').click(); await page.waitForFunction(value=>window.tracery.settings.gap===Number(value),before);
}));

test('palette edits reuse source masks, history shares image objects, and autosave waits for a pause',()=>withPage(async page=>{
  await upload(page); await flush(page);
  const before=await page.evaluate(()=>({masks:window.tracery.renderer.maskBuilds,writes:window.tracery.storage.writes}));
  await inspect(page,'color'); for(let i=0;i<6;i++) await page.locator('#generate').click();
  assert.equal(await page.evaluate(()=>window.tracery.renderer.maskBuilds),before.masks);
  assert.equal(await page.evaluate(()=>window.tracery.editor.history.peekUndo().image===window.tracery.project.image),true);
  await flush(page); assert.equal(await page.evaluate(()=>window.tracery.storage.writes),before.writes+1);
  const renders=await page.evaluate(()=>window.tracery.renderer.renderBuilds);
  await page.locator('#fit').uncheck(); await page.locator('#zoom').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>window.tracery.renderer.renderBuilds),renders);
}));

test('corrupt legacy storage is preserved for recovery',()=>withPage(async page=>{
  assert.equal(await page.evaluate(()=>localStorage.getItem('tracery:v1')),'{broken');
  assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('tracery:recovery:'))));
  assert.match(await page.locator('#saveStatus').innerText(),/recovery copy/);
},()=>localStorage.setItem('tracery:v1','{broken')));


test('desktop views keep editing separate from library and exports, with keyboard inspector navigation',()=>withPage(async page=>{
  assert.equal(await page.locator('#exportView').isVisible(),false);
  assert.equal(await page.locator('#libraryView').isVisible(),false);
  const before=await page.evaluate(()=>window.tracery.project);
  for(const size of [{width:1280,height:720},{width:1920,height:1080}]) {
    await page.setViewportSize(size); await frame(page);
    assert.equal(await page.locator('#cv').evaluate(canvas=>{
      const art=canvas.getBoundingClientRect(), screen=canvas.parentElement.getBoundingClientRect();
      return art.width<=screen.width-64&&art.height<=screen.height-52;
    }),true,'Fit preview must keep the artwork inside the desktop stage');
  }
  await page.setViewportSize({width:1440,height:1000}); await frame(page);
  await page.locator('#tab-source').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-color').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#inspector-color').isVisible(),true);
  assert.equal(await page.locator('#inspector-source').isVisible(),false);
  assert.ok(await page.locator('.palette-art').count()>100);
  assert.equal(await page.locator('body').evaluate(element=>element.scrollHeight<=innerHeight),true);
  await view(page,'export'); assert.equal(await page.locator('#inspectorView').isVisible(),false);
  assert.equal(await page.locator('#term').isVisible(),true); assert.equal(await page.locator('#exportView').isVisible(),true);
  await view(page,'library'); assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>window.tracery.project),before);
  await page.locator('#newProject').click(); await page.waitForFunction(()=>window.tracery.settings.ascii==='');
  assert.equal(await page.locator('#inspectorView').isVisible(),true);
  await page.locator('#undo').click(); await page.waitForFunction(()=>window.tracery.settings.ascii.length>0);
  assert.deepEqual(await page.evaluate(()=>window.tracery.project),before);
  await page.locator('#projectName').fill('Desktop banner'); await page.locator('#saveProject').click();
  await page.waitForFunction(()=>document.querySelector('#libraryMsg').textContent.includes('Saved Desktop banner.'));
  await page.locator('#saveNewProject').click(); await page.waitForFunction(()=>document.querySelector('#libraryMsg').textContent.includes('Desktop banner copy'));
  await view(page,'library'); assert.equal(await page.locator('#projectLibrary .project-card').count(),2);
  await mkdir(join(root,'output/playwright'),{recursive:true}); await page.screenshot({path:join(root,'output/playwright/library.png')});
  await view(page,'editor'); await inspect(page,'color'); await page.screenshot({path:join(root,'output/playwright/editor.png')});
  await view(page,'export'); await page.screenshot({path:join(root,'output/playwright/export.png')});
  await page.reload(); await page.waitForFunction(()=>window.tracery?.settings);
  await page.waitForFunction(()=>document.querySelector('#saveProject').textContent==='Save changes');
  assert.equal(await page.locator('#projectName').inputValue(),'Desktop banner copy');
  await page.locator('#importFile').setInputFiles({name:'Imported.tracery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});
  await page.waitForFunction(()=>document.querySelector('#importMsg').textContent.startsWith('Loaded'));
  assert.equal(await page.locator('#saveProject').innerText(),'Save project');
  assert.equal(await page.locator('#projectName').inputValue(),'Imported');
}));
