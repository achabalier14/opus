// =============================================================================
// MAIN.JS - MOTEUR V103 (COMPLET AVEC BOUCLES & PARALLELISME)
// =============================================================================

async function INIT_SYSTEM() {
    STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const p = []; 
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

    STATE.isChiming = false;
    STATE.stopSignal = false;
    STATE.lockedBells = [false, false, false, false, false, false];

    setInterval(TICK, 1000);
    UI.render();
}

function saveData() {
    const data = { schedule: SCHEDULE, library: LIBRARY, settings: SETTINGS, presets: PRESET_CONFIGS };
    localStorage.setItem("OPUS_DATA", JSON.stringify(data));
}

function loadData() {
    const json = localStorage.getItem("OPUS_DATA");
    if(json) {
        try {
            const data = JSON.parse(json);
            SCHEDULE = data.schedule || [];
            LIBRARY = data.library || [];
            if(data.presets) PRESET_CONFIGS = {...PRESET_CONFIGS, ...data.presets};

            if(data.settings) {
                const s = data.settings;
                // Initialisation Timelines si absentes
                if(!s.timelines) s.timelines = {};
                
                // Migration des anciens presets vers le format Timeline
                const stdProgs = ["MESSE", "MARIAGE", "BAPTEME", "PLENUM"];
                stdProgs.forEach(prog => {
                    if(!s.timelines[prog] && PRESET_CONFIGS[prog]) {
                        let dur = s["dur_" + prog.toLowerCase()] || 180;
                        let blkConfig = {};
                        for(let i=1; i<=5; i++) { blkConfig[i] = {...PRESET_CONFIGS[prog][i]}; }
                        s.timelines[prog] = [{
                            type: "VOL",
                            duration: dur,
                            mode: "TIME",
                            repeat: 1,
                            volConfig: blkConfig,
                            parallel: false
                        }];
                    }
                });

                // Assurer la compatibilité des champs
                for(let key in s.timelines) {
                    s.timelines[key].forEach(blk => {
                        if(!blk.type) blk.type = "SEQ"; 
                        if(blk.type === "VOL" && !blk.volConfig) {
                            blk.volConfig = {1:{active:false},2:{active:false},3:{active:false},4:{active:false},5:{active:false}};
                        }
                        if(typeof blk.parallel === 'undefined') blk.parallel = false; 
                        if(!blk.mode) blk.mode = "TIME";
                        if(typeof blk.repeat === 'undefined') blk.repeat = 1;
                    });
                }

                SETTINGS = {...SETTINGS, ...s};
                if(!SETTINGS.angelus_times) { 
                    SETTINGS.angelus_times = [{h:8,m:3,s:0}, {h:12,m:3,s:0}, {h:19,m:3,s:0}]; 
                }
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

    const elTimeSmall = document.getElementById('lcd-date-time');
    if(elTimeSmall) elTimeSmall.innerText = `${getHeaderDateStr()} ${pad(h)}:${pad(m)}:${pad(s)}`;
    
    const btnUrg = document.querySelector('.urgency-btn-phys');
    if(btnUrg) {
        if(SETTINGS.emergency_mode) btnUrg.classList.add('active'); 
        else btnUrg.classList.remove('active');
    }

    if(STATE.menuStack[STATE.menuStack.length-1] === "HOME") {
        UI.renderHome(h,m,s, getHomeDateStr());
    }
    
    if(SETTINGS.emergency_mode) return;

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

    SETTINGS.angelus_times.forEach(ang => {
        if(h === ang.h && m === ang.m && s === ang.s) {
            if(STATE.isChiming) AUDIO.stopAll(); 
            setTimeout(() => execPreset("ANGELUS"), 200);
        }
    });

    if(STATE.isChiming) return;

    if(s === 0) {
        if(m === 0 && SETTINGS.auto_h.on) playHourlyChime(h);
        else if(m === 30 && SETTINGS.auto_m.on) playHalfHourChime();
        else if((m === 15 || m === 45) && SETTINGS.auto_q.on) AUDIO.tinte(3);
    }

    if(SETTINGS.auto_h.rep && SETTINGS.auto_h.on && secPastHour === SETTINGS.auto_h.del) playHourlyChime(h);
    if(SETTINGS.auto_m.rep && SETTINGS.auto_m.on && secPastHour === (1800 + SETTINGS.auto_m.del)) playHalfHourChime();
    if(SETTINGS.auto_q.rep && SETTINGS.auto_q.on && (secPastHour === (900 + SETTINGS.auto_q.del) || secPastHour === (2700 + SETTINGS.auto_q.del))) AUDIO.tinte(3);
}

async function playHourlyChime(hour) {
    if(STATE.isChiming) return; 
    STATE.isChiming = true; STATE.stopSignal = false; 
    let count = hour % 12; if(count === 0) count = 12;
    const interval = (SETTINGS.auto_h.int || 2.25) * 1000;
    for(let i=0; i<count; i++) { if(STATE.stopSignal) break; AUDIO.tinte(2); await wait(interval); }
    STATE.isChiming = false;
}

async function playHalfHourChime() {
    if(STATE.isChiming) return;
    STATE.isChiming = true; STATE.stopSignal = false;
    if(!STATE.stopSignal) AUDIO.tinte(3); await wait(750); 
    if(!STATE.stopSignal) AUDIO.tinte(2); 
    STATE.isChiming = false;
}

function checkSchedule(h, m, s, d, mo, y) {
    if (isNight(h, m)) return;

    const frDay = (new Date(y, mo-1, d).getDay() + 6) % 7; 
    let toRemove = [];

    SCHEDULE.forEach((evt, idx) => {
        if(evt.mode === "AUCUNE") {
            const [ed, em, ey] = evt.date.split('/').map(Number);
            const evtDate = new Date(ey, em-1, ed, evt.h, evt.m, evt.s);
            const now = new Date(y, mo-1, d, h, m, s);
            if(evtDate < now && (now - evtDate) > 5000) { toRemove.push(idx); return; }
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
                if(STATE.isChiming) return; 
                if(evt.progType==="MANU") execComplexManual(evt); 
                else {
                    const configName = (evt.progType === "PRESET" && evt.presetName) ? evt.presetName : evt.name;
                    execPreset(configName); 
                }
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
    STATE.isChiming = true; STATE.stopSignal = false; 
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
                } else { 
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
    
    setTimeout(() => { STATE.isChiming = false; document.getElementById('screen-footer').innerText = "PRET."; }, evt.dur * 1000 + 2000);
}


// =========================================================================
// MOTEUR D'EXECUTION UNIFIÉ (TIMELINE MIXTE & PARALLELE)
// =========================================================================
async function execPreset(name) {
    if(STATE.isChiming) return; 
    STATE.isChiming = true; 
    STATE.stopSignal = false; 
    STATE.lockedBells = [false, false, false, false, false, false]; 
    document.getElementById('screen-footer').innerText = "EXE: " + name; 
    
    let timeline = SETTINGS.timelines[name];
    if(!timeline || timeline.length === 0) {
        if(name === "ANGELUS") {
            const B=2;
            for(let s=0; s<3; s++) { 
               for(let c=0; c<3; c++) { if(STATE.stopSignal) break; AUDIO.tinte(B); await wait(2000); } 
               if(STATE.stopSignal) break; await wait(4000); 
            }
        }
        STATE.isChiming = false; 
        document.getElementById('screen-footer').innerText = "PRET.";
        return;
    }

    const runningPromises = [];

    for(let b = 0; b < timeline.length; b++) {
        if(STATE.stopSignal) break;

        const block = timeline[b];
        const isLastBlock = (b === timeline.length - 1);
        const isParallel = block.parallel === true;

        const blockPromise = runBlock(block, isLastBlock, b, timeline.length, name);
        runningPromises.push(blockPromise);

        if (!isParallel) {
            await blockPromise;
        } else {
            await wait(100);
        }
    }

    await Promise.all(runningPromises);

    STATE.lockedBells = [false, false, false, false, false, false];
    AUDIO.stopAll();
    STATE.isChiming = false; 
    document.getElementById('screen-footer').innerText = "PRET.";
}

async function runBlock(block, isLastBlock, index, total, pName) {
    const isLoopMode = (block.mode === "LOOP");
    const repeatCount = (block.repeat || 1);
    
    // Si c'est le dernier bloc, on boucle si mode Loop ou si durée 0 (infini)
    let isInfinite = isLastBlock && !isLoopMode && (block.duration === 0);
    
    const startTime = Date.now();
    const durationMs = (block.duration || 0) * 1000;
    const endTime = startTime + durationMs;

    document.getElementById('screen-footer').innerText = `EXE: ${pName} [${index+1}/${total}]`;

    if(block.type === "VOL") {
        // Volée : toujours basée sur la durée pour l'instant
        let effectiveDuration = isInfinite ? 999999 : block.duration;
        await runDynamicVolley(block.volConfig, effectiveDuration, isInfinite);
    }
    else {
        // SEQUENCE TINTÉE (SEQ)
        if(!block.steps || block.steps.length === 0) { await wait(1000); return; }

        if(isLoopMode) {
            // MODE REPETITION (BOUCLE)
            for(let loop=0; loop < repeatCount; loop++) {
                if(STATE.stopSignal) break;
                
                for(let step of block.steps) {
                    if(STATE.stopSignal) break;
                    if(!STATE.lockedBells[step.bell]) {
                        AUDIO.tinte(step.bell);
                    }
                    await wait(step.wait * 1000);
                }
            }
        } else {
            // MODE DUREE (TEMPS)
            while(!STATE.stopSignal) {
                if(!isInfinite && Date.now() >= endTime) break;

                for(let step of block.steps) {
                    if(STATE.stopSignal) break;
                    if(!isInfinite && Date.now() >= endTime) break;

                    if(!STATE.lockedBells[step.bell]) {
                        AUDIO.tinte(step.bell);
                    }
                    await wait(step.wait * 1000);
                }
                if(!STATE.stopSignal) await wait(50);
                if(!isInfinite && Date.now() >= endTime) break;
            }
        }
    }
}

function runDynamicVolley(config, duration, isInfinite) {
    return new Promise((resolve) => {
        if(!config) { resolve(); return; }

        const loops = [];
        const globalDurMs = duration * 1000;
        const bellsUsed = [];
        
        for(let i=1; i<=5; i++) {
            const bellConf = config[i];
            if(bellConf && bellConf.active) {
                if(STATE.lockedBells[i]) {
                    console.log("Cloche " + i + " occupée !");
                    continue; 
                }
                
                STATE.lockedBells[i] = true;
                bellsUsed.push(i);

                const delayMs = (bellConf.delay || 0) * 1000;
                const cutoffMs = (bellConf.cutoff || 0) * 1000;
                
                let myDuration = -1;
                if(!isInfinite) {
                    myDuration = globalDurMs - delayMs - cutoffMs;
                    if(myDuration <= 0) {
                        STATE.lockedBells[i] = false;
                        continue; 
                    }
                }

                const startTimer = setTimeout(() => {
                    if(STATE.stopSignal) return;
                    AUDIO.start(i);
                    
                    if(myDuration > 0) {
                        const stopTimer = setTimeout(() => {
                            AUDIO.stop(i);
                        }, myDuration);
                        loops.push(stopTimer);
                        ACTIVE_LOOPS.push(stopTimer);
                    }

                }, delayMs);
                loops.push(startTimer);
                ACTIVE_LOOPS.push(startTimer);
            }
        }
        
        const checkInterval = setInterval(() => {
            if(STATE.stopSignal) {
                loops.forEach(id => clearTimeout(id));
                bellsUsed.forEach(b => { AUDIO.stop(b); STATE.lockedBells[b] = false; });
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);

        if(!isInfinite) {
            setTimeout(() => {
                clearInterval(checkInterval);
                bellsUsed.forEach(b => { AUDIO.stop(b); STATE.lockedBells[b] = false; });
                resolve(); 
            }, globalDurMs + 2500); 
        }
    });
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
        const originalName = f.name.trim(); 
        const nameExists = (n) => SCHEDULE.some(e => e.name === n);
        if(nameExists(originalName)) {
            let suffix = 1;
            while(nameExists(originalName + " " + suffix)) { suffix++; }
            f.name = originalName + " " + suffix;
        }
        f.id = Date.now();
        SCHEDULE.push(f); 
    } else { 
        SCHEDULE[STATE.editingIndex] = f; 
    }
    
    saveData();
    STATE.menuStack=["HOME"]; STATE.cursor=0; 
    alert("Enregistré !"); 
}