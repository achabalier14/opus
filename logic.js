// =============================================================================
// LOGIC.JS - OPUS MASTER V22 (REPETITIONS AVANCEES & POPUPS)
// =============================================================================

// -----------------------------------------------------------------------------
// 1. CONFIGURATION ET DONNEES
// -----------------------------------------------------------------------------

const BELL_PARAMS = { 
    1: { name: "Bourdon", overlap: 0.250 }, 
    2: { name: "Feriale", overlap: 0.250 }, 
    3: { name: "Moyenne", overlap: 0.081 }, 
    4: { name: "Petite",  overlap: 0.080 } 
};

const AUDIO_FILES = {
    1: { v: "Sons/Volée/Cloche 2/", t: "Sons/Tintements/2.mp3" },
    2: { v: "Sons/Volée/Cloche 3/", t: "Sons/Tintements/3.mp3" },
    3: { v: "Sons/Volée/Cloche 4/", t: "Sons/Tintements/4.mp3" },
    4: { v: "Sons/Volée/Cloche 5/", t: "Sons/Tintements/5.mp3" }
};

// PARAMETRES GLOBAUX
let SETTINGS = {
    // Horloge
    clock_mode: "AUTO", 
    time_h: 12, time_m: 0, time_s: 0, 
    date_d: 1, date_m: 1, date_y: 2025,
    
    // Automatismes (Structure V22)
    // H = Heures, M = Demies, Q = Quarts
    auto_h: { on: true, rep: false, del: 60 }, // del = délai en secondes
    auto_m: { on: true, rep: false, del: 60 },
    auto_q: { on: false, rep: false, del: 60 },
    
    // Mode Nuit
    night_mode: true,
    night_start_h: 22, night_start_m: 0, 
    night_end_h: 7, night_end_m: 0,
    
    // Durées (sec)
    dur_angelus: 180, 
    dur_messe: 300, 
    dur_mariage: 600,
    dur_bapteme: 240,
    dur_glas: 900
};

const PRESET_NAMES = ["MESSE", "MARIAGE", "BAPTEME", "ANGELUS", "GLAS"];
const REP_UNITS = ["MIN", "HEURE", "JOUR", "SEM", "MOIS", "AN"];
const REP_END_TYPES = ["JAMAIS", "DATE", "NB FOIS"];
const DAYS_LABELS = ["L", "M", "M", "J", "V", "S", "D"]; // Lundi=0

// Bases de données
let SCHEDULE = [];
let LIBRARY = [];
let ACTIVE_LOOPS = [];

// ETAT GLOBAL
const STATE = {
    audioCtx: null, 
    engines: {}, 
    stopSignal: false, 
    relays: [0,0,0,0],
    
    menuStack: ["HOME"], 
    cursor: 0, 
    
    formData: null, 
    editingIndex: -1,     
    editingLibrary: false,
    
    // Editeur Plein Ecran
    timeEditor: { 
        active: false, 
        targetField: null, 
        type: "TIME", 
        vals:[], labels:[], cursor: 0 
    },
    
    // Editeur de Répétition
    repEditor: { 
        active: false, isEditing: false,
        interval: 1, unitIdx: 3, days: [0], 
        endTypeIdx: 0, endVal: 10, endD: 1, endM: 1, endY: 2025, 
        cursor: 0, subCursor: 0, 
        monthMode: 0, refDay: 1, refNth: 1, refWeekday: 0 
    },
    
    isChiming: false, 
    manualMode: "TINT", 
    manualDateObj: null
};

// -----------------------------------------------------------------------------
// 2. MOTEUR AUDIO
// -----------------------------------------------------------------------------

class BellEngine {
    constructor(id) { 
        this.id = id; 
        this.isSwinging = false; 
        this.buffers = {}; 
        this.stopReq = false;
        this.nextTime = 0;
    }

    async load() {
        try { 
            const f = AUDIO_FILES[this.id];
            this.buffers.tint = await this._fetch(f.t);
            this.buffers.debut = await this._fetch(f.v + 'debut.mp3');
            this.buffers.volee = await this._fetch(f.v + 'volee.mp3');
            this.buffers.fin = await this._fetch(f.v + 'fin.mp3');
        } catch(e) { console.log("Audio manquant cloche " + this.id); }
    }

    async _fetch(url) {
        const r = await fetch(url); 
        const b = await r.arrayBuffer();
        return await STATE.audioCtx.decodeAudioData(b);
    }

    tinte() {
        if(this.isSwinging) return;
        this._chkCtx();
        updateRelay(this.id, true); 
        setTimeout(() => updateRelay(this.id, false), 200);
        if(this.buffers.tint) this._play(this.buffers.tint);
    }

    startVolley() {
        if(this.isSwinging) return;
        this._chkCtx();
        this.isSwinging = true; 
        this.stopReq = false;
        
        updateRelay(this.id, true);
        const btn = document.getElementById('btn-'+this.id);
        if(btn) btn.classList.add('ringing');
        
        this.nextTime = STATE.audioCtx.currentTime;
        if(this.buffers.debut) {
            this._play(this.buffers.debut, this.nextTime);
            this.nextTime += (this.buffers.debut.duration - 0.1);
        }
        this._loop();
    }

    stopVolley() { 
        if(this.isSwinging) this.stopReq = true; 
    }

    _chkCtx() { 
        if(STATE.audioCtx && STATE.audioCtx.state === 'suspended') STATE.audioCtx.resume(); 
    }

    _loop() {
        if(!this.isSwinging) return;
        while(this.nextTime < STATE.audioCtx.currentTime + 0.1) {
            if(this.stopReq) {
                if(this.buffers.fin) this._play(this.buffers.fin, this.nextTime);
                this.isSwinging = false;
                updateRelay(this.id, false);
                const btn = document.getElementById('btn-'+this.id);
                if(btn) btn.classList.remove('ringing');
                return;
            } else {
                if(this.buffers.volee) {
                    this._play(this.buffers.volee, this.nextTime);
                    this.nextTime += (this.buffers.volee.duration - 0.1);
                }
            }
        }
        setTimeout(() => this._loop(), 25);
    }

    _play(buf, t=0) {
        if(!buf) return;
        const s = STATE.audioCtx.createBufferSource(); 
        s.buffer = buf;
        s.connect(STATE.audioCtx.destination); 
        s.start(t || STATE.audioCtx.currentTime);
    }
}

function updateRelay(id, state) {
    STATE.relays[id-1] = state ? 1 : 0;
    const el = document.getElementById('rel-'+id);
    if(el) { if(state) el.classList.add('on'); else el.classList.remove('on'); }
}

const AUDIO = {
    tinte: (id) => STATE.engines[id].tinte(),
    start: (id) => STATE.engines[id].startVolley(),
    stop: (id) => STATE.engines[id].stopVolley(),
    stopAll: () => { 
        for(let i=1; i<=4; i++) STATE.engines[i].stopVolley(); 
        ACTIVE_LOOPS.forEach(l => clearTimeout(l)); 
        ACTIVE_LOOPS=[];
        STATE.stopSignal=true; 
        STATE.isChiming=false; 
    }
};

// -----------------------------------------------------------------------------
// 3. SYSTEME & SAUVEGARDE
// -----------------------------------------------------------------------------

async function INIT_SYSTEM() {
    STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const p = []; 
    for(let i=1; i<=4; i++) { 
        STATE.engines[i] = new BellEngine(i); 
        p.push(STATE.engines[i].load()); 
    } 
    
    loadData();
    await Promise.all(p);
    
    const now = new Date(); 
    STATE.manualDateObj = new Date();
    
    if(SETTINGS.clock_mode === "AUTO") {
        SETTINGS.date_d = now.getDate(); SETTINGS.date_m = now.getMonth()+1; SETTINGS.date_y = now.getFullYear();
    } else {
        STATE.manualDateObj = new Date(SETTINGS.date_y, SETTINGS.date_m-1, SETTINGS.date_d, SETTINGS.time_h, SETTINGS.time_m, SETTINGS.time_s);
    }

    setInterval(TICK, 1000);
    UI.render();
}

function saveData() {
    const data = { schedule: SCHEDULE, library: LIBRARY, settings: SETTINGS };
    localStorage.setItem("OPUS_DATA", JSON.stringify(data));
}

function loadData() {
    const json = localStorage.getItem("OPUS_DATA");
    if(json) {
        try {
            const data = JSON.parse(json);
            SCHEDULE = data.schedule || [];
            LIBRARY = data.library || [];
            if(data.settings) {
                // Merge intelligent pour supporter la V22 sur une save V21
                const s = data.settings;
                // Migration Auto V21 -> V22
                if(s.chime_h_on !== undefined) {
                    SETTINGS.auto_h.on = s.chime_h_on; delete s.chime_h_on;
                    SETTINGS.auto_m.on = s.chime_m_on; delete s.chime_m_on;
                    SETTINGS.auto_q.on = s.chime_q_on; delete s.chime_q_on;
                }
                SETTINGS = {...SETTINGS, ...s};
            }
        } catch(e) { console.error("Err chargement", e); }
    }
}

function TICK() {
    let h, m, s, d, mo, y;
    const isEditing = STATE.timeEditor.active;

    if(SETTINGS.clock_mode === "AUTO") { 
        const now = new Date(); 
        h = now.getHours(); m = now.getMinutes(); s = now.getSeconds(); 
        d = now.getDate(); mo = now.getMonth()+1; y = now.getFullYear(); 
    } else { 
        if(!isEditing) { STATE.manualDateObj.setSeconds(STATE.manualDateObj.getSeconds() + 1); } 
        h = STATE.manualDateObj.getHours(); m = STATE.manualDateObj.getMinutes(); s = STATE.manualDateObj.getSeconds(); 
        d = STATE.manualDateObj.getDate(); mo = STATE.manualDateObj.getMonth()+1; y = STATE.manualDateObj.getFullYear(); 
    }

    if(!isEditing) { 
        SETTINGS.time_h=h; SETTINGS.time_m=m; SETTINGS.time_s=s; 
        SETTINGS.date_d=d; SETTINGS.date_m=mo; SETTINGS.date_y=y; 
    }

    const pad = (v)=>String(v).padStart(2,'0'); 
    const dateStr = `${pad(d)}/${pad(mo)}/${y}`;
    const elTime = document.getElementById('lcd-date-time');
    if(elTime) elTime.innerText = `${dateStr} ${pad(h)}:${pad(m)}:${pad(s)}`;

    if(STATE.menuStack[STATE.menuStack.length-1] === "HOME") UI.renderHome(h,m,s, dateStr);
    
    if(!isEditing && !STATE.isChiming && !STATE.stopSignal) { 
        if(s===0 && STATE.audioCtx.state === 'suspended') STATE.audioCtx.resume(); 
        checkAutoChimes(h, m, s);
        checkSchedule(h, m, s, d, mo, y); 
    }
}

// -----------------------------------------------------------------------------
// 4. LOGIQUE AUTOMATISMES & AGENDA
// -----------------------------------------------------------------------------

function isNight(h, m) {
    if (!SETTINGS.night_mode) return false;
    const nowMins = h * 60 + m;
    const startMins = SETTINGS.night_start_h * 60 + SETTINGS.night_start_m;
    const endMins = SETTINGS.night_end_h * 60 + SETTINGS.night_end_m;
    if(startMins < endMins) return (nowMins >= startMins && nowMins < endMins);
    else return (nowMins >= startMins || nowMins < endMins);
}

function checkAutoChimes(h, m, s) {
    if(isNight(h, m)) return;

    // Calcul secondes écoulées depuis le début de l'heure
    const secPastHour = m * 60 + s;

    // --- 1. SONNERIES PRINCIPALES (s=0) ---
    if(s === 0) {
        if(m === 0 && SETTINGS.auto_h.on) playHourlyChime(h);
        else if(m === 30 && SETTINGS.auto_m.on) AUDIO.tinte(1);
        else if((m === 15 || m === 45) && SETTINGS.auto_q.on) AUDIO.tinte(2);
    }

    // --- 2. REPETITIONS (Calcul précis) ---
    
    // Répétition HEURE
    if(SETTINGS.auto_h.rep && SETTINGS.auto_h.on) {
        if(secPastHour === SETTINGS.auto_h.del) playHourlyChime(h);
    }

    // Répétition DEMIE (Base 30m = 1800s)
    if(SETTINGS.auto_m.rep && SETTINGS.auto_m.on) {
        if(secPastHour === (1800 + SETTINGS.auto_m.del)) AUDIO.tinte(1);
    }

    // Répétition QUART (Base 15m=900s, 45m=2700s)
    if(SETTINGS.auto_q.rep && SETTINGS.auto_q.on) {
        if(secPastHour === (900 + SETTINGS.auto_q.del)) AUDIO.tinte(2);
        if(secPastHour === (2700 + SETTINGS.auto_q.del)) AUDIO.tinte(2);
    }
}

async function playHourlyChime(hour) {
    STATE.isChiming = true;
    let count = hour % 12;
    if(count === 0) count = 12;
    
    for(let i=0; i<count; i++) {
        if(STATE.stopSignal) break;
        AUDIO.tinte(1);
        await wait(1500);
    }
    STATE.isChiming = false;
}

function checkSchedule(h, m, s, d, mo, y) {
    if (isNight(h, m)) return;

    const today = new Date(y, mo-1, d); 
    const jsDay = today.getDay(); 
    const frDay = (jsDay + 6) % 7; 

    SCHEDULE.forEach(evt => {
        if(evt.lastRun === `${h}:${m}:${s}:${d}`) return;
        
        if(evt.h === h && evt.m === m && evt.s === s) {
            let run = false;
            if(evt.mode === "AUCUNE") { 
                const [ed, em, ey] = evt.date.split('/').map(Number); 
                if(ed===d && em===mo && ey===y) run = true; 
            } 
            else if(evt.mode === "PERSO") {
                if(evt.repUnit === 4) { // Mois
                    if(evt.repMonthMode === 0) { if(d === evt.repRefDay) run = true; } 
                    else { if(frDay === evt.repRefWeekday && Math.ceil(d/7) === evt.repRefNth) run = true; } 
                } 
                else if(evt.repUnit === 3) { // Semaine
                    if(evt.repDays && evt.repDays.includes(frDay)) run = true; 
                } 
                else run = true; 
            }

            if(run) { 
                evt.lastRun = `${h}:${m}:${s}:${d}`; 
                saveData(); 
                if(evt.progType==="MANU") execComplexManual(evt); 
                else execPreset(evt.name, evt.dur); 
            }
        }
    });
}

// -----------------------------------------------------------------------------
// 5. EXECUTION
// -----------------------------------------------------------------------------

async function execComplexManual(evt) {
    document.getElementById('screen-footer').innerText = "EXE: " + evt.name; 
    STATE.stopSignal = false;
    evt.bellConfig.forEach(conf => {
        const globalDurMs = evt.dur * 1000; 
        const delayMs = (conf.delay||0) * 1000; 
        const cutoffMs = (conf.cutoff || 0) * 1000; 
        const actualDuration = globalDurMs - delayMs - cutoffMs; 
        const cadenceMs = (conf.cadence || 2.0) * 1000; 
        
        if(actualDuration > 0) {
            const timeoutId = setTimeout(() => {
                if(STATE.stopSignal) return;
                if(evt.typeAudio === "VOL") { 
                    AUDIO.start(conf.id); 
                    const stopId = setTimeout(() => { AUDIO.stop(conf.id); ACTIVE_LOOPS=ACTIVE_LOOPS.filter(id=>id!==stopId); }, actualDuration); 
                    ACTIVE_LOOPS.push(stopId); 
                } 
                else { 
                    const endTime = Date.now() + actualDuration; 
                    const strikeLoop = () => { 
                        if(STATE.stopSignal || Date.now() >= endTime) return; 
                        AUDIO.tinte(conf.id); 
                        const nextHit = setTimeout(strikeLoop, cadenceMs); 
                        ACTIVE_LOOPS.push(nextHit); 
                    }; 
                    strikeLoop(); 
                }
                ACTIVE_LOOPS=ACTIVE_LOOPS.filter(id=>id!==timeoutId);
            }, delayMs); 
            ACTIVE_LOOPS.push(timeoutId);
        }
    });
}

async function execPreset(name, customDur) {
    STATE.isChiming = true; 
    document.getElementById('screen-footer').innerText = "EXE: "+name; 
    
    let dur = customDur;
    if(!dur) {
        if(name==="ANGELUS") dur = SETTINGS.dur_angelus;
        else if(name==="MESSE") dur = SETTINGS.dur_messe;
        else if(name==="MARIAGE") dur = SETTINGS.dur_mariage;
        else if(name==="BAPTEME") dur = SETTINGS.dur_bapteme;
        else if(name==="GLAS") dur = SETTINGS.dur_glas;
        else dur = 180;
    }

    if(name === "ANGELUS") {
        const B = 2; 
        for(let s=0; s<3; s++) {
            for(let c=0; c<3; c++) {
                if(STATE.stopSignal) break;
                AUDIO.tinte(B);
                await wait(2000);
            }
            await wait(4000);
        }
        await wait(2000);
        if(!STATE.stopSignal) {
            AUDIO.start(B);
            await wait(dur * 1000);
            AUDIO.stop(B);
        }
    }
    else { 
        for(let id of [1,2,3,4]) { AUDIO.start(id); await wait(1500); } 
        await wait(dur*1000); 
        for(let id=1;id<=4;id++) AUDIO.stop(id); 
    }
    STATE.isChiming = false; 
    document.getElementById('screen-footer').innerText = "PRET.";
}

const wait = (ms) => new Promise(r=>setTimeout(r,ms));

// -----------------------------------------------------------------------------
// 6. UI & STRUCTURE MENUS
// -----------------------------------------------------------------------------

const UI = {
    menus: {
        'HOME': { type: "static" },
        'MAIN': { title: "MENU PRINCIPAL", items: [ { t: "PROGRAMMES", link: "PROGS" }, { t: "AGENDA", link: "AGENDA_VIEW" }, { t: "PARAMETRES", link: "SETTINGS" }, { t: "BIBLIOTHEQUE", link: "LIB_VIEW" } ]},
        'PROGS': { title: "CHOIX PROG", items: [ { t: "ANGELUS", run: "ANGELUS" }, { t: "MESSE", run: "MESSE" }, { t: "MARIAGE", run: "MARIAGE" }, { t: "GLAS", run: "GLAS" } ]},
        
        'SETTINGS': { title: "PARAMETRES", items: [ 
            { t: "HORLOGE SYSTEME", link: "SET_CLOCK" }, 
            { t: "AUTOMATISMES", link: "SET_AUTO" },
            { t: "DUREES PROG.", link: "SET_DUR" },
            { t: "MODE NUIT", link: "SET_NIGHT" } 
        ]},

        'SET_CLOCK': { title: "REGLAGE HORLOGE", items: [ 
            { t: "Mode: " + (SETTINGS.clock_mode||"AUTO"), action: "TOGGLE_CLOCK_MODE" },
            { t: "REGLER HEURE", action: "EDIT_SYS_TIME" },
            { t: "REGLER DATE", action: "EDIT_SYS_DATE" }
        ]},

        // Sous-Menu Principal Automatismes
        'SET_AUTO': { title: "AUTOMATISMES", items: [
            { t: "HEURES >", link: "SET_AUTO_H" },
            { t: "DEMIES >", link: "SET_AUTO_M" },
            { t: "QUARTS >", link: "SET_AUTO_Q" }
        ]},

        // Sous-Menus Détails (Heure/Demie/Quart)
        'SET_AUTO_H': { title: "CONFIG. HEURES", items: [
            { t: "Active: ON", action: "TOG_H_ON" },
            { t: "Repetition: OFF", action: "TOG_H_REP" },
            { t: "Delai Rep: 60s", action: "EDIT_H_DEL" }
        ]},
        'SET_AUTO_M': { title: "CONFIG. DEMIES", items: [
            { t: "Active: ON", action: "TOG_M_ON" },
            { t: "Repetition: OFF", action: "TOG_M_REP" },
            { t: "Delai Rep: 60s", action: "EDIT_M_DEL" }
        ]},
        'SET_AUTO_Q': { title: "CONFIG. QUARTS", items: [
            { t: "Active: OFF", action: "TOG_Q_ON" },
            { t: "Repetition: OFF", action: "TOG_Q_REP" },
            { t: "Delai Rep: 60s", action: "EDIT_Q_DEL" }
        ]},

        'SET_DUR': { title: "DUREES (SEC)", items: [
            { t: "Angelus: " + SETTINGS.dur_angelus, action: "EDIT_DUR_ANG" },
            { t: "Messe: " + SETTINGS.dur_messe, action: "EDIT_DUR_MES" },
            { t: "Mariage: " + SETTINGS.dur_mariage, action: "EDIT_DUR_MAR" },
            { t: "Glas: " + SETTINGS.dur_glas, action: "EDIT_DUR_GLAS" }
        ]},
        
        'SET_NIGHT': { title: "MODE NUIT", items: [
            { t: "Active: " + (SETTINGS.night_mode?"OUI":"NON"), action: "TOG_NIGHT" },
            { t: "Debut: " + pad(SETTINGS.night_start_h)+":"+pad(SETTINGS.night_start_m), action: "EDIT_NIGHT_START" },
            { t: "Fin: " + pad(SETTINGS.night_end_h)+":"+pad(SETTINGS.night_end_m), action: "EDIT_NIGHT_END" }
        ]}
    },

    render: function() {
        const scr = document.getElementById('screen-content');
        
        // --- FULLSCREEN EDITORS (POPUP) ---
        if(STATE.timeEditor.active) {
            const te = STATE.timeEditor;
            let title = "REGLAGE";
            if(te.type==="TIME") title = "REGLAGE HEURE/DELAI";
            if(te.type==="DATE") title = "REGLAGE DATE";
            if(te.type==="INT") title = "VALEUR (SEC)";
            
            let html = `<div class="editor-overlay"><div class="editor-header">${title}</div><div class="time-container">`;
            te.vals.forEach((v, idx) => {
                const isActive = (idx === te.cursor);
                html += `<div class="time-col"><span class="col-label">${te.labels[idx]}</span><span class="time-slot ${isActive?'active':''}">${pad(v)}</span></div>`;
            });
            html += `</div><div class="editor-hint">OK: VALIDER - C: RETOUR</div></div>`;
            scr.innerHTML = html; 
            return;
        }

        const mode = STATE.menuStack[STATE.menuStack.length-1];

        // --- REPETITION EDITOR ---
        if(mode === "REP_EDITOR") {
            const re = STATE.repEditor;
            const c = re.cursor; const isEd = re.isEditing;
            
            let h = `<div class="menu-title">REPETITION</div><div class="rep-screen">`;
            h += `<div class="rep-row ${c===0?'active':''}"><span class="lbl">FREQ:</span><span class="editable ${(c===0&&isEd)?'editing':''}">${re.interval} ${REP_UNITS[re.unitIdx]}</span></div>`;
            
            if(re.unitIdx === 3) {
                let dHtml = `<div class="days-grid">`;
                DAYS_LABELS.forEach((d, i) => {
                    const isF = (c===1 && re.subCursor===i && isEd);
                    dHtml += `<span class="day-char ${re.days.includes(i)?'checked':''} ${isF?'editing':''}">${d}</span>`;
                });
                h += `<div class="rep-row ${c===1?'active':''}"><span class="lbl">JOURS:</span></div>${dHtml}</div>`;
            } else if(re.unitIdx === 4) {
                let txt = (re.monthMode===0) ? `LE ${re.refDay}` : `${re.refNth}eme ${DAYS_LABELS[re.refWeekday]}`;
                h += `<div class="rep-row ${c===1?'active':''}"><span class="lbl">OPT:</span><span class="editable ${(c===1&&isEd)?'editing':''}">${txt}</span></div>`;
            } else { h += `<div class="rep-row" style="opacity:0.3"><span>---</span></div>`; }

            h += `<div class="rep-row ${c===2?'active':''}"><span class="lbl">FIN:</span><span class="editable ${(c===2&&isEd)?'editing':''}">${REP_END_TYPES[re.endTypeIdx]}</span></div>`;
            
            // Ligne Valeur de fin (Date ou Nb Fois)
            let valTxt = "---";
            if(re.endTypeIdx===2) valTxt = re.endVal;
            if(re.endTypeIdx===1) valTxt = `${pad(re.endD)}/${pad(re.endM)}/${re.endY}`;
            
            // Si c'est une DATE, on ne met pas la classe 'editable' car on veut ouvrir le popup, pas éditer inline
            const isDateType = (re.endTypeIdx === 1);
            const valClass = (c===3 && isEd && !isDateType) ? 'editing' : '';
            
            h += `<div class="rep-row ${c===3?'active':''}"><span class="lbl">VAL:</span><span class="editable ${valClass}">${valTxt}</span></div>`;
            h += `</div>`;
            scr.innerHTML = h; return;
        }

        if(mode === "AGENDA_VIEW" || mode === "LIB_VIEW") {
            const list = (mode==="AGENDA_VIEW") ? SCHEDULE : LIBRARY;
            const title = (mode==="AGENDA_VIEW") ? "AGENDA" : "BIBLIOTHEQUE";
            if(mode === "AGENDA_VIEW") list.sort((a,b) => (a.h*60+a.m) - (b.h*60+b.m));
            let h = `<div class="menu-title">${title} (${list.length})</div><div style='overflow-y:auto; height:100%;'>`;
            if(list.length === 0) h += `<div style="text-align:center;color:#666;margin-top:20px;">VIDE</div>`;
            else { list.forEach((e,i) => { h += `<div class="agenda-row ${i===STATE.cursor?'selected':''}"><span>${pad(e.h)}:${pad(e.m)}</span><span>${e.name.substring(0,8)}</span><span>${e.mode==="AUCUNE"?"UNE X":"CYCLE"}</span></div>`; }); }
            h += `</div>`;
            scr.innerHTML = h; return;
        }

        if(mode === "FORM") {
            const f = STATE.formData; const c = STATE.cursor;
            const r = (id, l, v) => `<div class="form-row ${id===c?'selected':''}"><span class="lbl">${l}</span><span class="val">${v}</span></div>`;
            let h = `<div class="menu-title">${STATE.editingIndex>=0 ? "MODIF" : "NOUV."} ${f.progType}</div>`;
            h += `<div style="overflow-y:auto; height:100%;">`;
            h += r(0, "NOM", f.name); h += r(1, "TYPE", f.progType);
            if(f.progType === "PRESET") h += r(2, "PROG", f.presetName);
            else h += r(2, "CLOCHES", f.bells.length ? f.bells.join(' ') : "...");
            h += r(3, "CYCLE", (f.mode==="AUCUNE")?"NON >":"OUI >");
            h += (f.mode==="AUCUNE") ? r(4, "DATE", f.date) : `<div class="form-row" style="opacity:0.3"><span class="lbl">DATE</span><span>---</span></div>`;
            h += r(5, "HEURE", `${pad(f.h)}:${pad(f.m)}:${pad(f.s)}`);
            h += r(6, "DUREE", secToMinSec(f.dur));
            let rowIdx = 7;
            if(f.progType === "MANU") { f.bellConfig.forEach((bc, idx) => { h += `<div style="background:#222;font-size:0.7em;margin-top:5px;padding:2px;">CLOCHE ${bc.id}</div>`; h += r(rowIdx++, "DEC.(+)", secToMinSec(bc.delay||0)); h += r(rowIdx++, "FIN (-)", secToMinSec(bc.cutoff||0)); }); }
            h += `<div class="save-btn-row ${c===rowIdx?'selected':''}">[ ENREGISTRER ]</div>`; rowIdx++;
            if(STATE.editingIndex >= 0 && !STATE.editingLibrary) { h += `<div class="save-btn-row ${c===rowIdx?'selected':''}" style="color:#e74c3c;">[ SUPPRIMER ]</div>`; rowIdx++; h += `<div class="save-btn-row ${c===rowIdx?'selected':''}" style="color:#3498db;">[ > BIBLIO ]</div>`; }
            h += `</div>`;
            scr.innerHTML = h; const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"}); return;
        }

        if(mode === "HOME") return; 

        // --- MENUS DYNAMIQUES ---
        this.updateMenuLabels(mode);
        const m = this.menus[mode];
        let h = `<div class="menu-title">${m.title}</div>`;
        m.items.forEach((it, idx) => h += `<div class="menu-item ${idx===STATE.cursor?'selected':''}"><span>${it.t}</span></div>`);
        scr.innerHTML = h;
    },

    updateMenuLabels: function(mode) {
        if(mode === "SET_CLOCK") {
            this.menus[mode].items[0].t = "Mode: " + SETTINGS.clock_mode;
        }
        // Mise à jour des sous-menus Auto
        const setLbl = (m, idx, prefix, val, suffix="") => { this.menus[m].items[idx].t = prefix + val + suffix; };
        
        if(mode === "SET_AUTO_H") {
            setLbl(mode, 0, "Active: ", SETTINGS.auto_h.on?"ON":"OFF");
            setLbl(mode, 1, "Repetition: ", SETTINGS.auto_h.rep?"ON":"OFF");
            setLbl(mode, 2, "Delai Rep: ", SETTINGS.auto_h.del, "s");
        }
        if(mode === "SET_AUTO_M") {
            setLbl(mode, 0, "Active: ", SETTINGS.auto_m.on?"ON":"OFF");
            setLbl(mode, 1, "Repetition: ", SETTINGS.auto_m.rep?"ON":"OFF");
            setLbl(mode, 2, "Delai Rep: ", SETTINGS.auto_m.del, "s");
        }
        if(mode === "SET_AUTO_Q") {
            setLbl(mode, 0, "Active: ", SETTINGS.auto_q.on?"ON":"OFF");
            setLbl(mode, 1, "Repetition: ", SETTINGS.auto_q.rep?"ON":"OFF");
            setLbl(mode, 2, "Delai Rep: ", SETTINGS.auto_q.del, "s");
        }
        
        if(mode === "SET_DUR") {
            this.menus[mode].items[0].t = "Angelus: " + SETTINGS.dur_angelus + "s";
            this.menus[mode].items[1].t = "Messe: " + SETTINGS.dur_messe + "s";
            this.menus[mode].items[2].t = "Mariage: " + SETTINGS.dur_mariage + "s";
            this.menus[mode].items[3].t = "Glas: " + SETTINGS.dur_glas + "s";
        }
        if(mode === "SET_NIGHT") {
            this.menus[mode].items[0].t = "Active: " + (SETTINGS.night_mode?"OUI":"NON");
            this.menus[mode].items[1].t = "Debut: " + pad(SETTINGS.night_start_h)+":"+pad(SETTINGS.night_start_m);
            this.menus[mode].items[2].t = "Fin: " + pad(SETTINGS.night_end_h)+":"+pad(SETTINGS.night_end_m);
        }
    },

    renderHome: function(h, m, s, dateStr) {
        const modeLabel = (STATE.manualMode === "VOL") ? "MANU: VOLEE" : "MANU: TINT";
        const modeColor = (STATE.manualMode === "VOL") ? "#e74c3c" : "#2ecc71";
        const nightIcon = SETTINGS.night_mode ? "🌙" : "";
        document.getElementById('screen-content').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span style="font-weight:bold; color:${modeColor}; border:1px solid ${modeColor}; padding:2px 5px; border-radius:4px; font-size:0.8rem;">${modeLabel}</span>
                <span>${nightIcon}</span>
            </div>
            <div class="big-clock">${pad(h)}:${pad(m)}:${pad(s)}</div>
            <div style="text-align:center; font-size:0.9rem; color:#888;">${dateStr}</div>
            <div style="text-align:center; margin-top:15px; font-size:0.9rem;">F1:MENU F2:PROG F3:MANU F4:AGENDA</div>
        `;
    }
};

function pad(v) { return String(v).padStart(2,'0'); }
function secToMinSec(sec) { return `${Math.floor(sec/60)}m ${String(sec%60).padStart(2,'0')}s`; }

// -----------------------------------------------------------------------------
// 7. INPUTS
// -----------------------------------------------------------------------------

const SYS = {
    input: function(key) {
        if(STATE.audioCtx.state==='suspended') STATE.audioCtx.resume();
        if(STATE.timeEditor.active) { this.handleTimeEditor(key); return; }

        const mode = STATE.menuStack[STATE.menuStack.length-1];

        // --- EDITOR REPETITION ---
        if(mode === "REP_EDITOR") {
            const re = STATE.repEditor;
            if(re.isEditing) {
                // En mode édition (texte rouge)
                const dir = (key==="RIGHT"?1:(key==="LEFT"?-1:0));
                const val = (key==="UP"?1:(key==="DOWN"?-1:0));
                if(key==="OK") re.isEditing = false;
                else {
                    if(re.cursor===0) { if(dir) re.unitIdx=(re.unitIdx+dir+REP_UNITS.length)%REP_UNITS.length; if(val) re.interval=Math.max(1,re.interval+val); }
                    else if(re.cursor===1) {
                         if(re.unitIdx===3) { if(dir) re.subCursor=(re.subCursor+dir+7)%7; if(val) { const i=re.subCursor, x=re.days.indexOf(i); x>-1?re.days.splice(x,1):re.days.push(i); } }
                         else if(re.unitIdx===4) re.monthMode=(re.monthMode===0)?1:0;
                    }
                    else if(re.cursor===2) { if(dir||val) re.endTypeIdx=(re.endTypeIdx+(dir||val)+REP_END_TYPES.length)%REP_END_TYPES.length; }
                    else if(re.cursor===3) { 
                        // Nb de Fois
                        if(re.endTypeIdx===2) re.endVal+=val; 
                        // Date : On ne fait rien ici avec les flèches, c'est le OK qui trigger le popup
                    }
                }
            } else {
                // Navigation
                if(key==="UP") { re.cursor--; if(re.cursor<0) re.cursor=3; }
                if(key==="DOWN") { re.cursor++; if(re.cursor>3) re.cursor=0; }
                if(key==="OK") {
                    // Cas Spécial : Si curseur sur VALEUR (idx 3) et Type = DATE (idx 1) -> POPUP
                    if(re.cursor === 3 && re.endTypeIdx === 1) {
                        openUnifiedEditor("REP_END_DATE", "DATE", [re.endD, re.endM, re.endY], ["J","M","A"]);
                    } else {
                        re.isEditing = true;
                    }
                }
                if(key==="C") { saveRepEditor(); STATE.menuStack.pop(); }
            }
            UI.render(); return;
        }

        if(key === "C") {
            if(mode === "HOME") { STATE.manualMode = (STATE.manualMode==="TINT")?"VOL":"TINT"; UI.render(); return; }
            if(mode === "FORM") { STATE.menuStack.pop(); return UI.render(); }
            STATE.menuStack.pop(); if(!STATE.menuStack.length) STATE.menuStack=["HOME"];
            STATE.cursor=0; UI.render(); return;
        }

        // --- FORMULAIRE ---
        if(mode === "FORM") {
            const f = STATE.formData;
            let maxRows = 7;
            if(f.progType==="MANU") maxRows += (f.bellConfig.length*2);
            let btnSaveIdx = maxRows;
            let btnDelIdx = -1, btnLibIdx = -1;
            
            if(STATE.editingIndex >= 0 && !STATE.editingLibrary) {
                btnDelIdx = maxRows + 1;
                btnLibIdx = maxRows + 2;
                maxRows += 2;
            }

            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=maxRows; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>maxRows) STATE.cursor=0; }
            
            const dir = (key==="RIGHT"?1:(key==="LEFT"?-1:0));
            if(dir!==0) {
                 if(STATE.cursor===1) f.progType = (f.progType==="MANU"?"PRESET":"MANU");
                 if(STATE.cursor===2 && f.progType==="PRESET") { 
                     let idx = PRESET_NAMES.indexOf(f.presetName); 
                     f.presetName = PRESET_NAMES[(idx+dir+PRESET_NAMES.length)%PRESET_NAMES.length]; 
                 }
                 if(STATE.cursor===3) f.mode = (f.mode==="AUCUNE")?"PERSO":"AUCUNE";
                 if(STATE.cursor===6) f.dur = Math.max(1, f.dur+(dir*5));
            }

            if(key==="OK") {
                if(STATE.cursor===0) { const n = prompt("Nom:", f.name); if(n) f.name = n; }
                else if(STATE.cursor===3 && f.mode==="PERSO") { openRepEditor(); STATE.menuStack.push("REP_EDITOR"); }
                else if(STATE.cursor===4 && f.mode==="AUCUNE") { const [d,m,y] = f.date.split('/'); openUnifiedEditor("PROG_DATE", "DATE", [d,m,y], ["J","M","A"]); }
                else if(STATE.cursor===5) openUnifiedEditor("START", "TIME", [f.h, f.m, f.s], ["H","M","S"]);
                
                else if(STATE.cursor===btnSaveIdx) { saveForm(); }
                else if(STATE.cursor===btnDelIdx) { if(confirm("Supprimer ?")) { SCHEDULE.splice(STATE.editingIndex, 1); saveData(); STATE.menuStack.pop(); } }
                else if(STATE.cursor===btnLibIdx) { LIBRARY.push(JSON.parse(JSON.stringify(f))); saveData(); alert("Ajouté à la Biblio"); }
                
                else if(STATE.cursor > 6 && STATE.cursor < btnSaveIdx) {
                     const rel = STATE.cursor - 7; const bIdx = Math.floor(rel/2); const t = (rel%2===0)?"DELAY":"CUTOFF";
                     const val = (t==="DELAY") ? f.bellConfig[bIdx].delay : f.bellConfig[bIdx].cutoff;
                     openUnifiedEditor("BELL_"+t+"_"+bIdx, "TIME", [0, Math.floor(val/60), val%60], ["-","M","S"]);
                }
            }
        }
        
        // --- MENUS ACTIONS ---
        else if(mode !== "HOME" && mode !== "AGENDA_VIEW" && mode !== "LIB_VIEW") {
            const m = UI.menus[mode];
            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=m.items.length-1; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>=m.items.length) STATE.cursor=0; }
            if(key==="OK" || key==="RIGHT") {
                const it = m.items[STATE.cursor];
                if(it.link) { STATE.menuStack.push(it.link); STATE.cursor=0; }
                else if(it.run) { execPreset(it.run); STATE.menuStack=["HOME"]; }
                
                else if(it.action === "EDIT_SYS_TIME") openUnifiedEditor("SYS_TIME", "TIME", [SETTINGS.time_h, SETTINGS.time_m, SETTINGS.time_s], ["H","M","S"]);
                else if(it.action === "EDIT_SYS_DATE") openUnifiedEditor("SYS_DATE", "DATE", [SETTINGS.date_d, SETTINGS.date_m, SETTINGS.date_y], ["J","M","A"]);
                else if(it.action === "TOGGLE_CLOCK_MODE") { SETTINGS.clock_mode=(SETTINGS.clock_mode==="AUTO"?"MANU":"AUTO"); saveData(); }
                
                // Actions Auto V22
                else if(it.action === "TOG_H_ON") { SETTINGS.auto_h.on=!SETTINGS.auto_h.on; saveData(); }
                else if(it.action === "TOG_H_REP") { SETTINGS.auto_h.rep=!SETTINGS.auto_h.rep; saveData(); }
                else if(it.action === "EDIT_H_DEL") openUnifiedEditor("DEL_H", "TIME", [0, Math.floor(SETTINGS.auto_h.del/60), SETTINGS.auto_h.del%60], ["-","M","S"]);
                
                else if(it.action === "TOG_M_ON") { SETTINGS.auto_m.on=!SETTINGS.auto_m.on; saveData(); }
                else if(it.action === "TOG_M_REP") { SETTINGS.auto_m.rep=!SETTINGS.auto_m.rep; saveData(); }
                else if(it.action === "EDIT_M_DEL") openUnifiedEditor("DEL_M", "TIME", [0, Math.floor(SETTINGS.auto_m.del/60), SETTINGS.auto_m.del%60], ["-","M","S"]);
                
                else if(it.action === "TOG_Q_ON") { SETTINGS.auto_q.on=!SETTINGS.auto_q.on; saveData(); }
                else if(it.action === "TOG_Q_REP") { SETTINGS.auto_q.rep=!SETTINGS.auto_q.rep; saveData(); }
                else if(it.action === "EDIT_Q_DEL") openUnifiedEditor("DEL_Q", "TIME", [0, Math.floor(SETTINGS.auto_q.del/60), SETTINGS.auto_q.del%60], ["-","M","S"]);

                else if(it.action === "EDIT_DUR_ANG") openUnifiedEditor("DUR_ANG", "INT", [SETTINGS.dur_angelus], ["SEC"]);
                else if(it.action === "EDIT_DUR_MES") openUnifiedEditor("DUR_MES", "INT", [SETTINGS.dur_messe], ["SEC"]);
                else if(it.action === "EDIT_DUR_MAR") openUnifiedEditor("DUR_MAR", "INT", [SETTINGS.dur_mariage], ["SEC"]);
                else if(it.action === "EDIT_DUR_GLAS") openUnifiedEditor("DUR_GLAS", "INT", [SETTINGS.dur_glas], ["SEC"]);
                
                else if(it.action === "TOG_NIGHT") { SETTINGS.night_mode=!SETTINGS.night_mode; saveData(); }
                else if(it.action === "EDIT_NIGHT_START") openUnifiedEditor("NIGHT_S", "TIME", [SETTINGS.night_start_h, SETTINGS.night_start_m, 0], ["H","M","-"]);
                else if(it.action === "EDIT_NIGHT_END") openUnifiedEditor("NIGHT_E", "TIME", [SETTINGS.night_end_h, SETTINGS.night_end_m, 0], ["H","M","-"]);
            }
        }
        
        else if(mode === "AGENDA_VIEW" || mode === "LIB_VIEW") {
             const list = (mode==="AGENDA_VIEW") ? SCHEDULE : LIBRARY;
             if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=Math.max(0,list.length-1); }
             if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>=list.length) STATE.cursor=0; }
             if(key==="OK" && list.length) { 
                 loadEventToForm(list[STATE.cursor], (mode==="AGENDA_VIEW"?STATE.cursor:-1)); 
                 if(mode==="LIB_VIEW") STATE.editingLibrary = true; 
                 STATE.menuStack.push("FORM"); STATE.cursor=0; 
             }
        }
        
        else if(key==="OK") this.fKey(1);
        UI.render();
    },

    fKey: function(n) {
        STATE.editMode = false; STATE.cursor = 0; STATE.timeEditor.active = false;
        if(n===1) STATE.menuStack=["MAIN"];
        if(n===2) { loadEventToForm({type:"PRESET", progType:"PRESET", name:"MESSE", presetName:"MESSE", bells:[1,2,3], dur:SETTINGS.dur_messe, mode:"AUCUNE", date: getCurrentDateStr(), h:9, m:30, s:0}, -1); STATE.menuStack=["FORM"]; }
        if(n===3) { 
            const d = new Date(); 
            loadEventToForm({type:"MANUAL", progType:"MANU", name:"MANU", bells:[], bellConfig: [], dur:60, mode:"AUCUNE", date: getCurrentDateStr(), h:d.getHours(), m:d.getMinutes(), s:0}, -1);
            STATE.menuStack=["FORM"];
        }
        if(n===4) STATE.menuStack=["AGENDA_VIEW"];
        UI.render();
    },
    
    manualDirect: function(n) {
        const mode = STATE.menuStack[STATE.menuStack.length-1];
        if(mode === "FORM") {
            const f = STATE.formData;
            if(f.progType === "MANU") {
                const idx = f.bells.indexOf(n);
                if(idx > -1) {
                    f.bells.splice(idx, 1);
                    const cIdx = f.bellConfig.findIndex(b=>b.id===n);
                    if(cIdx>-1) f.bellConfig.splice(cIdx, 1);
                } else {
                    f.bells.push(n); f.bells.sort();
                    f.bellConfig.push({ id: n, delay: 0, cutoff: 0 }); f.bellConfig.sort((a,b)=>a.id-b.id);
                }
                UI.render(); return;
            }
        }
        if (STATE.manualMode === "TINT") AUDIO.tinte(n);
        else { const eng = STATE.engines[n]; if (eng.isSwinging) AUDIO.stop(n); else AUDIO.start(n); }
    },

    stopAll: () => AUDIO.stopAll(),
    
    handleTimeEditor: function(key) {
        const te = STATE.timeEditor; const max = te.vals.length - 1;
        if(key==="LEFT") { te.cursor--; if(te.cursor<0) te.cursor=max; }
        if(key==="RIGHT") { te.cursor++; if(te.cursor>max) te.cursor=0; }
        const dir = (key==="UP"?1:(key==="DOWN"?-1:0));
        if(dir!==0) {
            te.vals[te.cursor] += dir;
            if(te.type!=="DATE" && te.cursor<3 && te.type!=="INT") { 
                if(te.vals[0]>23)te.vals[0]=(te.vals[0]+24)%24; 
                if(te.vals[te.cursor]>59) te.vals[te.cursor]=(te.vals[te.cursor]+60)%60; 
            }
        }
        if(key==="OK") { 
            const f = STATE.formData;
            if(te.targetField==="START") { f.h=te.vals[0]; f.m=te.vals[1]; f.s=te.vals[2]; }
            if(te.targetField==="PROG_DATE") { f.date = `${pad(te.vals[0])}/${pad(te.vals[1])}/${te.vals[2]}`; }
            if(te.targetField.startsWith("BELL_")) {
                const p = te.targetField.split("_"); const idx = parseInt(p[2]);
                const secs = (te.vals[1]*60) + te.vals[2];
                if(p[1]==="DELAY") f.bellConfig[idx].delay = secs; else f.bellConfig[idx].cutoff = secs;
            }
            if(te.targetField==="SYS_TIME") { 
                SETTINGS.time_h=te.vals[0]; SETTINGS.time_m=te.vals[1]; SETTINGS.time_s=te.vals[2];
                STATE.manualDateObj.setHours(te.vals[0], te.vals[1], te.vals[2]); saveData();
            }
            if(te.targetField==="SYS_DATE") { 
                SETTINGS.date_d=te.vals[0]; SETTINGS.date_m=te.vals[1]; SETTINGS.date_y=te.vals[2];
                STATE.manualDateObj.setFullYear(te.vals[2], te.vals[1]-1, te.vals[0]); saveData();
            }
            
            // --- RETOUR PARAMETRES DELAI REPETITION (V22) ---
            const saveDel = (obj) => { 
                // Conversion M:S en secondes
                let secs = (te.vals[1]*60) + te.vals[2]; 
                if(secs < 30) { alert("Securité: Minimum 30s"); secs = 30; }
                obj.del = secs; 
                saveData(); 
            };
            if(te.targetField==="DEL_H") saveDel(SETTINGS.auto_h);
            if(te.targetField==="DEL_M") saveDel(SETTINGS.auto_m);
            if(te.targetField==="DEL_Q") saveDel(SETTINGS.auto_q);

            // --- RETOUR DATE REPETITION (V22) ---
            if(te.targetField==="REP_END_DATE") {
                STATE.repEditor.endD = te.vals[0];
                STATE.repEditor.endM = te.vals[1];
                STATE.repEditor.endY = te.vals[2];
            }

            if(te.targetField==="DUR_ANG") SETTINGS.dur_angelus = te.vals[0];
            if(te.targetField==="DUR_MES") SETTINGS.dur_messe = te.vals[0];
            if(te.targetField==="DUR_MAR") SETTINGS.dur_mariage = te.vals[0];
            if(te.targetField==="DUR_GLAS") SETTINGS.dur_glas = te.vals[0];
            if(te.targetField==="NIGHT_S") { SETTINGS.night_start_h=te.vals[0]; SETTINGS.night_start_m=te.vals[1]; }
            if(te.targetField==="NIGHT_E") { SETTINGS.night_end_h=te.vals[0]; SETTINGS.night_end_m=te.vals[1]; }
            
            saveData();
            te.active=false; 
        }
        if(key==="C") te.active=false;
        UI.render();
    }
};

// -----------------------------------------------------------------------------
// 8. HELPERS
// -----------------------------------------------------------------------------

function openUnifiedEditor(target, type, vals, labels) { 
    STATE.timeEditor = { active: true, targetField: target, type: type, vals: vals.map(Number), labels: labels, cursor: 0 }; 
    UI.render(); 
}

function loadEventToForm(evt, index) { 
    STATE.editingIndex = index; 
    STATE.editingLibrary = false;
    STATE.formData = JSON.parse(JSON.stringify(evt)); 
    if(!STATE.formData.bells) STATE.formData.bells=[]; 
    if(!STATE.formData.bellConfig) STATE.formData.bellConfig=[]; 
}

function openRepEditor() { 
    const f = STATE.formData; 
    STATE.repEditor.interval = f.repInterval||1; 
    STATE.repEditor.unitIdx = f.repUnit||3; 
    STATE.repEditor.days = f.repDays||[0]; 
    STATE.repEditor.endTypeIdx = f.repEndType||0; 
    STATE.repEditor.endVal = f.repEndVal||10; 
    STATE.repEditor.endD = f.repEndD||1; 
    STATE.repEditor.endM = f.repEndM||1; 
    STATE.repEditor.endY = f.repEndY||2025; 
    STATE.repEditor.cursor = 0; 
    STATE.repEditor.isEditing = false; 
    
    const [d,m,y] = f.date.split('/').map(Number);
    STATE.repEditor.refDay = d;
    STATE.repEditor.refNth = Math.ceil(d / 7);
    const dateObj = new Date(y, m-1, d);
    STATE.repEditor.refWeekday = (dateObj.getDay() + 6) % 7; 
    STATE.repEditor.monthMode = f.repMonthMode || 0;
}

function saveRepEditor() { 
    const f = STATE.formData; const re = STATE.repEditor; 
    f.repInterval = re.interval; f.repUnit = re.unitIdx; f.repDays = [...re.days]; 
    f.repEndType = re.endTypeIdx; f.repEndVal = re.endVal; 
    f.repEndD = re.endD; f.repEndM = re.endM; f.repEndY = re.endY; 
    f.repMonthMode = re.monthMode;
    f.repRefDay = re.refDay; f.repRefNth = re.refNth; f.repRefWeekday = re.refWeekday;
}

function getCurrentDateStr() { 
    return `${pad(SETTINGS.date_d)}/${pad(SETTINGS.date_m)}/${SETTINGS.date_y}`; 
}

function saveForm() { 
    const f = STATE.formData; 
    let progDate; 
    if(f.mode === "AUCUNE") { 
        const [d,m,y] = f.date.split('/').map(Number); 
        progDate = new Date(y, m-1, d, f.h, f.m, f.s); 
    } else { 
        progDate = new Date(SETTINGS.date_y, SETTINGS.date_m-1, SETTINGS.date_d, f.h, f.m, f.s); 
        if(progDate < STATE.manualDateObj) progDate.setDate(progDate.getDate()+1); 
    } 
    
    if(f.mode === "AUCUNE" && progDate < STATE.manualDateObj) alert("Note: Date passée !"); 
    
    if(STATE.editingIndex < 0 || STATE.editingLibrary) { 
        let suffix = 1; let base = f.name; 
        while(SCHEDULE.some(e=>e.name === base + " " + suffix)) suffix++; 
        f.name = base + " " + suffix; 
        f.id = Date.now();
        SCHEDULE.push(f); 
    } else { 
        SCHEDULE[STATE.editingIndex] = f; 
    }
    
    saveData();
    STATE.menuStack=["HOME"]; STATE.cursor=0; 
    alert("Enregistré !"); 
}