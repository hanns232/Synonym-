/* Synonym Memory Trainer
 * - Leitner spaced repetition (L0-L5)
 * - Quiz modes: Multiple choice, Type-in, Definition→Headword, Matching
 * - LocalStorage persistence
 */

const STORE_KEY = 'syno_trainer_v1';
const DEFAULT_INTERVALS = { L1: 1, L2: 3, L3: 7, L4: 14, L5: 30 };

// ---------- Storage Layer ----------
function loadStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) {
    const state = {
      items: [], // {id, word, meaning, synonyms[], stats{level:0-5,next:ts,attempts,correct,streak}}
      intervals: DEFAULT_INTERVALS,
      history: [] // quiz outcomes
    };
    // seed
    let id = 1;
    for (const it of (window.SEED_DATA || [])) {
      state.items.push({
        id: id++,
        word: it.word.trim(),
        meaning: it.meaning.trim(),
        synonyms: it.synonyms.map(s=>s.trim()).filter(Boolean),
        stats: { level: 0, next: 0, attempts: 0, correct: 0, streak: 0, createdAt: Date.now() }
      });
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return state;
  }
  try { return JSON.parse(raw); } catch { localStorage.removeItem(STORE_KEY); return loadStore(); }
}
function saveStore(state) { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

let STATE = loadStore();

// ---------- Util ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const now = () => Date.now();
const days = d => d*86400000;
function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString();
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function sample(arr, n){ arr = arr.slice(); shuffle(arr); return arr.slice(0,n); }
function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function normalize(s){ return s.toLowerCase().trim(); }

// ---------- Tabs ----------
function setActiveTab(tabId){
  $$('.tab').forEach(t=>t.classList.remove('active'));
  $$('.tab-btn').forEach(b=>b.classList.remove('active'));
  $('#tab-' + tabId).classList.add('active');
  $(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
  if (tabId==='review') renderProgressTable();
}
$$('.tab-btn').forEach(btn=>btn.addEventListener('click', ()=> setActiveTab(btn.dataset.tab)));
setActiveTab('quiz');

// ---------- Dashboard ----------
function refreshDashboard(){
  const total = STATE.items.length;
  const due = STATE.items.filter(it => it.stats.next <= now()).length;
  const newToday = STATE.items.filter(it => (now()-it.stats.createdAt) < days(1)).length;
  const attempts = STATE.items.reduce((s,it)=>s+it.stats.attempts,0);
  const correct = STATE.items.reduce((s,it)=>s+it.stats.correct,0);
  const acc = attempts ? Math.round((100*correct)/attempts) : 0;
  const mastered = STATE.items.filter(it => it.stats.level>=5).length;
  $('#stat-total').textContent = total;
  $('#stat-due').textContent = due;
  $('#stat-new').textContent = newToday;
  $('#stat-acc').textContent = acc + '%';
  $('#stat-streak').textContent = STATE.items.reduce((s,it)=>Math.max(s,it.stats.streak),0);
  $('#stat-mastered').textContent = mastered;
}
refreshDashboard();

// ---------- Settings ----------
function loadIntervalsUI(){
  $('#int-l1').value = STATE.intervals.L1 ?? DEFAULT_INTERVALS.L1;
  $('#int-l2').value = STATE.intervals.L2 ?? DEFAULT_INTERVALS.L2;
  $('#int-l3').value = STATE.intervals.L3 ?? DEFAULT_INTERVALS.L3;
  $('#int-l4').value = STATE.intervals.L4 ?? DEFAULT_INTERVALS.L4;
  $('#int-l5').value = STATE.intervals.L5 ?? DEFAULT_INTERVALS.L5;
}
loadIntervalsUI();

$('#saveIntervals').addEventListener('click', ()=>{
  STATE.intervals = {
    L1: Math.max(0, parseInt($('#int-l1').value||1,10)),
    L2: Math.max(0, parseInt($('#int-l2').value||3,10)),
    L3: Math.max(0, parseInt($('#int-l3').value||7,10)),
    L4: Math.max(0, parseInt($('#int-l4').value||14,10)),
    L5: Math.max(0, parseInt($('#int-l5').value||30,10)),
  };
  saveStore(STATE);
  alert('Intervals saved.');
});

// ---------- Manage Set ----------
$('#addOne').addEventListener('click', ()=>{
  const word = $('#add-word').value.trim();
  const meaning = $('#add-meaning').value.trim();
  const syns = $('#add-syns').value.split(',').map(s=>s.trim()).filter(Boolean);
  if (!word || !meaning || syns.length===0) return alert('Please fill word, meaning, and at least one synonym.');
  const nextId = (STATE.items.reduce((m,it)=>Math.max(m,it.id),0) || 0) + 1;
  STATE.items.push({ id: nextId, word, meaning, synonyms: syns, stats: { level:0, next:0, attempts:0, correct:0, streak:0, createdAt: now() } });
  saveStore(STATE);
  $('#add-word').value = ''; $('#add-meaning').value=''; $('#add-syns').value='';
  refreshDashboard();
  alert('Added! Find it in Review → Progress.');
});

$('#importJSON').addEventListener('click', ()=>{
  try{
    const arr = JSON.parse($('#bulk-json').value);
    if (!Array.isArray(arr)) throw new Error('Not an array');
    const maxId = STATE.items.reduce((m,it)=>Math.max(m,it.id),0) || 0;
    let id = maxId + 1, added = 0;
    for (const it of arr){
      if (!it.word || !it.meaning || !Array.isArray(it.synonyms) || it.synonyms.length===0) continue;
      STATE.items.push({ id: id++, word: it.word.trim(), meaning: it.meaning.trim(), synonyms: it.synonyms.map(s=>s.trim()), stats:{ level:0,next:0,attempts:0,correct:0,streak:0,createdAt: now() } });
      added++;
    }
    saveStore(STATE);
    refreshDashboard();
    alert('Imported ' + added + ' items.');
  }catch(e){ alert('Import failed: ' + e.message); }
});

$('#resetAll').addEventListener('click', ()=>{
  if (!confirm('This will erase your words and progress. Continue?')) return;
  localStorage.removeItem(STORE_KEY);
  STATE = loadStore();
  refreshDashboard();
  renderProgressTable();
  alert('Reset complete.');
});

$('#exportAll').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(STATE, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'synonym_trainer_backup.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

$('#importAll').addEventListener('click', ()=>{
  try{
    const data = JSON.parse($('#importAllBox').value);
    if (!data.items || !Array.isArray(data.items)) throw new Error('Invalid backup format');
    STATE = data;
    saveStore(STATE);
    loadIntervalsUI();
    refreshDashboard();
    renderProgressTable();
    alert('Full import complete.');
  }catch(e){ alert('Import failed: ' + e.message); }
});

$('#exportData').addEventListener('click', ()=>{
  const minimal = STATE.items.map(it=>({word:it.word,meaning:it.meaning,synonyms:it.synonyms,stats:it.stats}));
  const blob = new Blob([JSON.stringify(minimal, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'synonym_progress.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// ---------- Progress Table ----------
function renderProgressTable(){
  const tbody = $('#progress-table tbody');
  tbody.innerHTML = '';
  for (const it of STATE.items){
    const tr = document.createElement('tr');
    const acc = it.stats.attempts ? Math.round(100*it.stats.correct/it.stats.attempts) : 0;
    tr.innerHTML = `
      <td><strong>${it.word}</strong></td>
      <td>${it.synonyms.join(', ')}</td>
      <td>${it.meaning}</td>
      <td><span class="pill l${it.stats.level}">L${it.stats.level}</span></td>
      <td>${fmtDate(it.stats.next)}</td>
      <td>${it.stats.attempts}</td>
      <td>${acc}%</td>
    `;
    tbody.appendChild(tr);
  }
}

// ---------- Quiz Engine ----------
let SESSION = null; // { queue:[], current:null, mode, correct, wrong, total }

function buildQueue(batchSize, newRatio){
  const due = STATE.items.filter(it => it.stats.next <= now());
  const fresh = STATE.items.filter(it => it.stats.level===0 && it.stats.attempts===0);
  const nNew = Math.min(fresh.length, Math.round(batchSize*newRatio));
  const nDue = Math.min(due.length, batchSize - nNew);
  const selection = sample(due, nDue).concat(sample(fresh, batchSize - nDue));
  if (selection.length < batchSize){
    const others = STATE.items.filter(it => !selection.includes(it));
    selection.push(...sample(others, Math.max(0, batchSize - selection.length)));
  }
  return shuffle(selection);
}

function nextItem(){
  if (!SESSION.queue.length) return null;
  return SESSION.queue.shift();
}

function schedule(it, correct){
  const s = it.stats;
  s.attempts += 1;
  if (correct){
    s.correct += 1;
    s.streak = (s.streak||0)+1;
    s.level = Math.min(5, (s.level||0) + 1);
  } else {
    s.streak = 0;
    s.level = Math.max(1, (s.level||0) - 1);
  }
  // schedule next
  let daysOut = 0;
  switch (s.level){
    case 0: daysOut = 0; break;
    case 1: daysOut = STATE.intervals.L1; break;
    case 2: daysOut = STATE.intervals.L2; break;
    case 3: daysOut = STATE.intervals.L3; break;
    case 4: daysOut = STATE.intervals.L4; break;
    case 5: daysOut = STATE.intervals.L5; break;
  }
  s.next = now() + days(daysOut);
}

function startQuiz(){
  const mode = $('#mode').value;
  const batch = parseInt($('#batch').value, 10);
  const newRatio = parseFloat($('#newRatio').value);
  SESSION = {
    mode, queue: buildQueue(batch, newRatio), current: null,
    correct: 0, wrong: 0, total: 0
  };
  $('#quiz-area').classList.remove('hidden');
  $('#feedback').innerHTML = '';
  renderNextQuestion();
}

$('#startQuiz').addEventListener('click', startQuiz);

function renderNextQuestion(){
  const it = nextItem();
  SESSION.current = it;
  if (!it){
    $('#quiz-area').innerHTML = `<h3>Session complete</h3>
      <p>Score: <strong>${SESSION.correct}</strong> correct / ${SESSION.total} attempts.</p>`;
    saveStore(STATE);
    refreshDashboard();
    renderProgressTable();
    return;
  }
  const container = $('#quiz-area');
  if (SESSION.mode==='mc') renderMC(it, container);
  else if (SESSION.mode==='type') renderType(it, container);
  else if (SESSION.mode==='def') renderDef(it, container);
  else if (SESSION.mode==='match') renderMatch(container);
}

function showFeedback(ok, text){
  $('#feedback').innerHTML = `<span class="${ok?'ok':'no'}">${text}</span>`;
  setTimeout(()=> $('#feedback').innerHTML = '', 1800);
}

// ---- MC (choose a synonym) ----
function renderMC(it, container){
  const correct = choice(it.synonyms);
  const distractorSyns = STATE.items
    .filter(x=>x.id!==it.id)
    .flatMap(x=>x.synonyms.map(s=>({s, id:x.id})));
  const wrongChoices = sample(distractorSyns.map(x=>x.s), 3);
  const options = shuffle([correct, ...wrongChoices]);
  container.innerHTML = `
    <div class="card">
      <div><strong>${it.word}</strong> <small>(${it.meaning})</small></div>
      <div class="answer-grid">
        ${options.map(o=>`<button class="answer" data-val="${o}">${o}</button>`).join('')}
      </div>
    </div>`;
  $$('#quiz-area .answer').forEach(btn=>btn.addEventListener('click', ()=>{
    const picked = btn.dataset.val;
    const ok = normalize(picked)===normalize(correct);
    if (ok){ btn.classList.add('correct'); }
    else { btn.classList.add('wrong'); }
    SESSION.total++;
    schedule(it, ok);
    if (ok){ SESSION.correct++; showFeedback(true, 'Correct!'); }
    else { showFeedback(false, `Wrong. One answer: "${correct}".`); }
    setTimeout(renderNextQuestion, 600);
  }));
}

// ---- Type the synonym ----
function renderType(it, container){
  container.innerHTML = `
    <div class="card">
      <div><strong>${it.word}</strong> <small>(${it.meaning})</small></div>
      <input id="type-input" placeholder="Type one advanced synonym..." />
      <div style="margin-top:10px">
        <button id="submitType" class="primary">Submit</button>
        <button id="showHint" class="secondary">Hint</button>
      </div>
    </div>`;
  $('#submitType').addEventListener('click', ()=>{
    const v = normalize($('#type-input').value);
    const ok = it.synonyms.some(s=> normalize(s)===v );
    SESSION.total++;
    schedule(it, ok);
    if (ok){ SESSION.correct++; showFeedback(true, 'Correct!'); }
    else { showFeedback(false, `Possible answers: ${it.synonyms.join(', ')}`); }
    setTimeout(renderNextQuestion, 600);
  });
  $('#showHint').addEventListener('click', ()=>{
    const first = it.synonyms[0];
    showFeedback(true, `Hint: starts with “${first[0]}”.`);
  });
}

// ---- Definition → Headword ----
function renderDef(it, container){
  const choices = sample(STATE.items, 4);
  if (!choices.includes(it)) choices[Math.floor(Math.random()*choices.length)] = it;
  container.innerHTML = `
    <div class="card">
      <div><em>Which headword matches this meaning?</em></div>
      <div style="margin:8px 0 12px"><strong>${it.meaning}</strong></div>
      <div class="answer-grid">
        ${choices.map(c=>`<button class="answer" data-id="${c.id}">${c.word}</button>`).join('')}
      </div>
    </div>`;
  $$('#quiz-area .answer').forEach(btn=>btn.addEventListener('click', ()=>{
    const ok = parseInt(btn.dataset.id,10)===it.id;
    if (ok) btn.classList.add('correct'); else btn.classList.add('wrong');
    SESSION.total++;
    schedule(it, ok);
    if (ok){ SESSION.correct++; showFeedback(true, 'Correct!'); }
    else { showFeedback(false, `It was “${it.word}”.`); }
    setTimeout(renderNextQuestion, 600);
  }));
}

// ---- Matching Pairs ----
function renderMatch(container){
  // Build 6 headwords with one synonym each
  const picks = sample(STATE.items, 6);
  const pairs = picks.map(p=>({w:p.word, s:choice(p.synonyms)}));
  const left = picks.map(p=>p.word);
  const right = shuffle(pairs.map(p=>p.s));

  container.innerHTML = `
    <div class="card">
      <div><em>Match each headword to a synonym:</em></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
        <div id="match-left">
          ${left.map(w=>`<div class="answer" draggable="false" data-word="${w}">${w}</div>`).join('')}
        </div>
        <div id="match-right">
          ${right.map(s=>`<div class="answer" draggable="true" data-s="${s}">${s}</div>`).join('')}
        </div>
      </div>
      <div style="margin-top:10px"><small>Drag a synonym onto its matching headword.</small></div>
    </div>`;

  const map = Object.fromEntries(pairs.map(p=>[p.w, p.s]));
  let remaining = left.length;

  $$('#match-right .answer').forEach(el=>{
    el.setAttribute('draggable','true');
    el.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/plain', el.dataset.s);
    });
  });
  $$('#match-left .answer').forEach(el=>{
    el.addEventListener('dragover', e=> e.preventDefault());
    el.addEventListener('drop', e=>{
      e.preventDefault();
      const s = e.dataTransfer.getData('text/plain');
      const ok = map[el.dataset.word] && normalize(map[el.dataset.word])===normalize(s);
      if (ok){
        el.classList.add('correct');
        el.textContent = `${el.textContent} — ${s}`;
        // remove the dragged one
        const r = $(`#match-right .answer[data-s="${CSS.escape(s)}"]`);
        if (r) r.remove();
        remaining--;
        if (remaining===0){
          // mark success for all 6
          SESSION.total += picks.length;
          picks.forEach(p=> schedule(STATE.items.find(it=>it.word===p.word), true));
          SESSION.correct += picks.length;
          showFeedback(true, 'All matched!');
          setTimeout(renderNextQuestion, 800);
        }
      } else {
        el.classList.add('wrong');
        showFeedback(false, 'Not a match. Try again.');
        setTimeout(()=> el.classList.remove('wrong'), 500);
      }
    });
  });
}

// ---------- Init some UI defaults ----------
(function init(){
  // set default tab button
  document.querySelector('.tab-btn[data-tab="quiz"]').classList.add('active');
  // fill intervals UI with defaults if not set
  if (!STATE.intervals) STATE.intervals = DEFAULT_INTERVALS;
  loadIntervalsUI();
  renderProgressTable();
})();
