/* =========================================================
   PULSE — app logic (vanilla JS, no dependencies)
   Data persists in localStorage so it survives app restarts
   once compiled into an APK (WebView localStorage works fine).
   ========================================================= */

(function(){
  "use strict";

  const STORE_KEY = "pulse_state_v1";
  const RING_CIRC = 2 * Math.PI * 70;      // home ring
  const TIMER_CIRC = 2 * Math.PI * 96;     // focus ring

  const todayStr = () => {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
  };

  const QUOTES = [
    "Small steps, repeated daily, become momentum.",
    "Discipline is choosing between what you want now and what you want most.",
    "You don't rise to your goals, you fall to your systems.",
    "One good habit today outperforms ten intentions tomorrow.",
    "Progress is quiet. Show up anyway.",
    "The days are long, but the routine is what compounds.",
    "Consistency turns effort into ease."
  ];

  /* ---------------- STATE ---------------- */
  let state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){ /* ignore corrupt data */ }
    return {
      tasks: [],
      habits: [],
      notes: [],
      focus: { date: todayStr(), sessions: 0, minutes: 0 },
      quoteIdx: Math.floor(Math.random()*QUOTES.length)
    };
  }

  function saveState(){
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  // reset "today" fields when the day changes
  function rolloverDay(){
    const t = todayStr();
    if(state.focus.date !== t){
      state.focus = { date: t, sessions: 0, minutes: 0 };
    }
    state.habits.forEach(h=>{
      if(h.lastDate !== t) h.doneToday = false;
      // break streak if a day was fully skipped
      if(h.lastDate && h.lastDate !== t){
        const last = new Date(h.lastDate.replace(/-/g,"/"));
        const now = new Date(t.replace(/-/g,"/"));
        const diffDays = Math.round((now - last) / 86400000);
        if(diffDays > 1) h.streak = 0;
      }
    });
    saveState();
  }
  rolloverDay();

  /* ---------------- DOM refs ---------------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const views = $$(".view");
  const navBtns = $$(".nav-btn");
  const fab = $("#fab");
  const sheetBackdrop = $("#sheetBackdrop");
  const sheet = $("#sheet");

  let currentView = "home";
  let taskFilter = "all";
  let currentPriority = "low";

  /* ---------------- NAVIGATION ---------------- */
  function showView(name){
    currentView = name;
    views.forEach(v => v.classList.toggle("active", v.dataset.view === name));
    navBtns.forEach(b => b.classList.toggle("active", b.dataset.view === name));
    if(name === "home") renderHome();
  }
  navBtns.forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));

  /* ---------------- GREETING / DATE ---------------- */
  function renderHeader(){
    const now = new Date();
    const h = now.getHours();
    const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Winding down";
    $("#greeting").textContent = greeting;
    $("#dateDay").textContent = now.getDate();
    $("#dateMonth").textContent = now.toLocaleString(undefined,{month:"short"});
    $("#dailyQuote").textContent = QUOTES[state.quoteIdx % QUOTES.length];
  }

  /* ================= TASKS ================= */
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function addTask(text, priority){
    if(!text.trim()) return;
    state.tasks.unshift({ id: uid(), text: text.trim(), done:false, priority, createdAt: Date.now() });
    saveState();
    renderTasks();
    renderHome();
  }
  function toggleTask(id){
    const t = state.tasks.find(t=>t.id===id);
    if(t) t.done = !t.done;
    saveState(); renderTasks(); renderHome();
  }
  function deleteTask(id){
    state.tasks = state.tasks.filter(t=>t.id!==id);
    saveState(); renderTasks(); renderHome();
  }

  function renderTasks(){
    const list = $("#taskList");
    let items = state.tasks;
    if(taskFilter === "active") items = items.filter(t=>!t.done);
    if(taskFilter === "done") items = items.filter(t=>t.done);

    list.innerHTML = "";
    items.forEach(t=>{
      const li = document.createElement("li");
      li.className = "item-row" + (t.done ? " done" : "");
      li.innerHTML = `
        <button class="check" data-id="${t.id}" aria-label="toggle">
          <svg viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="#1a1128" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="pri-dot ${t.priority}"></span>
        <span class="item-text">${escapeHtml(t.text)}</span>
        <button class="item-del" data-del="${t.id}" aria-label="delete">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>`;
      list.appendChild(li);
    });

    $("#taskEmpty").classList.toggle("show", state.tasks.length === 0);
  }

  $("#taskList").addEventListener("click", e=>{
    const chk = e.target.closest(".check");
    const del = e.target.closest("[data-del]");
    if(chk) toggleTask(chk.dataset.id);
    if(del) deleteTask(del.dataset.del);
  });

  $("#taskFilters").addEventListener("click", e=>{
    const btn = e.target.closest(".chip");
    if(!btn) return;
    $$("#taskFilters .chip").forEach(c=>c.classList.remove("active"));
    btn.classList.add("active");
    taskFilter = btn.dataset.filter;
    renderTasks();
  });

  /* ================= HABITS ================= */
  function addHabit(name){
    if(!name.trim()) return;
    state.habits.unshift({ id: uid(), name: name.trim(), streak:0, doneToday:false, lastDate:null });
    saveState(); renderHabits(); renderHome();
  }
  function toggleHabit(id){
    const h = state.habits.find(h=>h.id===id);
    if(!h) return;
    const t = todayStr();
    if(h.doneToday){
      h.doneToday = false;
      h.streak = Math.max(0, h.streak - 1);
      h.lastDate = null;
    } else {
      h.doneToday = true;
      h.streak += 1;
      h.lastDate = t;
    }
    saveState(); renderHabits(); renderHome();
  }
  function deleteHabit(id){
    state.habits = state.habits.filter(h=>h.id!==id);
    saveState(); renderHabits(); renderHome();
  }

  function renderHabits(){
    const list = $("#habitList");
    list.innerHTML = "";
    state.habits.forEach(h=>{
      const li = document.createElement("li");
      li.className = "item-row" + (h.doneToday ? " done" : "");
      li.innerHTML = `
        <button class="check" data-id="${h.id}" aria-label="toggle">
          <svg viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="#1a1128" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <span class="item-text">${escapeHtml(h.name)}</span>
        <span class="streak-badge">🔥 ${h.streak}</span>
        <button class="item-del" data-del="${h.id}" aria-label="delete">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>`;
      list.appendChild(li);
    });
    $("#habitEmpty").classList.toggle("show", state.habits.length === 0);
    const total = state.habits.length;
    const done = state.habits.filter(h=>h.doneToday).length;
    $("#habitStreakSummary").textContent = total ? `${done}/${total} done today` : "";
  }

  $("#habitList").addEventListener("click", e=>{
    const chk = e.target.closest(".check");
    const del = e.target.closest("[data-del]");
    if(chk) toggleHabit(chk.dataset.id);
    if(del) deleteHabit(del.dataset.del);
  });

  /* ================= NOTES ================= */
  function addNote(title, body){
    if(!title.trim() && !body.trim()) return;
    state.notes.unshift({ id: uid(), title: title.trim() || "Untitled", body: body.trim(), updatedAt: Date.now() });
    saveState(); renderNotes();
  }
  function deleteNote(id){
    state.notes = state.notes.filter(n=>n.id!==id);
    saveState(); renderNotes();
  }
  function renderNotes(){
    const grid = $("#noteGrid");
    grid.innerHTML = "";
    state.notes.forEach(n=>{
      const card = document.createElement("div");
      card.className = "note-card";
      card.innerHTML = `
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-body">${escapeHtml(n.body)}</div>
        <button class="note-del" data-del="${n.id}" aria-label="delete">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>`;
      grid.appendChild(card);
    });
    $("#noteEmpty").classList.toggle("show", state.notes.length === 0);
  }
  $("#noteGrid").addEventListener("click", e=>{
    const del = e.target.closest("[data-del]");
    if(del) deleteNote(del.dataset.del);
  });

  /* ================= HOME (ring + agenda) ================= */
  function renderHome(){
    renderHeader();
    const totalTasks = state.tasks.length;
    const doneTasks = state.tasks.filter(t=>t.done).length;
    const totalHabits = state.habits.length;
    const doneHabits = state.habits.filter(h=>h.doneToday).length;

    const totalAll = totalTasks + totalHabits;
    const doneAll = doneTasks + doneHabits;
    const pct = totalAll ? Math.round((doneAll/totalAll)*100) : 0;

    const ring = $("#ringProgress");
    const offset = RING_CIRC - (pct/100)*RING_CIRC;
    ring.style.strokeDashoffset = offset;
    $("#ringPct").textContent = pct + "%";

    $("#statTasks").textContent = `${doneTasks}/${totalTasks}`;
    $("#statHabits").textContent = `${doneHabits}/${totalHabits}`;
    $("#statFocus").textContent = `${state.focus.minutes}m`;

    // agenda: pending tasks (priority order) + undone habits, capped
    const priOrder = { high:0, med:1, low:2 };
    const pendingTasks = state.tasks.filter(t=>!t.done)
      .sort((a,b)=>priOrder[a.priority]-priOrder[b.priority])
      .slice(0,4)
      .map(t=>({ label:t.text, tag:t.priority, kind:"task" }));
    const pendingHabits = state.habits.filter(h=>!h.doneToday)
      .slice(0,3)
      .map(h=>({ label:h.name, tag:"habit", kind:"habit" }));

    const agendaItems = [...pendingTasks, ...pendingHabits].slice(0,6);
    const agenda = $("#homeAgenda");
    agenda.innerHTML = "";
    if(agendaItems.length === 0){
      agenda.innerHTML = `<div class="empty-state show"><p>All clear ✨</p><span>Nothing pending right now</span></div>`;
    } else {
      agendaItems.forEach(it=>{
        const dotColor = it.kind === "habit" ? "var(--violet)" : ({low:"var(--success)",med:"var(--gold)",high:"var(--danger)"}[it.tag]);
        const row = document.createElement("div");
        row.className = "agenda-item";
        row.innerHTML = `<span class="agenda-dot" style="background:${dotColor}"></span>
          <span>${escapeHtml(it.label)}</span>
          <span class="sub">${it.kind === "habit" ? "habit" : it.tag}</span>`;
        agenda.appendChild(row);
      });
    }
  }

  /* ================= FOCUS TIMER ================= */
  let timerTotalSecs = 25*60;
  let timerRemaining = timerTotalSecs;
  let timerRunning = false;
  let timerInterval = null;

  function formatTime(s){
    const m = Math.floor(s/60).toString().padStart(2,"0");
    const sec = (s%60).toString().padStart(2,"0");
    return `${m}:${sec}`;
  }

  function updateTimerDisplay(){
    $("#timerDisplay").textContent = formatTime(timerRemaining);
    const progressFraction = 1 - (timerRemaining/timerTotalSecs);
    $("#timerRingProgress").style.strokeDashoffset = TIMER_CIRC - progressFraction*TIMER_CIRC;
    $("#timerSessions").textContent = `${state.focus.sessions} session${state.focus.sessions===1?"":"s"} completed today`;
  }

  function startTimer(){
    timerRunning = true;
    $("#timerToggle").textContent = "Pause";
    $("#timerState").textContent = "focusing";
    timerInterval = setInterval(()=>{
      timerRemaining--;
      if(timerRemaining <= 0){
        clearInterval(timerInterval);
        timerRunning = false;
        $("#timerToggle").textContent = "Start";
        $("#timerState").textContent = "done";
        state.focus.sessions += 1;
        state.focus.minutes += Math.round(timerTotalSecs/60);
        saveState();
        renderHome();
        timerRemaining = timerTotalSecs;
      }
      updateTimerDisplay();
    }, 1000);
  }
  function pauseTimer(){
    timerRunning = false;
    clearInterval(timerInterval);
    $("#timerToggle").textContent = "Start";
    $("#timerState").textContent = "paused";
  }
  function resetTimer(){
    pauseTimer();
    timerRemaining = timerTotalSecs;
    $("#timerState").textContent = "ready";
    updateTimerDisplay();
  }

  $("#timerToggle").addEventListener("click", ()=>{
    if(timerRunning) pauseTimer(); else startTimer();
  });
  $("#timerReset").addEventListener("click", resetTimer);

  $("#timerModes").addEventListener("click", e=>{
    const btn = e.target.closest(".chip");
    if(!btn) return;
    $$("#timerModes .chip").forEach(c=>c.classList.remove("active"));
    btn.classList.add("active");
    timerTotalSecs = parseInt(btn.dataset.mins,10) * 60;
    resetTimer();
  });

  /* ================= SHEET (add flows) ================= */
  const sheetBodies = {
    tasks: "#sheetTaskBody",
    habits: "#sheetHabitBody",
    notes: "#sheetNoteBody"
  };

  function openSheet(){
    // decide which body to show based on current view (default tasks)
    const target = sheetBodies[currentView] || sheetBodies.tasks;
    Object.values(sheetBodies).forEach(sel=>$(sel).classList.add("hidden"));
    $(target).classList.remove("hidden");
    sheetBackdrop.classList.add("show");
    document.body.style.overflow = "hidden";
    const firstInput = $(target).querySelector("input");
    if(firstInput) setTimeout(()=>firstInput.focus(), 250);
  }
  function closeSheet(){
    sheetBackdrop.classList.remove("show");
    document.body.style.overflow = "";
  }

  fab.addEventListener("click", ()=>{
    if(["home","focus"].includes(currentView)){
      showView("tasks");
      setTimeout(openSheet, 60);
    } else {
      openSheet();
    }
  });
  sheetBackdrop.addEventListener("click", e=>{ if(e.target === sheetBackdrop) closeSheet(); });

  // task save
  $("#taskSave").addEventListener("click", ()=>{
    addTask($("#taskInput").value, currentPriority);
    $("#taskInput").value = "";
    closeSheet();
  });
  $(".priority-row").addEventListener("click", e=>{
    const btn = e.target.closest(".chip");
    if(!btn) return;
    $$(".priority-row .chip").forEach(c=>c.classList.remove("active"));
    btn.classList.add("active");
    currentPriority = btn.dataset.pri;
  });
  $("#taskInput").addEventListener("keydown", e=>{
    if(e.key === "Enter") $("#taskSave").click();
  });

  // habit save
  $("#habitSave").addEventListener("click", ()=>{
    addHabit($("#habitInput").value);
    $("#habitInput").value = "";
    closeSheet();
  });
  $("#habitInput").addEventListener("keydown", e=>{
    if(e.key === "Enter") $("#habitSave").click();
  });

  // note save
  $("#noteSave").addEventListener("click", ()=>{
    addNote($("#noteTitleInput").value, $("#noteBodyInput").value);
    $("#noteTitleInput").value = "";
    $("#noteBodyInput").value = "";
    closeSheet();
  });

  /* ---------------- utils ---------------- */
  function escapeHtml(str){
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------- INIT ---------------- */
  function init(){
    renderHeader();
    renderTasks();
    renderHabits();
    renderNotes();
    renderHome();
    updateTimerDisplay();

    // keep header/date fresh + guard against day rollover while app stays open
    setInterval(()=>{
      rolloverDay();
      renderHeader();
    }, 60*1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
