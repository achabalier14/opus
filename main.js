// =============================================================================
// MAIN.JS - LOGIQUE PRINCIPALE (V73 - FIX BLOCAGE HORAIRE)
// =============================================================================

async function INIT_SYSTEM() {
    STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const p = []; 
    // On charge les 5 cloches
    for(let i=1; i<=5; i++) { 
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

    // Reset des états au démarrage pour éviter le blocage
    STATE.isChiming = false;
    STATE.stopSignal = false;

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
                const s = data.settings;
                SETTINGS = {...SETTINGS, ...s};
                
                if(!SETTINGS.angelus_times) { 
                    SETTINGS.angelus_times = [{h:8,m:3,s:0}, {h:12,m:3,s:0}, {h:19,m:3,s:0}]; 
                } else {
                    SETTINGS.angelus_times.forEach(ang => {
                        if((ang.h === 8 || ang.h === 12 || ang.h === 19) && ang.m === 0) { ang.m = 3; }
                    });
                }
                if(SETTINGS.auto_h.int === undefined) SETTINGS.auto_h.int = 2.25;
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

    const dateStr = `${pad(d)}/${pad(mo)}/${y}`;
    const elTimeSmall = document.getElementById('lcd-date-time');
    if(elTimeSmall) elTimeSmall.innerText = `${getHeaderDateStr()} ${pad(h)}:${pad(m)}:${pad(s)}`;
    
    // GESTION LED URGENCE
    const btnUrg = document.querySelector('.urgency-btn-phys');
    if(btnUrg) {
        if(SETTINGS.emergency_mode) btnUrg.classList.add('active'); 
        else btnUrg.classList.remove('active');
    }

    if(STATE.menuStack[STATE.menuStack.length-1] === "HOME") {
        UI.renderHome(h,m,s, getHomeDateStr());
    }
    
    // --- SECURITE URGENCE ---
    if(SETTINGS.emergency_mode) return;

    // --- COEUR DU SYSTEME ---
    // MODIFICATION IMPORTANTE : On ne bloque plus le TICK si isChiming est vrai.
    // On vérifie quand même les horaires. Les fonctions de sonnerie géreront les conflits.
    if(!isEditing) { 
        if(s===0 && STATE.audioCtx && STATE.audioCtx.state === 'suspended') STATE.audioCtx.resume(); 
        
        checkAutoChimes(h, m, s);
        checkSchedule(h, m, s, d, mo, y); 
    }
}

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
    const secPastHour = m * 60 + s;

    // ANGELUS (Prioritaire)
    SETTINGS.angelus_times.forEach(ang => {
        if(h === ang.h && m === ang.m && s === ang.s) {
            // On force l'arrêt de ce qui pourrait être en cours pour lancer l'Angelus
            if(STATE.isChiming) AUDIO.stopAll(); 
            setTimeout(() => execPreset("ANGELUS", SETTINGS.dur_angelus), 200);
        }
    });

    // Si on sonne déjà (ex: Angelus en cours), on ne lance pas les heures par dessus
    if(STATE.isChiming) return;

    // HEURES / DEMIES / QUARTS
    if(s === 0) {
        if(m === 0 && SETTINGS.auto_h.on) playHourlyChime(h);
        else if(m === 30 && SETTINGS.auto_m.on) playHalfHourChime();
        else if((m === 15 || m === 45) && SETTINGS.auto_q.on) AUDIO.tinte(3);
    }

    // REPETITIONS
    if(SETTINGS.auto_h.rep && SETTINGS.auto_h.on && secPastHour === SETTINGS.auto_h.del) playHourlyChime(h);
    if(SETTINGS.auto_m.rep && SETTINGS.auto_m.on && secPastHour === (1800 + SETTINGS.auto_m.del)) playHalfHourChime();
    if(SETTINGS.auto_q.rep && SETTINGS.auto_q.on && (secPastHour === (900 + SETTINGS.auto_q.del) || secPastHour === (2700 + SETTINGS.auto_q.del))) AUDIO.tinte(3);
}

async function playHourlyChime(hour) {
    if(STATE.isChiming) return; // Sécurité doublon
    STATE.isChiming = true;
    STATE.stopSignal = false; 
    
    let count = hour % 12;
    if(count === 0) count = 12;
    const interval = (SETTINGS.auto_h.int || 2.25) * 1000;
    
    for(let i=0; i<count; i++) {
        if(STATE.stopSignal) break;
        AUDIO.tinte(2); // Utilise la cloche 2 pour l'heure
        await wait(interval); 
    }
    STATE.isChiming = false;
}

async function playHalfHourChime() {
    if(STATE.isChiming) return;
    STATE.isChiming = true;
    STATE.stopSignal = false;
    
    if(!STATE.stopSignal) AUDIO.tinte(3); 
    await wait(750); 
    if(!STATE.stopSignal) AUDIO.tinte(2); 
    
    STATE.isChiming = false;
}

function checkSchedule(h, m, s, d, mo, y) {
    if (isNight(h, m)) return;

    const frDay = (new Date(y, mo-1, d).getDay() + 6) % 7; 
    let toRemove = [];

    SCHEDULE.forEach((evt, idx) => {
        // Nettoyage vieux événements "date unique"
        if(evt.mode === "AUCUNE") {
            const [ed, em, ey] = evt.date.split('/').map(Number);
            const evtDate = new Date(ey, em-1, ed, evt.h, evt.m, evt.s);
            const now = new Date(y, mo-1, d, h, m, s);
            if(evtDate < now && (now - evtDate) > 5000) { 
                toRemove.push(idx);
                return;
            }
        }

        if(evt.lastRun === `${h}:${m}:${s}:${d}`) return;
        
        if(evt.h === h && evt.m === m && evt.s === s) {
            let run = false;
            if(evt.mode === "AUCUNE") { 
                const [ed, em, ey] = evt.date.split('/').map(Number); 
                if(ed===d && em===mo && ey===y) run = true; 
            } 
            else if(evt.mode === "PERSO") {
                if(evt.repUnit === 4) { 
                    if(evt.repMonthMode === 0) { if(d === evt.repRefDay) run = true; } 
                    else { if(frDay === evt.repRefWeekday && Math.ceil(d/7) === evt.repRefNth) run = true; } 
                } 
                else if(evt.repUnit === 3) { if(evt.repDays && evt.repDays.includes(frDay)) run = true; } 
                else run = true; 
            }

            if(run) { 
                evt.lastRun = `${h}:${m}:${s}:${d}`; 
                saveData(); 
                
                // Si une sonnerie est déjà en cours (sauf si c'est un Angelus qui a priorité), on ne lance pas le prog
                if(STATE.isChiming) return; 

                if(evt.progType==="MANU") execComplexManual(evt); 
                else execPreset(evt.name, evt.dur); 
            }
        }
    });

    if(toRemove.length > 0) {
        for(let i = toRemove.length - 1; i >= 0; i--) { SCHEDULE.splice(toRemove[i], 1); }
        saveData();
    }
}

async function execComplexManual(evt) {
    if(STATE.isChiming) return;
    STATE.isChiming = true;
    STATE.stopSignal = false; 
    document.getElementById('screen-footer').innerText = "EXE: " + evt.name; 

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
    
    setTimeout(() => { STATE.isChiming = false; document.getElementById('screen-footer').innerText = "PRET."; }, evt.dur * 1000);
}

async function execPreset(name, customDur) {
    if(STATE.isChiming && name !== "ANGELUS") return; // L'Angelus a le droit d'écraser
    
    STATE.isChiming = true; 
    STATE.stopSignal = false; 
    document.getElementById('screen-footer').innerText = "EXE: "+name; 
    
    let dur = customDur;
    if(!dur) {
        if(name==="ANGELUS") dur = SETTINGS.dur_angelus;
        else if(name==="MESSE") dur = SETTINGS.dur_messe;
        else if(name==="MARIAGE") dur = SETTINGS.dur_mariage;
        else if(name==="BAPTEME") dur = SETTINGS.dur_bapteme;
        else if(name==="GLAS" || name==="GLAS_H" || name==="GLAS_F") dur = SETTINGS.dur_glas;
        else if(name==="PLENUM") dur = SETTINGS.dur_plenum;
        else if(name==="TE_DEUM") dur = SETTINGS.dur_tedeum;
        else if(name==="TOCSIN") dur = SETTINGS.dur_tocsin;
        else dur = 180;
    }

    if(name === "ANGELUS") {
        const B = 2; // Cloche de l'Angelus
        // 3x3 coups
        for(let s=0; s<3; s++) { 
            for(let c=0; c<3; c++) { 
                if(STATE.stopSignal) break; 
                AUDIO.tinte(B); await wait(2000); 
            } 
            if(STATE.stopSignal) break; 
            await wait(4000); 
        }
        await wait(2000); 
        // Volée
        if(!STATE.stopSignal) { 
            AUDIO.start(B); await wait(dur * 1000); AUDIO.stop(B); 
        }
    }
    else if(name === "TE_DEUM") {
        const endTime = Date.now() + (dur * 1000);
        while(Date.now() < endTime && !STATE.stopSignal) {
            AUDIO.tinte(1); await wait(800); AUDIO.tinte(3); await wait(800); AUDIO.tinte(4); await wait(800); AUDIO.tinte(2); await wait(1200);
        }
    }
    else if(name === "TOCSIN") {
        const endTime = Date.now() + (dur * 1000);
        while(Date.now() < endTime && !STATE.stopSignal) { AUDIO.tinte(2); await wait(200); AUDIO.tinte(3); await wait(250); }
    }
    else if(name === "GLAS" || name === "GLAS_H") {
        const endTime = Date.now() + (dur * 1000);
        while(Date.now() < endTime && !STATE.stopSignal) { AUDIO.tinte(1); await wait(4000); if(name === "GLAS_H") { AUDIO.tinte(1); await wait(4000); AUDIO.tinte(1); await wait(8000); } }
    }
    else if(name === "GLAS_F") {
        const endTime = Date.now() + (dur * 1000);
        while(Date.now() < endTime && !STATE.stopSignal) { AUDIO.tinte(2); await wait(3000); AUDIO.tinte(2); await wait(7000); }
    }
    else if(name === "BAPTEME") {
        for(let id of [2,3,4]) { if(STATE.stopSignal) break; AUDIO.start(id); await wait(1000); } 
        if(!STATE.stopSignal) await wait(dur*1000); 
        for(let id of [2,3,4]) AUDIO.stop(id);
    }
    else { 
        // PLENUM (Toutes les cloches dispos)
        for(let id of [1,2,3,4,5]) { 
            if(id <= 5) { // On lance les cloches valides
                if(STATE.stopSignal) break; 
                AUDIO.start(id); await wait(1500); 
            }
        } 
        if(!STATE.stopSignal) await wait(dur*1000); 
        for(let id=1;id<=5;id++) AUDIO.stop(id); 
    }
    
    STATE.isChiming = false; 
    document.getElementById('screen-footer').innerText = "PRET.";
}

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