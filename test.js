const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Map();
function element(tag = 'div') {
    return {tag, children: [], style: {}, textContent: '', innerHTML: '',
        classList: {add() {}, remove() {}}, setAttribute(k, v) {this[k] = v;},
        appendChild(c) {this.children.push(c);}, querySelectorAll() {return [];},
        click() {if (this.onclick) this.onclick();}};
}
let copied;
const context = vm.createContext({document: {
    getElementById(id) {if (!elements.has(id)) elements.set(id, element()); return elements.get(id);},
    createElement: element
}, navigator: {clipboard: {writeText() {return Promise.reject(Error('denied'));}}},
alert(text) {copied = text;}, setTimeout() {}, Date});
vm.runInContext(script, context);
const run = code => vm.runInContext(code, context);
const baseline = execFileSync('git', ['show', 'HEAD:index.html'], {encoding: 'utf8'});
for (const name of ['DRIVERS', 'SCHEDULE']) {
    const pattern = new RegExp(`const ${name} = \\[[\\s\\S]*?\\n\\]`);
    assert.equal(html.match(pattern)[0], baseline.match(pattern)[0]);
}
assert.equal(run('DRIVERS.length'), 84);
assert.equal(run('SCHEDULE.length'), 13);
assert.equal(run("SCHEDULE.filter(r => r.type === 'gravel').length"), 8);
assert.equal(run("SCHEDULE.filter(r => r.type === 'tarmac').length"), 4);
assert.equal(run("SCHEDULE.filter(r => r.type === 'snow').length"), 1);
assert(!html.includes('\uFE0F'));
for (const key of ['Enter', ' ']) {
    run("state.drafted = []; renderDrivers();");
    const card = elements.get('driver-grid').children.at(-14);
    assert.equal(card.role, 'button');
    let prevented = false;
    card.onkeydown({key, preventDefault() {prevented = true;}});
    assert(prevented);
    assert.equal(run('state.drafted.length'), 1);
    const chip = elements.get('draft-status').children.at(-1).children[0];
    assert.equal(chip.tag, 'button');
    assert.equal(chip.type, 'button');
    chip.click();
    assert.equal(run('state.drafted.length'), 0);
}
run('DRIVERS.slice(0, 5).forEach(draftDriver)');
assert.equal(elements.get('count-text').textContent, '🏎\uFE0F Roster Complete!');
assert.equal(elements.get('start-btn').disabled, false);
run("['season-wins', 'season-streak', 'season-points'].forEach(id => $(id).textContent = '278')");
elements.get('start-btn').click();
for (const id of ['season-wins', 'season-streak', 'season-points']) assert.equal(elements.get(id).textContent, '0');
for (const wins of [0, 5, 7, 9, 13]) {
    run(`state.season.playerWins = ${wins}; showFinale();`);
    assert.equal(elements.get('finale-record').textContent, `${wins}-${13-wins}`);
    assert.equal(elements.get('share-record').textContent, `${wins}-${13-wins}`);
    assert.equal(elements.get('finale-badges').innerHTML.includes('Grand Chelem'), wins === 13);
    assert.equal(elements.get('finale-title').textContent.includes('UNDEFEATED'), wins === 13);
}
run(`simulateRace(99, 'snow', () => { globalThis.calls = (globalThis.calls || 0) + 1; return 0.1; })`);
assert.equal(run('calls'), 58); // 14 ratings + 30 score rolls + 14 snow bonuses
(async () => {
    elements.get('share-btn').click();
    await new Promise(setImmediate);
    assert(copied.includes('13-0'));
    console.log('PASS: six fixes, selector encoding, unchanged 84 drivers / 13 rounds (8 gravel, 4 tarmac, 1 snow).');
})().catch(error => {console.error(error); process.exitCode = 1;});
