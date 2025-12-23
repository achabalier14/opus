// =============================================================================
// UI.JS - AFFICHAGE ET ENTREES (V57)
// =============================================================================

const UI = {
    // ... (Menus et autres inchangés) ...
    // Je remets juste la partie FORM pour être sûr que la cloche 5 apparaisse
    
    menus: {
        'HOME': { type: "static" },
        'MAIN': { title: "MENU PRINCIPAL", items: [ { t: "➕ PROGRAMMES", link: "PROGS" }, { t: "📅 AGENDA", link: "AGENDA_VIEW" }, { t: "⚙️ PARAMETRES", link: "SETTINGS" }, { t: "📚 BIBLIOTHEQUE", link: "LIB_VIEW" } ]},
        'PROGS': { title: "CHOIX PROG", items: [ { t: "🔔 ANGELUS", run: "ANGELUS" }, { t: "⛪ MESSE", run: "MESSE" }, { t: "💍 MARIAGE", run: "MARIAGE" }, { t: "👶 BAPTEME", run: "BAPTEME" }, { t: "🎉 PLENUM (FETES)", run: "PLENUM" }, { t: "⚰️ GLAS (STD)", run: "GLAS" }, { t: "👨 GLAS (HOMME)", run: "GLAS_H" }, { t: "👩 GLAS (FEMME)", run: "GLAS_F" }, { t: "🎶 TE DEUM", run: "TE_DEUM" }, { t: "🔥 TOCSIN (ALERTE)", run: "TOCSIN" } ]},
        'SETTINGS': { title: "PARAMETRES", items: [ { t: "🕒 HORLOGE SYSTEME", link: "SET_CLOCK" }, { t: "🤖 AUTOMATISMES", link: "SET_AUTO" }, { t: "⏳ DUREES PROG.", link: "SET_DUR" }, { t: "🌙 MODE NUIT", link: "SET_NIGHT" } ]},
        'SET_CLOCK': { title: "REGLAGE HORLOGE", items: [ { t: "Mode: ", action: "TOGGLE_CLOCK_MODE" }, { t: "REGLER HEURE", action: "EDIT_SYS_TIME" }, { t: "REGLER DATE", action: "EDIT_SYS_DATE" } ]},
        'SET_AUTO': { title: "AUTOMATISMES", items: [ { t: "🔔 SONNERIE HORAIRE >", link: "SET_AUTO_CHIME" }, { t: "⛪ ANGELUS >", link: "ANG_LIST" } ]},
        'SET_AUTO_CHIME': { title: "SONNERIE HORAIRE", items: [ { t: "HEURES >", link: "SET_AUTO_H" }, { t: "DEMIES >", link: "SET_AUTO_M" }, { t: "QUARTS >", link: "SET_AUTO_Q" } ]},
        'SET_AUTO_H': { title: "CONFIG. HEURES", items: [ { t: "Active: ", action: "TOG_H_ON" }, { t: "Repetition: ", action: "TOG_H_REP" }, { t: "Delai Rep: ", action: "EDIT_H_DEL" }, { t: "Intervalle: ", action: "EDIT_H_INT" } ]},
        'SET_AUTO_M': { title: "CONFIG. DEMIES", items: [ { t: "Active: ", action: "TOG_M_ON" }, { t: "Repetition: ", action: "TOG_M_REP" }, { t: "Delai Rep: ", action: "EDIT_M_DEL" } ]},
        'SET_AUTO_Q': { title: "CONFIG. QUARTS", items: [ { t: "Active: ", action: "TOG_Q_ON" }, { t: "Repetition: ", action: "TOG_Q_REP" }, { t: "Delai Rep: ", action: "EDIT_Q_DEL" } ]},
        'SET_DUR': { title: "DUREES PAR DEFAUT", items: [ { t: "Angelus: ", action: "EDIT_D_ANG" }, { t: "Messe: ", action: "EDIT_D_MES" }, { t: "Mariage: ", action: "EDIT_D_MAR" }, { t: "Plenum: ", action: "EDIT_D_PLENUM" }, { t: "Bapteme: ", action: "EDIT_D_BAPTEME" }, { t: "Glas: ", action: "EDIT_D_GLAS" }, { t: "Te Deum: ", action: "EDIT_D_TEDEUM" }, { t: "Tocsin: ", action: "EDIT_D_TOCSIN" } ]},
        'SET_NIGHT': { title: "MODE NUIT", items: [ { t: "Active: ", action: "TOG_NIGHT" }, { t: "Debut: ", action: "EDIT_NIGHT_START" }, { t: "Fin: ", action: "EDIT_NIGHT_END" } ]}
    },

    showError: function(msg) {
        const scr = document.getElementById('screen-content');
        const oldContent = scr.innerHTML;
        scr.innerHTML = `<div class="error-msg">⚠️ ERREUR ⚠️<br><br>${msg}</div>`;
        STATE.timeEditor.blockInput = true;
        setTimeout(() => { scr.innerHTML = oldContent; STATE.timeEditor.blockInput = false; }, 2000);
    },

    toggleEmergency: function() {
        SETTINGS.emergency_mode = !SETTINGS.emergency_mode;
        if(SETTINGS.emergency_mode) { SYS.stopAll(); } else { STATE.stopSignal = false; STATE.isChiming = false; AUDIO.stopAll(); }
        saveData(); UI.render();
    },

    render: function() {
        const btnUrg = document.querySelector('.urgency-btn-phys');
        const banner = document.getElementById('alert-banner');
        if(btnUrg && banner) {
            if(SETTINGS.emergency_mode) { btnUrg.classList.add('active'); banner.style.display = 'block'; } 
            else { btnUrg.classList.remove('active'); banner.style.display = 'none'; }
        }

        const scr = document.getElementById('screen-content');
        if(STATE.timeEditor.active) {
            const te = STATE.timeEditor;
            let title = "REGLAGE";
            if(te.type==="TIME") title = "VALEUR (H:M:S)";
            if(te.type==="DATE") title = "REGLAGE DATE";
            if(te.type==="INT") title = "VALEUR (SEC)";
            if(te.type==="DECIMAL") title = "INTERVALLE (SEC)";
            let html = `<div class="editor-overlay"><div class="editor-header">${title}</div><div class="time-container">`;
            te.vals.forEach((v, idx) => { 
                const valDisplay = (te.type === "DECIMAL") ? v.toFixed(2) : pad(v);
                html += `<div class="time-col"><span class="col-label">${te.labels[idx]}</span><span class="time-slot ${idx===te.cursor?'active':''}">${valDisplay}</span></div>`; 
            });
            html += `</div><div class="editor-hint">OK: VALIDER - C: RETOUR</div></div>`;
            scr.innerHTML = html; return;
        }

        const mode = STATE.menuStack[STATE.menuStack.length-1];

        if(mode === "HOME") { this.renderHome(SETTINGS.time_h, SETTINGS.time_m, SETTINGS.time_s, getHomeDateStr()); return; }

        if(mode === "AGENDA_VIEW" || mode === "LIB_VIEW") {
            const list = (mode==="AGENDA_VIEW") ? SCHEDULE : LIBRARY; const title = (mode==="AGENDA_VIEW") ? "AGENDA" : "BIBLIOTHEQUE";
            if(mode === "AGENDA_VIEW") list.sort((a,b) => (a.h*60+a.m) - (b.h*60+b.m));
            let h = `<div class="menu-title">${title} (${list.length})</div>`;
            if(list.length === 0) h += `<div style="text-align:center;color:#fff;margin-top:20px;opacity:0.7;">VIDE</div>`;
            else { list.forEach((e,i) => { let txt = (mode==="AGENDA_VIEW") ? `<span>${pad(e.h)}:${pad(e.m)}</span> <span>${e.name}</span>` : `<span>${e.name}</span>`; h += `<div class="agenda-row ${i===STATE.cursor?'selected':''}" style="justify-content:flex-start; gap:10px;">${txt}</div>`; }); }
            scr.innerHTML = h; const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"}); return;
        }

        if(mode === "ANG_LIST") {
            let h = `<div class="menu-title">ANGELUS (${SETTINGS.angelus_times.length})</div>`;
            h += `<div style='overflow-y:auto; height:100%;'>`;
            SETTINGS.angelus_times.sort((a,b) => (a.h*60+a.m) - (b.h*60+b.m));
            SETTINGS.angelus_times.forEach((a, i) => { h += `<div class="agenda-row ${i===STATE.cursor?'selected':''}"><span>${pad(a.h)}:${pad(a.m)}:${pad(a.s)}</span></div>`; });
            let addIdx = SETTINGS.angelus_times.length;
            h += `<div class="save-btn-row ${STATE.cursor===addIdx?'selected':''}" style="margin-top:10px;">[ AJOUTER ANGELUS ]</div>`;
            h += `</div>`;
            scr.innerHTML = h; const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"}); return;
        }

        if(mode === "ANG_FORM") {
            const isNew = (STATE.editingAngelusIdx === -1);
            let h = `<div class="menu-title">${isNew ? "NOUVEL ANGELUS" : "MODIF. ANGELUS"}</div>`;
            const ta = STATE.tempAngelus;
            h += `<div class="form-row ${STATE.cursor===0?'selected':''}"><span class="lbl">HORAIRE</span><span class="val">${pad(ta.h)}:${pad(ta.m)}:${pad(ta.s)}</span></div>`;
            h += `<div class="save-btn-row ${STATE.cursor===1?'selected':''}">[ ENREGISTRER ]</div>`;
            if(!isNew) { h += `<div class="save-btn-row ${STATE.cursor===2?'selected':''}" style="color:#ff6b6b;">[ SUPPRIMER ]</div>`; }
            scr.innerHTML = h; return;
        }

        if(mode === "FORM") {
            const f = STATE.formData; const c = STATE.cursor;
            const r = (id, l, v) => `<div class="form-row ${id===c?'selected':''}"><span class="lbl">${l}</span><span class="val">${v}</span></div>`;
            let title = (STATE.editingIndex >= 0) ? "MODIFICATION" : "NOUVEAU";
            if(STATE.editingLibrary) title = "BIBLIOTHEQUE";
            let h = `<div class="menu-title">${title}</div>`;
            h += r(0, "NOM", f.name); h += r(1, "TYPE", f.progType);
            if(f.progType === "PRESET") { h += r(2, "PROG", f.presetName); } 
            else {
                let audioMode = (f.typeAudio === "VOL") ? "VOLÉE" : "TINTEMENT";
                h += r(2, "MODE SONNERIE", audioMode);
                let bellsHtml = "";
                // MODIF: [1..5]
                [1,2,3,4,5].forEach(b => {
                    const isActive = f.bells.includes(b); const isFocused = (c === 3 && STATE.bellCursor === b); 
                    let classes = "day-char"; if(isActive) classes += " checked"; if(isFocused) classes += " focused";
                    bellsHtml += `<span class="${classes}">${b}</span>`;
                });
                h += `<div class="form-row ${c===3?'selected':''}"><span class="lbl">CLOCHES</span><div class="days-grid">${bellsHtml}</div></div>`;
            }
            let idxOffset = (f.progType === "MANU") ? 1 : 0;
            h += r(3 + idxOffset, "CYCLE", (f.mode==="AUCUNE") ? "NON" : "OUI >");
            h += r(4 + idxOffset, "DATE", f.date);
            h += r(5 + idxOffset, "HEURE", `${pad(f.h)}:${pad(f.m)}:${pad(f.s)}`);
            h += r(6 + idxOffset, "DUREE", secToMinSec(f.dur));
            let rowIdx = 7 + idxOffset;
            if(f.progType === "MANU") {
                f.bellConfig.forEach((bc, idx) => {
                    h += `<div style="background:rgba(0,0,0,0.3);font-size:0.7em;margin-top:5px;padding:2px;">CLOCHE ${bc.id}</div>`;
                    h += r(rowIdx++, "DEC. DÉBUT", secToMinSec(bc.delay||0));
                    h += r(rowIdx++, "DEC. FIN", secToMinSec(bc.cutoff||0));
                    if(f.typeAudio === "TINT") { h += r(rowIdx++, "CADENCE (S)", parseFloat((bc.cadence||2)).toFixed(2) + "s"); }
                });
            }
            if(STATE.editingLibrary) {
                h += `<div class="save-btn-row ${c===rowIdx?'selected':''}">[ IMPORTER DS AGENDA ]</div>`; rowIdx++;
                h += `<div class="save-btn-row ${c===rowIdx?'selected':''}" style="color:#ff6b6b;">[ SUPPRIMER DE BIBLIO ]</div>`;
            } else {
                h += `<div class="save-btn-row ${c===rowIdx?'selected':''}">[ ENREGISTRER ]</div>`; rowIdx++;
                if(STATE.editingIndex >= 0) { h += `<div class="save-btn-row ${c===rowIdx?'selected':''}" style="color:#ff6b6b;">[ SUPPRIMER ]</div>`; rowIdx++; }
                h += `<div class="save-btn-row ${c===rowIdx?'selected':''}" style="color:#4dabf7;">[ SAUVER EN BIBLIO ]</div>`;
            }
            scr.innerHTML = h; const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"}); return;
        }

        // ... (Le reste est standard, copie de V53) ...
        // Je colle la fin pour être sûr :
        
        if(mode === "REP_EDITOR") {
            const re = STATE.repEditor; const c = re.cursor; const isEd = re.isEditing;
            let h = `<div class="menu-title">REPETITION</div><div class="rep-screen">`;
            h += `<div class="rep-row ${c===0?'active':''}"><span class="lbl">FREQ:</span><span class="editable ${(c===0&&isEd)?'editing':''}">${re.interval} ${REP_UNITS[re.unitIdx]}</span></div>`;
            if(re.unitIdx === 3) {
                let dHtml = `<div class="days-grid">`;
                DAYS_LABELS.forEach((d, i) => { const isF=(c===1 && re.subCursor===i && isEd); dHtml += `<span class="day-char ${re.days.includes(i)?'checked':''} ${isF?'focused':''}">${d.charAt(0)}</span>`; });
                h += `<div class="rep-row ${c===1?'active':''}"><span class="lbl">JOURS:</span></div>${dHtml}</div>`;
            } else if(re.unitIdx === 4) {
                let txt = (re.monthMode===0) ? `LE ${re.refDay}` : `${re.refNth}e ${DAYS_LABELS[re.refWeekday]}`;
                h += `<div class="rep-row ${c===1?'active':''}"><span class="lbl">OPT:</span><span class="editable ${(c===1&&isEd)?'editing':''}">${txt}</span></div>`;
            } else { h += `<div class="rep-row" style="opacity:0.3"><span>---</span></div>`; }
            h += `<div class="rep-row ${c===2?'active':''}"><span class="lbl">FIN:</span><span class="editable ${(c===2&&isEd)?'editing':''}">${REP_END_TYPES[re.endTypeIdx]}</span></div>`;
            let valTxt = (re.endTypeIdx===2)?re.endVal:(re.endTypeIdx===1?`${pad(re.endD)}/${pad(re.endM)}/${re.endY}`:"---");
            const valClass = (c===3 && isEd && re.endTypeIdx!==1) ? 'editing' : '';
            h += `<div class="rep-row ${c===3?'active':''}"><span class="lbl">VAL:</span><span class="editable ${valClass}">${valTxt}</span></div></div>`;
            scr.innerHTML = h; return;
        }

        this.updateMenuLabels(mode);
        const m = this.menus[mode];
        let h = `<div class="menu-title">${m.title}</div>`;
        m.items.forEach((it, idx) => h += `<div class="menu-item ${idx===STATE.cursor?'selected':''}"><span>${it.t}</span></div>`);
        scr.innerHTML = h;
        const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"});
    },

    updateMenuLabels: function(mode) {
        if(mode==="SET_CLOCK") this.menus[mode].items[0].t = "Mode: " + SETTINGS.clock_mode;
        const setLbl = (m, i, p, v, s="") => { this.menus[m].items[i].t = p + v; };
        if(mode==="SET_AUTO_H") { 
            setLbl(mode,0,"Active: ",SETTINGS.auto_h.on?"ON":"OFF"); 
            setLbl(mode,1,"Repetition: ",SETTINGS.auto_h.rep?"ON":"OFF"); 
            setLbl(mode,2,"Delai Rep: ", secToMinSec(SETTINGS.auto_h.del)); 
            setLbl(mode,3,"Intervalle: ", parseFloat(SETTINGS.auto_h.int||2.25).toFixed(2)+"s");
        }
        if(mode==="SET_AUTO_M") { setLbl(mode,0,"Active: ",SETTINGS.auto_m.on?"ON":"OFF"); setLbl(mode,1,"Repetition: ",SETTINGS.auto_m.rep?"ON":"OFF"); setLbl(mode,2,"Delai Rep: ", secToMinSec(SETTINGS.auto_m.del)); }
        if(mode==="SET_AUTO_Q") { setLbl(mode,0,"Active: ",SETTINGS.auto_q.on?"ON":"OFF"); setLbl(mode,1,"Repetition: ",SETTINGS.auto_q.rep?"ON":"OFF"); setLbl(mode,2,"Delai Rep: ", secToMinSec(SETTINGS.auto_q.del)); }
        if(mode==="SET_DUR") { 
            const d = (s) => secToMinSec(s);
            setLbl(mode,0,"Angelus: ",d(SETTINGS.dur_angelus)); setLbl(mode,1,"Messe: ",d(SETTINGS.dur_messe)); setLbl(mode,2,"Mariage: ",d(SETTINGS.dur_mariage)); setLbl(mode,3,"Plenum: ",d(SETTINGS.dur_plenum));
            setLbl(mode,4,"Bapteme: ",d(SETTINGS.dur_bapteme)); setLbl(mode,5,"Glas: ",d(SETTINGS.dur_glas)); setLbl(mode,6,"Te Deum: ",d(SETTINGS.dur_tedeum)); setLbl(mode,7,"Tocsin: ",d(SETTINGS.dur_tocsin));
        }
        if(mode==="SET_NIGHT") { this.menus[mode].items[0].t="Active: "+(SETTINGS.night_mode?"OUI":"NON"); this.menus[mode].items[1].t="Debut: "+pad(SETTINGS.night_start_h)+":"+pad(SETTINGS.night_start_m); this.menus[mode].items[2].t="Fin: "+pad(SETTINGS.night_end_h)+":"+pad(SETTINGS.night_end_m); }
    },

    renderHome: function(h, m, s, dateStr) {
        const modeTxt = (STATE.manualMode === "VOL") ? "VOLÉE" : "TINT";
        let nextProgTxt = "";
        
        if(!SETTINGS.emergency_mode) {
            const nowMins = h * 60 + m;
            let scheduleItems = SCHEDULE.map(e => ({ name: e.name, h: e.h, m: e.m, mins: e.h * 60 + e.m, isAngelus: false })).filter(e => e.mins > nowMins);
            SETTINGS.angelus_times.forEach(ang => { 
                const mins = ang.h * 60 + ang.m;
                if(mins > nowMins) scheduleItems.push({ name: "ANGELUS", h: ang.h, m: ang.m, mins: mins, isAngelus: true }); 
            });
            scheduleItems.sort((a,b) => a.mins - b.mins);
            if(scheduleItems.length > 0) nextProgTxt = `PROCH: ${pad(scheduleItems[0].h)}:${pad(scheduleItems[0].m)} ${scheduleItems[0].name}`;
            else {
                let earliestH=8, earliestM=3, name="ANGELUS";
                if(SETTINGS.angelus_times.length) {
                     const f = [...SETTINGS.angelus_times].sort((a,b)=>(a.h*60+a.m)-(b.h*60+b.m))[0];
                     earliestH=f.h; earliestM=f.m;
                }
                nextProgTxt = `DEMAIN: ${pad(earliestH)}:${pad(earliestM)} ${name}`;
            }
        }

        document.getElementById('screen-content').innerHTML = `
            <div class="home-container">
                <div class="big-clock">${pad(h)}:${pad(m)}:${pad(s)}</div>
                <div class="date-display">${dateStr}</div>
                <div class="home-footer">
                    <div class="mode-indicator">${modeTxt}</div>
                    <div class="next-prog" style="${SETTINGS.emergency_mode ? 'color:red' : ''}">${nextProgTxt}</div>
                </div>
            </div>
        `;
        const header = document.getElementById('lcd-date-time');
        if(header) header.innerText = `${getHeaderDateStr()} ${pad(h)}:${pad(m)}:${pad(s)}`;
    },

    manualDirect: (n) => SYS.manualDirect(n),
    stopAll: () => SYS.stopAll(),
    fKey: (n) => SYS.fKey(n),
    input: (key) => SYS.input(key)
};

const SYS = {
    manualDirect: function(n) {
        if(SETTINGS.emergency_mode) return;

        if(STATE.menuStack[STATE.menuStack.length-1] === "FORM" && STATE.formData.progType === "MANU") {
            const f = STATE.formData; const idx = f.bells.indexOf(n);
            if(idx > -1) { 
                f.bells.splice(idx, 1); const cIdx = f.bellConfig.findIndex(b=>b.id===n); if(cIdx>-1) f.bellConfig.splice(cIdx, 1); 
            } else { 
                f.bells.push(n); f.bells.sort(); f.bellConfig.push({ id: n, delay: 0, cutoff: 0, cadence: 2.0 }); f.bellConfig.sort((a,b)=>a.id-b.id); 
            }
            UI.render(); return;
        }
        if (STATE.manualMode === "TINT") AUDIO.tinte(n); else { const eng = STATE.engines[n]; if (eng.isSwinging) AUDIO.stop(n); else AUDIO.start(n); }
    },
    stopAll: () => AUDIO.stopAll(),
    fKey: function(n) {
        STATE.editingIndex = -1; STATE.cursor = 0; STATE.timeEditor.active = false;
        if(n===1) STATE.menuStack=["MAIN"];
        if(n===2) { loadEventToForm({type:"PRESET", progType:"PRESET", name:"MESSE", presetName:"MESSE", bells:[1,2,3], dur:SETTINGS.dur_messe, mode:"AUCUNE", date: getCurrentDateStr(), h:9, m:30, s:0}, -1); STATE.menuStack=["FORM"]; }
        if(n===3) { 
            const d = new Date(); let count = 1;
            const nameExists = (c) => SCHEDULE.some(e => e.name === `Sonnerie manuelle ${c}`) || LIBRARY.some(e => e.name === `Sonnerie manuelle ${c}`);
            while(nameExists(count)) { count++; }
            loadEventToForm({type:"MANUAL", progType:"MANU", name:`Sonnerie manuelle ${count}`, typeAudio: "VOL", bells:[], bellConfig: [], dur:60, mode:"AUCUNE", date: getCurrentDateStr(), h:d.getHours(), m:d.getMinutes(), s:0}, -1); 
            STATE.menuStack=["FORM"]; 
        }
        if(n===4) STATE.menuStack=["AGENDA_VIEW"];
        UI.render();
    },
    input: function(key) {
        if(STATE.audioCtx && STATE.audioCtx.state==='suspended') STATE.audioCtx.resume();
        if(STATE.timeEditor.blockInput) return;
        if(STATE.timeEditor.active) { this.handleTimeEditor(key); return; }
        const mode = STATE.menuStack[STATE.menuStack.length-1];
        
        if(key === "C") { if(mode==="HOME"){ STATE.manualMode = (STATE.manualMode==="TINT")?"VOL":"TINT"; UI.render(); return; } STATE.menuStack.pop(); if(!STATE.menuStack.length) STATE.menuStack=["HOME"]; STATE.cursor=0; UI.render(); return; }

        if(mode === "ANG_FORM") {
            const isNew = (STATE.editingAngelusIdx === -1); const max = isNew ? 1 : 2;
            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=max; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>max) STATE.cursor=0; }
            if(key==="OK") {
                if(STATE.cursor === 0) { const t = STATE.tempAngelus; openUnifiedEditor("EDIT_ANG_TIME", "TIME", [t.h, t.m, t.s], ["H","M","S"]); } 
                else if(STATE.cursor === 1) { 
                    const t = STATE.tempAngelus; const sec = t.m * 60 + t.s;
                    if(SETTINGS.auto_h.on && t.m === 0 && t.s < 30) { UI.showError("CONFLIT: SONNERIE HORAIRE !"); return; }
                    if(SETTINGS.auto_h.on && SETTINGS.auto_h.rep) { const r = SETTINGS.auto_h.del; if(sec >= r && sec < r+30) { UI.showError("CONFLIT REPETITION !"); return; } }
                    if(isNew) SETTINGS.angelus_times.push({...t}); else SETTINGS.angelus_times[STATE.editingAngelusIdx] = {...t};
                    saveData(); STATE.menuStack.pop(); STATE.cursor=0;
                } else if(STATE.cursor === 2 && !isNew) { if(confirm("Supprimer ?")) { SETTINGS.angelus_times.splice(STATE.editingAngelusIdx, 1); saveData(); STATE.menuStack.pop(); STATE.cursor=0; } }
            }
            UI.render(); return;
        }

        if(mode === "ANG_LIST") {
            const len = SETTINGS.angelus_times.length;
            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=len; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>len) STATE.cursor=0; }
            if(key==="OK") {
                if(STATE.cursor === len) { STATE.editingAngelusIdx = -1; STATE.tempAngelus = {h:12, m:3, s:0}; STATE.menuStack.push("ANG_FORM"); STATE.cursor=0; } 
                else { STATE.editingAngelusIdx = STATE.cursor; STATE.tempAngelus = {...SETTINGS.angelus_times[STATE.cursor]}; STATE.menuStack.push("ANG_FORM"); STATE.cursor=0; }
            }
            UI.render(); return;
        }

        if(mode === "FORM") {
            const f = STATE.formData; let maxRows = 7; let idxOffset = (f.progType==="MANU") ? 1 : 0; maxRows += idxOffset;
            if(f.progType==="MANU") maxRows += (f.bellConfig.length * (f.typeAudio === "TINT" ? 3 : 2));
            let btnSaveIdx = maxRows; let btnDelIdx = (STATE.editingIndex>=0 || STATE.editingLibrary) ? maxRows+1 : -1; let btnLibIdx = (STATE.editingLibrary)?-1:(STATE.editingIndex>=0?maxRows+2:maxRows+1);
            let totalRows = (STATE.editingLibrary)?maxRows+1:(STATE.editingIndex>=0?maxRows+2:maxRows+1);

            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=totalRows; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>totalRows) STATE.cursor=0; }
            const dir = (key==="RIGHT"?1:(key==="LEFT"?-1:0));
            if(dir!==0 && STATE.cursor <= 6) {
                 if(STATE.cursor===1) { f.progType = (f.progType==="MANU"?"PRESET":"MANU"); if(f.progType === "PRESET") f.presetName = "MESSE"; }
                 if(STATE.cursor===2) { if(f.progType==="PRESET") { let idx = PRESET_NAMES.indexOf(f.presetName); f.presetName = PRESET_NAMES[(idx+dir+PRESET_NAMES.length)%PRESET_NAMES.length]; } else { f.typeAudio = (f.typeAudio==="VOL") ? "TINT" : "VOL"; } }
                 if(f.progType === "MANU" && STATE.cursor===3) { STATE.bellCursor = (STATE.bellCursor+dir+3)%4+1; }
                 if(STATE.cursor===(3+idxOffset)) f.mode = (f.mode==="AUCUNE")?"PERSO":"AUCUNE";
            }
            if(key==="OK") {
                if(STATE.cursor===0) { const n = prompt("Nom:", f.name); if(n) f.name = n; }
                else if(STATE.cursor===(3+idxOffset)) { if(f.mode==="PERSO") { openRepEditor(); STATE.menuStack.push("REP_EDITOR"); } }
                else if(STATE.cursor===(4+idxOffset)) { const [d,m,y] = f.date.split('/'); openUnifiedEditor("PROG_DATE", "DATE", [d,m,y], ["J","M","A"]); }
                else if(STATE.cursor===(5+idxOffset)) openUnifiedEditor("START", "TIME", [f.h, f.m, f.s], ["H","M","S"]);
                else if(STATE.cursor===(6+idxOffset)) { let h = Math.floor(f.dur/3600), m = Math.floor((f.dur%3600)/60), s = f.dur%60; openUnifiedEditor("PROG_DUR", "TIME", [h, m, s], ["H","M","S"]); }
                else if(f.progType==="MANU" && STATE.cursor===3) { SYS.manualDirect(STATE.bellCursor); }
                else if(STATE.cursor >= (7+idxOffset) && STATE.cursor < btnSaveIdx) { 
                    const rel = STATE.cursor-(7+idxOffset); let step = (f.typeAudio === "TINT") ? 3 : 2; const bIdx = Math.floor(rel/step); const sub = rel%step;
                    if(sub===2) openUnifiedEditor("B_CAD_"+bIdx, "DECIMAL", [f.bellConfig[bIdx].cadence], ["SEC"]);
                    else openUnifiedEditor("B_"+(sub===0?"DEL":"CUT")+"_"+bIdx, "TIME", [0, Math.floor((sub===0?f.bellConfig[bIdx].delay:f.bellConfig[bIdx].cutoff)/60), (sub===0?f.bellConfig[bIdx].delay:f.bellConfig[bIdx].cutoff)%60], ["H","M","S"]);
                } else {
                    if(STATE.cursor === btnSaveIdx) saveForm();
                    else if(STATE.cursor === btnDelIdx) { if(confirm("Supprimer ?")) { if(STATE.editingLibrary) LIBRARY.splice(STATE.editingIndex,1); else SCHEDULE.splice(STATE.editingIndex, 1); saveData(); STATE.menuStack.pop(); } }
                    else if(STATE.cursor === btnLibIdx) { LIBRARY.push(JSON.parse(JSON.stringify(f))); saveData(); alert("Ajouté à la Biblio"); }
                }
            }
        } 
        
        else if(mode === "REP_EDITOR") {
            const re = STATE.repEditor;
            if(re.isEditing) {
                const dir = (key==="RIGHT"?1:(key==="LEFT"?-1:0)); const val = (key==="UP"?1:(key==="DOWN"?-1:0));
                if(key==="OK") re.isEditing = false;
                else {
                    if(re.cursor===0) { if(dir) re.unitIdx=(re.unitIdx+dir+REP_UNITS.length)%REP_UNITS.length; if(val) re.interval=Math.max(1,re.interval+val); }
                    else if(re.cursor===1) { if(re.unitIdx===3) { if(dir) re.subCursor=(re.subCursor+dir+7)%7; if(val) { const i=re.subCursor, x=re.days.indexOf(i); x>-1?re.days.splice(x,1):re.days.push(i); } } else if(re.unitIdx===4) re.monthMode=(re.monthMode===0)?1:0; }
                    else if(re.cursor===2) { if(dir||val) re.endTypeIdx=(re.endTypeIdx+(dir||val)+REP_END_TYPES.length)%REP_END_TYPES.length; }
                    else if(re.cursor===3) { if(re.endTypeIdx===2) re.endVal+=val; }
                }
            } else {
                if(key==="UP") { re.cursor--; if(re.cursor<0) re.cursor=3; }
                if(key==="DOWN") { re.cursor++; if(re.cursor>3) re.cursor=0; }
                if(key==="OK") { if(re.cursor === 3 && re.endTypeIdx === 1) { openUnifiedEditor("REP_END_DATE", "DATE", [re.endD, re.endM, re.endY], ["J","M","A"]); } else { re.isEditing = true; } }
                if(key==="C") { saveRepEditor(); STATE.menuStack.pop(); }
            }
            UI.render();
        }

        else if(mode!=="HOME" && mode!=="AGENDA_VIEW" && mode!=="LIB_VIEW") {
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
                
                else if(it.action && it.action.startsWith("EDIT_D_")) {
                    const key = it.action.substring(7).toLowerCase(); 
                    const map = {"ang":"dur_angelus","mes":"dur_messe","mar":"dur_mariage","plenum":"dur_plenum","bapteme":"dur_bapteme","glas":"dur_glas","tedeum":"dur_tedeum","tocsin":"dur_tocsin"};
                    const settKey = map[key]; const v = SETTINGS[settKey];
                    openUnifiedEditor("SET_" + settKey, "TIME", [Math.floor(v/3600), Math.floor((v%3600)/60), v%60], ["H","M","S"]);
                } 
                else if(it.action && it.action.startsWith("TOG_")) { 
                    const k = it.action.substring(4);
                    if(k==="H_ON") SETTINGS.auto_h.on=!SETTINGS.auto_h.on; if(k==="H_REP") SETTINGS.auto_h.rep=!SETTINGS.auto_h.rep;
                    if(k==="M_ON") SETTINGS.auto_m.on=!SETTINGS.auto_m.on; if(k==="M_REP") SETTINGS.auto_m.rep=!SETTINGS.auto_m.rep;
                    if(k==="Q_ON") SETTINGS.auto_q.on=!SETTINGS.auto_q.on; if(k==="Q_REP") SETTINGS.auto_q.rep=!SETTINGS.auto_q.rep;
                    if(k==="NIGHT") SETTINGS.night_mode=!SETTINGS.night_mode;
                    saveData();
                }
                else if(it.action && it.action.startsWith("EDIT_")) {
                    if(it.action.includes("DEL_H")) openUnifiedEditor("DEL_H", "TIME", [0, Math.floor(SETTINGS.auto_h.del/60), SETTINGS.auto_h.del%60], ["H","M","S"]);
                    if(it.action.includes("INT_H")) openUnifiedEditor("INT_H", "DECIMAL", [SETTINGS.auto_h.int||2.25], ["SEC"]);
                    if(it.action.includes("DEL_M")) openUnifiedEditor("DEL_M", "TIME", [0, Math.floor(SETTINGS.auto_m.del/60), SETTINGS.auto_m.del%60], ["H","M","S"]);
                    if(it.action.includes("DEL_Q")) openUnifiedEditor("DEL_Q", "TIME", [0, Math.floor(SETTINGS.auto_q.del/60), SETTINGS.auto_q.del%60], ["H","M","S"]);
                    if(it.action.includes("NIGHT_S")) openUnifiedEditor("NIGHT_S", "TIME", [SETTINGS.night_start_h, SETTINGS.night_start_m, 0], ["H","M","S"]);
                    if(it.action.includes("NIGHT_E")) openUnifiedEditor("NIGHT_E", "TIME", [SETTINGS.night_end_h, SETTINGS.night_end_m, 0], ["H","M","S"]);
                }
            }
        } 
        else if(mode === "AGENDA_VIEW" || mode === "LIB_VIEW") {
             const list = (mode==="AGENDA_VIEW") ? SCHEDULE : LIBRARY;
             if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=Math.max(0,list.length-1); }
             if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>=list.length) STATE.cursor=0; }
             if(key==="OK" && list.length) { loadEventToForm(list[STATE.cursor], STATE.cursor); if(mode==="LIB_VIEW") STATE.editingLibrary=true; STATE.menuStack.push("FORM"); STATE.cursor=0; }
        }
        else if(key==="OK") this.fKey(1);
        UI.render();
    },
    
    handleTimeEditor: function(key) {
        const te = STATE.timeEditor; const max = te.vals.length - 1;
        if(key==="LEFT") { te.cursor--; if(te.cursor<0) te.cursor=max; }
        if(key==="RIGHT") { te.cursor++; if(te.cursor>max) te.cursor=0; }
        const dir = (key==="UP"?1:(key==="DOWN"?-1:0));
        if(dir!==0) { 
            if(te.type === "DECIMAL") {
                te.vals[0] += (dir * 0.25); if(te.vals[0] < 0.25) te.vals[0] = 0.25;
                te.vals[0] = parseFloat(te.vals[0].toFixed(2));
            } else {
                te.vals[te.cursor] += dir; 
                if(te.type==="TIME") { 
                    if(te.cursor===0) { if(te.vals[0]>23) te.vals[0]=0; if(te.vals[0]<0) te.vals[0]=23; }
                    else { if(te.vals[te.cursor]>59) te.vals[te.cursor]=0; if(te.vals[te.cursor]<0) te.vals[te.cursor]=59; }
                }
            }
        }
        if(key==="OK") { 
            if(te.targetField === "EDIT_ANG_TIME") {
                STATE.tempAngelus.h = te.vals[0]; STATE.tempAngelus.m = te.vals[1]; STATE.tempAngelus.s = te.vals[2];
                te.active = false; UI.render(); return;
            }

            const target = te.targetField;
            const now = new Date(SETTINGS.date_y, SETTINGS.date_m - 1, SETTINGS.date_d, SETTINGS.time_h, SETTINGS.time_m, SETTINGS.time_s);

            if(target === "PROG_DATE" || target === "REP_END_DATE") {
                const inputDate = new Date(te.vals[2], te.vals[1] - 1, te.vals[0]);
                const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if(inputDate < todayMidnight) { UI.showError("DATE PASSÉE !"); return; }
            }

            if(target === "START") {
                const formParts = STATE.formData.date.split('/');
                const inputDateTime = new Date(parseInt(formParts[2]), parseInt(formParts[1])-1, parseInt(formParts[0]), te.vals[0], te.vals[1], te.vals[2]);
                if(inputDateTime < now) { UI.showError("HEURE PASSÉE !"); return; }
            }

            const f = STATE.formData;
            if(te.targetField==="START") { f.h=te.vals[0]; f.m=te.vals[1]; f.s=te.vals[2]; }
            if(te.targetField==="PROG_DATE") f.date = `${pad(te.vals[0])}/${pad(te.vals[1])}/${te.vals[2]}`;
            if(te.targetField==="PROG_DUR") f.dur = te.vals[0]*3600 + te.vals[1]*60 + te.vals[2];
            if(te.targetField.startsWith("B_")) {
                const [_, type, idx] = te.targetField.split('_');
                if(type==="CAD") f.bellConfig[idx].cadence = te.vals[0];
                else { const s=te.vals[1]*60+te.vals[2]; if(type==="DEL") f.bellConfig[idx].delay=s; else f.bellConfig[idx].cutoff=s; }
            }
            if(te.targetField.startsWith("SET_")) { SETTINGS[te.targetField.substring(4)] = (te.vals[0]*3600) + (te.vals[1]*60) + te.vals[2]; }
            if(te.targetField==="SYS_TIME") { SETTINGS.time_h=te.vals[0]; SETTINGS.time_m=te.vals[1]; SETTINGS.time_s=te.vals[2]; STATE.manualDateObj.setHours(te.vals[0],te.vals[1],te.vals[2]); }
            if(te.targetField==="SYS_DATE") { SETTINGS.date_d=te.vals[0]; SETTINGS.date_m=te.vals[1]; SETTINGS.date_y=te.vals[2]; STATE.manualDateObj.setFullYear(te.vals[2],te.vals[1]-1,te.vals[0]); }
            
            if(te.targetField==="DEL_H") SETTINGS.auto_h.del = (te.vals[1]*60) + te.vals[2]; 
            if(te.targetField==="INT_H") SETTINGS.auto_h.int = te.vals[0];
            if(te.targetField==="DEL_M") SETTINGS.auto_m.del = (te.vals[1]*60) + te.vals[2]; 
            if(te.targetField==="DEL_Q") SETTINGS.auto_q.del = (te.vals[1]*60) + te.vals[2]; 
            
            if(te.targetField==="NIGHT_S") { SETTINGS.night_start_h=te.vals[0]; SETTINGS.night_start_m=te.vals[1]; } if(te.targetField==="NIGHT_E") { SETTINGS.night_end_h=te.vals[0]; SETTINGS.night_end_m=te.vals[1]; }
            
            saveData(); te.active=false; 
        }
        if(key==="C") te.active=false; UI.render();
    }
};