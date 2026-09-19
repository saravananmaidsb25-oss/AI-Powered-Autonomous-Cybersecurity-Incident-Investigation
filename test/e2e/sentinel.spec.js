import {test, expect} from '@playwright/test';
import {mandatoryRequirements} from '../../src/requirements.js';
import {trainingFixture} from '../../src/trainingExample.js';
import {spawn,spawnSync} from 'node:child_process';
import {randomInt,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {enterDemoWorkspace} from './helpers.js';

test('mandatory requirements and historical agent trace are visible',async({page,request})=>{
  const session=await(await request.get('/api/session')).json();
  const headers={'X-Sentinel-Demo-Token':session.token};
  await request.post('/api/simulate/account/reset',{headers,data:{}});
  await request.post('/api/simulate/account/step',{headers,data:{step:1}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await enterDemoWorkspace(page);
  await page.getByRole('button',{name:'Project requirements'}).click();
  for(const section of mandatoryRequirements)for(const item of section.items)await expect(page.getByText(item,{exact:true})).toBeVisible();
  await page.locator('.nav-item[data-view="investigate"]').click();
  const agent=page.locator('#investigation-agent');
  await expect(agent).toContainText('1 / 1 exact observations supported');
  await agent.locator('summary').first().click();
  await expect(agent).toContainText('AC-01');
  await expect(agent).not.toContainText('AC-02');
  await page.locator('#time-range').fill('0');
  await expect(agent).toContainText('insufficient-evidence');
  await expect(agent).not.toContainText('AC-01');
  expect(errors).toEqual([]);
});

test('operations UI trains, deploys and rolls back an evaluated model',async({page})=>{
  await enterDemoWorkspace(page);
  await page.locator('.nav-item[data-view="operations"]').click();
  await expect(page.getByText('Configuration required',{exact:false}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Collect Wazuh alerts'})).toBeDisabled();
  const dataset=trainingFixture('browser-model-v1');
  await page.locator('#training-file').setInputFiles({name:'training.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(dataset))});
  await page.locator('#training-approved').check();
  await page.getByRole('button',{name:'Train uploaded dataset'}).click();
  await expect(page.locator('#model-version')).toHaveValue('browser-model-v1');
  await page.getByRole('button',{name:'Deploy evaluated model'}).click();
  await expect(page.getByText('Active inference version: browser-model-v1')).toBeVisible();
  await page.getByRole('button',{name:'Roll back model'}).click();
  await expect(page.getByText('Active inference version: iforest-demo-v1')).toBeVisible();
});

test('real telemetry is visibly separate from simulated response',async({page,request})=>{
  const response=await request.post('/api/v1/telemetry/events',{headers:{Authorization:'Bearer e2e-fixture-telemetry-token-not-for-production'},data:{event_id:'browser-real-1',timestamp:new Date().toISOString(),event_type:'authentication_failure',source_type:'authentication',user_id:'browser-lab',action:'Browser fixture real-source event',normalized:{failures:27}}});
  expect(response.status()).toBe(201);
  await enterDemoWorkspace(page);await page.locator('.scenario-item[data-scenario="telemetry"]').click();
  await expect(page.locator('.alert-banner').first()).toContainText('Real telemetry · simulated response');
  await page.locator('.nav-item[data-view="investigate"]').click();
  await expect(page.locator('#evidence-timeline')).toContainText('Browser fixture real-source event');
  await expect(page.getByRole('button',{name:'Investigate external evidence'})).toBeDisabled();
});

test('local login and logout work through the browser',async({page})=>{
  const port=randomInt(61001,63000),db=join(tmpdir(),'sentinel-login-'+randomUUID()+'.db');
  const env={...process.env,PORT:String(port),SENTINEL_X_DB_PATH:db,SENTINEL_X_AUTH_MODE:'local',SENTINEL_X_PUBLIC_ORIGIN:`http://127.0.0.1:${port}`};
  const created=spawnSync(process.execPath,['scripts/create-user.js','default','browser-user','analyst'],{env:{...env,SENTINEL_X_NEW_USER_PASSWORD:'browser-fixture-password-only'},encoding:'utf8'});expect(created.status).toBe(0);
  const child=spawn(process.execPath,['server.js'],{env,stdio:'ignore'});
  try{
    let ready=false;for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}expect(ready).toBeTruthy();
    await page.goto(`http://127.0.0.1:${port}`);await page.locator('input[name="username"]').fill('browser-user');await page.locator('input[name="password"]').fill('browser-fixture-password-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page.locator('.identity')).toContainText('browser-user');await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Enter demo workspace'})).toBeVisible();
  }finally{child.kill();}
});

test.describe('SENTINEL-X production inspection', () => {
  test('API health and static assets', async ({request}) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    const body = await health.json();
    expect(body.status).toBe('ok');
    expect(body.engine).toBe('SENTINEL-X');

    const html = await request.get('/');
    expect(html.ok()).toBeTruthy();
    expect(await html.text()).toContain('SENTINEL-X');

    const main = await request.get('/src/main.js');
    expect(main.ok()).toBeTruthy();

    const css = await request.get('/src/ui/styles/tokens.css');
    expect(css.ok()).toBeTruthy();
  });

  test('command center loads with white theme UI', async ({page}) => {
    await enterDemoWorkspace(page);
    await expect(page).toHaveTitle(/SENTINEL-X/i);
    await expect(page.locator('.sidebar__title')).toContainText('SENTINEL');
    await expect(page.locator('.page-header__title')).toContainText('Security command center');

    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toMatch(/rgb\(24[67], 2[45][0-9], 2[45][0-9]\)|rgb\(255, 255, 255\)/);

    await expect(page.locator('.metric-grid .metric-card')).toHaveCount(6);
    await expect(page.locator('.pipeline__step')).toHaveCount(9);
    await expect(page.locator('.alert-banner')).toBeVisible();
  });

  test('navigation across all workspace views', async ({page}) => {
    await enterDemoWorkspace(page);
    const views = [
      {btn: 'Investigation', title: 'Incident investigation'},
      {btn: 'Intelligence', title: 'Proactive security intelligence'},
      {btn: 'Governance', title: 'Response governance'},
      {btn: 'Configuration', title: 'Policy & risk configuration'},
      {btn: 'Command center', title: 'Security command center'},
      {btn: 'Jury evaluation', title: 'Jury evaluation scorecard'},
    ];
    for (const v of views) {
      await page.getByRole('button', {name: v.btn}).click();
      await expect(page.locator('.page-header__title')).toContainText(v.title);
    }
  });

  test('simulation replay and investigation features', async ({page}) => {
    await enterDemoWorkspace(page);
    await page.getByRole('button', {name: /Start simulation|Replay attack/i}).click();
    await page.waitForTimeout(2000);

    await page.getByRole('button', {name: 'Investigation'}).click();
    await expect(page.locator('.card__title').filter({hasText: 'Attack story engine'})).toBeVisible();
    await expect(page.locator('#attack-graph svg, #attack-graph .empty-state')).toBeVisible();
    await expect(page.locator('.assistant')).toBeVisible();
    await expect(page.locator('.identity__text')).toContainText('Demo Analyst');
    await expect(page.getByText('Risk score calculation').first()).toBeVisible();
    await expect(page.locator('.risk-formula code')).toContainText('rawRisk');
    await expect(page.locator('.section-nav')).toBeVisible();
    await expect(page.locator('#graph-search')).toBeVisible();

    const inspector=page.locator('.event-inspector').first();
    await inspector.locator('summary').click();
    await expect(inspector).toContainText('Normalized fields');
    await expect(inspector).toContainText('Redacted raw payload');

    await page.locator('#graph-search').fill('account');
    await expect(page.locator('#attack-graph svg, #attack-graph .empty-state')).toBeVisible();
    await page.getByRole('button',{name:'Zoom graph in'}).click();
    await expect(page.locator('.zoom-value')).toContainText('120%');

    await page.getByRole('button', {name: 'Why was this detected?'}).click();
    await expect(page.locator('.assistant__answer pre')).toBeVisible();
    await expect(page.locator('.citation-list a').first()).toBeVisible();

    const slider = page.locator('#time-range');
    await slider.fill('2');
    await expect(slider).toHaveValue('2');
  });

  test('accessibility landmarks and keyboard focus are present',async({page})=>{
    await enterDemoWorkspace(page);
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('nav.sidebar__nav')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await expect(page.locator('.nav-item[aria-current="page"]')).toHaveCount(1);
  });

  test('governance approval workflow', async ({page}) => {
    await enterDemoWorkspace(page);
    await page.getByRole('button', {name: /Start simulation|Replay attack/i}).click();
    await page.waitForTimeout(5000);

    await page.locator('.nav-item[data-view="governance"]').click();
    await expect(page.locator('.policy-panel')).toBeVisible();

    const approve = page.getByRole('button', {name: /Approve action|Execute safe action/i});
    if (await approve.isVisible()) {
      await approve.click();
      await expect(page.locator('.action-item').first()).toBeVisible();
    }
  });

  test('admin policy and weights configuration', async ({page}) => {
    await enterDemoWorkspace(page);
    await page.locator('.nav-item[data-view="admin"]').click();
    await expect(page.locator('#pol-risk')).toBeVisible();
    await expect(page.locator('[data-weight="auth_failure"]')).toBeVisible();
    await page.getByRole('button', {name: 'Save policy'}).click();
    await page.getByRole('button', {name: 'Save weights'}).click();
  });

  test('scenario switching and intelligence feedback', async ({page}) => {
    await enterDemoWorkspace(page);
    await page.locator('.scenario-item[data-scenario="lateral"]').click();
    await expect(page.locator('.page-header__eyebrow')).toContainText('SX-2402');

    await page.getByRole('button', {name: /Start simulation|Replay attack/i}).click();
    await page.waitForTimeout(4500);

    await page.locator('.nav-item[data-view="intelligence"]').click();
    await page.locator('#feedback-reason').fill('Routine maintenance pattern');
    await page.getByRole('button', {name: 'False positive'}).click();
    await expect(page.locator('.feedback-item').first()).toBeVisible();
  });

  test('jury evaluation scorecard is visible', async ({page}) => {
    await enterDemoWorkspace(page);
    await page.locator('.nav-item[data-view="evaluation"]').click();
    await expect(page.getByRole('heading', {name: 'Jury evaluation scorecard'})).toBeVisible();
    await expect(page.getByText('Human jury criteria breakdown')).toBeVisible();
    await expect(page.getByText('AI jury score breakdown')).toBeVisible();
    await expect(page.getByText('Innovation & Idea')).toBeVisible();
    await expect(page.getByText('Security & Auth')).toBeVisible();
    await page.getByRole('button', {name: '☾'}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('report API endpoints respond', async ({request}) => {
    const json = await request.get('/api/report/account/json');
    expect(json.ok()).toBeTruthy();
    const data = await json.json();
    expect(data.incidentId).toBe('SX-2401');

    const csv = await request.get('/api/report/account/csv');
    expect(csv.ok()).toBeTruthy();
    expect(await csv.text()).toContain('incidentId');

    const html = await request.get('/api/report/account/html');
    expect(html.ok()).toBeTruthy();
    expect(await html.text()).toContain('SENTINEL-X');
  });
});
