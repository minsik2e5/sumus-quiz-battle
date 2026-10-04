import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { registrationState } from '../lib/marketplace.ts';

// Isolated compiled-app QA. All state writes are intercepted, never sent to production.
const payload = JSON.parse(fs.readFileSync(process.argv[2]));
const signed = JSON.parse(fs.readFileSync(process.argv[3]));
const source = structuredClone(payload.state);
const root = path.resolve('dist/client');
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || '/tmp/deal-qa-chromium',args:['--no-sandbox'],...(process.env.HTTPS_PROXY ? {proxy:{server:process.env.HTTPS_PROXY}} : {})});
const checks=[];
try {
  for (const width of [1440,390]) {
    const context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true});
    let writes=0;const errors=[];
    await context.route('https://deal-hunter.qa/**',async route=>{
      const request=route.request();const url=new URL(request.url());
      if(url.pathname==='/api/cloud') {
        if(request.method()==='PUT'){writes++;return route.fulfill({status:503,json:{error:'QA cannot save'}});}
        if(url.searchParams.get('route')==='files/sign')return route.fulfill({json:signed});
        return route.fulfill({json:payload});
      }
      const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
      assert(file.startsWith(root+path.sep));
      if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto('https://deal-hunter.qa/');
    await page.getByLabel('운영 접속 코드').fill('isolated-qa');
    await page.getByRole('button',{name:'내 원장 열기',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('deal_hunter_v5_draft')||'null')?.state.items.length===164);
    const nav=width>760?page.locator('aside nav'):page.locator('.mobile-nav');
    await nav.getByRole('button',{name:/재고관리/}).click();
    assert.equal(await page.locator('.inventory-product-card').count(),source.items.filter(i=>!i.archivedAt).length);
    const columns=await page.locator('.inventory-card-list').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns,width>760?4:2);
    const filters=page.locator('.registration-filter-pills');
    await filters.getByRole('button',{name:'등록완료',exact:true}).click();
    assert.equal(await page.locator('.inventory-product-card').count(),source.items.filter(i=>!i.archivedAt&&registrationState(i)==='등록완료').length);
    assert(await page.locator('.marketplace-registration a').count()>0);
    const link=page.locator('.marketplace-registration a').first();
    assert.match(await link.getAttribute('href'),/^https:\/\/[^/]*bunjang.co.kr\//);
    assert.equal(await link.getAttribute('target'),'_blank');
    const selectedShop=source.items.flatMap(i=>i.marketplaceLinks||[]).find(l=>l.shop)?.shop;
    await page.getByRole('combobox',{name:'번개장터 상점',exact:true}).selectOption(selectedShop);
    const visible=await page.locator('.inventory-product-card').allTextContents();
    assert(visible.length>0&&visible.every(t=>t.includes(selectedShop)));
    await page.getByRole('button',{name:'☷ 텍스트로만 보기',exact:true}).click();
    assert(await page.getByRole('columnheader',{name:'번개장터 등록',exact:true}).isVisible());
    assert(await page.locator('.inventory-text-table .marketplace-registration a').count()>0);
    await page.getByRole('button',{name:'▦ 이미지로 보기',exact:true}).click();
    await page.getByRole('combobox',{name:'번개장터 상점',exact:true}).selectOption('전체');
    await filters.getByRole('button',{name:'전체',exact:true}).click();
    await page.locator('.pill-filters').getByRole('button',{name:/^판매완료/}).click();
    const sold=source.items.filter(i=>!i.archivedAt&&i.inventoryStatus==='판매완료');
    assert.equal(await page.locator('.inventory-sale-overlay').count(),sold.length);
    assert.equal(await page.locator('.inventory-sale-overlay').first().innerText(),'판매완료');
    const square=await page.locator('.inventory-photo').first().boundingBox();assert(Math.abs(square.width-square.height)<1);
    await page.screenshot({path:path.resolve('..',`gallery-${width}-qa.png`)});
    const photoItem=sold.find(i=>i.productPhotos?.some(p=>signed.urls?.[p.key]));
    assert(photoItem,'A real signed product photo must be checked');
    await page.getByPlaceholder('상품명·브랜드·상품코드로 검색').fill(photoItem.id);
    await page.waitForFunction(()=>{const img=document.querySelector('.inventory-photo img');return img?.complete&&img.naturalWidth>0;},null,{timeout:30000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(writes,0);assert.deepEqual(errors,[]);
    const loaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('deal_hunter_v5_draft')).state);
    for(const item of source.items){const found=loaded.items.find(i=>i.id===item.id);for(const key of ['purchasePrice','expectedPrice','actualPrice','saleDate','acquiredDate','size','color'])assert.deepEqual(found[key],item[key]);assert.deepEqual(found.marketplaceLinks,item.marketplaceLinks);}
    checks.push({width,columns,soldOverlays:sold.length,shopFilter:true,textView:true,realPhotoLoaded:true,automaticWrites:writes});
    await context.close();
  }
  console.log(JSON.stringify({checks}));
} finally {await browser.close();}
