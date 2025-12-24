// =============================================================================
// UI.JS - INTERFACE V104 (FIX VOLÉE DUREE DIRECTE)
// =============================================================================

const UI = {
    menus: {
        'HOME': { type: "static" },
        'MAIN': { title: "MENU PRINCIPAL", items: [ { t: "➕ PROGRAMMES", link: "PROGS" }, { t: "📅 AGENDA", link: "AGENDA_VIEW" }, { t: "⚙️ PARAMETRES", link: "SETTINGS" }, { t: "📚 BIBLIOTHEQUE", link: "LIB_VIEW" } ]},
        'PROGS': { title: "CHOIX PROG", items: [ { t: "🔔 ANGELUS", run: "ANGELUS" }, { t: "⛪ MESSE", run: "MESSE" }, { t: "💍 MARIAGE", run: "MARIAGE" }, { t: "👶 BAPTEME", run: "BAPTEME" }, { t: "🎉 PLENUM (FETES)", run: "PLENUM" }, { t: "⚰️ GLAS (STD)", run: "GLAS" }, { t: "🎶 TE DEUM", run: "TE_DEUM" }, { t: "🔥 TOCSIN (ALERTE)", run: "TOCSIN" } ]},
        
        'SETTINGS': { title: "PARAMETRES", items: [ 
            { t: "🛠️ CONFIG. PROGRAMMES", link: "SET_PROGS_LIST" }, 
            { t: "🕒 HORLOGE SYSTEME", link: "SET_CLOCK" }, 
            { t: "🤖 AUTOMATISMES", link: "SET_AUTO" }, 
            { t: "🌙 MODE NUIT", link: "SET_NIGHT" } 
        ]},

        'SET_CLOCK': { title: "REGLAGE HORLOGE", items: [ { t: "Mode: ", action: "TOGGLE_CLOCK_MODE" }, { t: "REGLER HEURE", action: "EDIT_SYS_TIME" }, { t: "REGLER DATE", action: "EDIT_SYS_DATE" } ]},
        'SET_AUTO': { title: "AUTOMATISMES", items: [ { t: "🔔 SONNERIE HORAIRE >", link: "SET_AUTO_CHIME" }, { t: "⛪ ANGELUS >", link: "ANG_LIST" } ]},
        'SET_AUTO_CHIME': { title: "SONNERIE HORAIRE", items: [ { t: "HEURES >", link: "SET_AUTO_H" }, { t: "DEMIES >", link: "SET_AUTO_M" }, { t: "QUARTS >", link: "SET_AUTO_Q" } ]},
        'SET_AUTO_H': { title: "CONFIG. HEURES", items: [ { t: "Active: ", action: "TOG_H_ON" }, { t: "Repetition: ", action: "TOG_H_REP" }, { t: "Delai Rep: ", action: "EDIT_H_DEL" }, { t: "Intervalle: ", action: "EDIT_H_INT" } ]},
        'SET_AUTO_M': { title: "CONFIG. DEMIES", items: [ { t: "Active: ", action: "TOG_M_ON" }, { t: "Repetition: ", action: "TOG_M_REP" }, { t: "Delai Rep: ", action: "EDIT_M_DEL" } ]},
        'SET_AUTO_Q': { title: "CONFIG. QUARTS", items: [ { t: "Active: ", action: "TOG_Q_ON" }, { t: "Repetition: ", action: "TOG_Q_REP" }, { t: "Delai Rep: ", action: "EDIT_Q_DEL" } ]},
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
            if(te.type==="MIN_SEC") title = "DUREE (MIN:SEC)";
            if(te.type==="DATE") title = "REGLAGE DATE";
            if(te.type==="INT") title = "VALEUR (NB)";
            if(te.type==="DECIMAL") title = "VALEUR (SEC)";
            let html = `<div class="editor-overlay"><div class="editor-header">${title}</div><div class="time-container">`;
            te.vals.forEach((v, idx) => { 
                const valDisplay = (te.type === "DECIMAL") ? v.toFixed(2) : pad(v);
                html += `<div class="time-col"><span class="col-label">${te.labels[idx]}</span><span class="time-slot ${idx===te.cursor?'active':''}">${valDisplay}</span></div>`; 
            });
            html += `</div><div class="editor-hint">OK: VALIDER - C: RETOUR</div></div>`;
            scr.innerHTML = html; return;
        }

        const mode = STATE.menuStack[STATE.menuStack.length-1];

        // --- MENU DE CHOIX : TYPE DE FIN (POUR TINTEMENT) ---
        if(mode === "SEQ_END_CHOICE") {
            let h = `<div class="menu-title">CHOISIR TYPE FIN</div>`;
            h += `<div class="menu-item ${STATE.cursor===0?'selected':''}"><span>1. PAR DUREE (TEMPS)</span></div>`;
            h += `<div class="menu-item ${STATE.cursor===1?'selected':''}"><span>2. PAR REPETITIONS (NB)</span></div>`;
            scr.innerHTML = h; return;
        }

        // --- VUE TIMELINE ---
        if(mode === "TIMELINE_VIEW") {
            const tmName = STATE.editingTimelineName;
            const timeline = SETTINGS.timelines[tmName] || [];
            
            let h = `<div class="menu-title">${tmName}: SEQUENCES</div>`;
            h += `<div style="width:100%;">`;
            
            if(timeline.length === 0) h += `<div class="menu-item"><span>(VIDE)</span></div>`;
            
            timeline.forEach((block, idx) => {
                const isLast = (idx === timeline.length - 1);
                // Affichage intelligent
                let durTxt = "";
                if(isLast && block.mode!=="LOOP") durTxt = "INFINI ♾️";
                else if(block.mode === "LOOP") durTxt = (block.repeat||1) + " FOIS";
                else durTxt = secToMinSec(block.duration || 0);

                const typeIcon = (block.type === "VOL") ? "🔔" : "🔨";
                const parIcon = block.parallel ? "⚡" : "⬇";
                const isSel = (STATE.cursor === idx);
                h += `<div class="menu-item ${isSel?'selected':''}" style="justify-content:space-between;">
                        <span>SEQ ${idx+1} ${typeIcon} ${parIcon}</span>
                        <span style="font-size:0.8em; color:${isLast?'#f1c40f':'#aaa'}">${durTxt}</span>
                      </div>`;
            });
            h += `</div>`;
            
            const lastIdx = timeline.length;
            h += `<div class="save-btn-row ${STATE.cursor===lastIdx ? 'selected':''}" style="color:#2ecc71; margin-top:2px;">[ + AJOUT TINTEMENT ]</div>`;
            h += `<div class="save-btn-row ${STATE.cursor===lastIdx+1 ? 'selected':''}" style="color:#e67e22;">[ + AJOUT VOLEE ]</div>`;
            h += `<div class="save-btn-row ${STATE.cursor===lastIdx+2 ? 'selected':''}" style="color:#e74c3c;">[ RETOUR ]</div>`;
            
            scr.innerHTML = h;
            const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"});
            return;
        }

        // --- EDITEUR DE BLOC (SEQ ou VOL) ---
        if(mode === "BLOCK_EDITOR") {
            const tmName = STATE.editingTimelineName;
            const blockIdx = STATE.editingBlockIndex;
            const block = SETTINGS.timelines[tmName][blockIdx];
            const isLast = (blockIdx === SETTINGS.timelines[tmName].length - 1);
            
            let title = `SEQ ${blockIdx+1} (${block.type==="VOL"?"VOLEE":"TINT"})`;
            let h = `<div class="menu-title" style="font-size:0.9em;">${title}</div>`;
            
            h += `<div style="width:100%; border:1px solid #444; margin-bottom:5px; background:#222;">`;
            
            // --- CAS 1 : SEQUENCE TINTÉE (SEQ) ---
            if(block.type === "SEQ") {
                const steps = block.steps || [];
                if(steps.length === 0) {
                    h += `<div style="padding:10px; color:#666; text-align:center;">(VIDE)</div>`;
                } else {
                    steps.forEach((step, idx) => {
                        const isSel = (STATE.cursor === idx);
                        // PADDING-RIGHT 30px pour visibilité PAUSE
                        h += `<div class="agenda-row ${isSel?'selected':''}" style="justify-content:space-between; padding:8px 5px; white-space:nowrap;">
                                <div style="display:flex; align-items:center;">
                                    <span style="color:#888; font-size:0.8em; margin-right:5px;">${idx+1}.</span>
                                    <span style="font-size:0.9em;">🔨C<b>${step.bell}</b></span>
                                </div>
                                <div style="display:flex; align-items:center; padding-right:30px;">
                                    <span style="font-size:0.8em; margin-right:5px;">PAUSE</span>
                                    <span style="color:${isSel?'#f1c40f':'#fff'}; font-weight:bold;">${step.wait.toFixed(2)}s</span>
                                </div>
                              </div>`;
                    });
                }
            }

            // --- CAS 2 : VOLEE (VOL) - GRILLE ---
            else if(block.type === "VOL") {
                const conf = block.volConfig || {};
                h += `<div style="display:flex; font-size:0.7em; color:#888; padding:0 5px; margin-bottom:5px;">
                        <span style="width:60px;">ETAT</span>
                        <span style="flex:1; text-align:center;">DEPART</span>
                        <span style="flex:1; text-align:right; padding-right:30px;">ARRET</span>
                      </div>`;

                for(let i=1; i<=5; i++) {
                    const bc = conf[i] || {active:false, delay:0, cutoff:0};
                    const idxBase = (i-1)*3;
                    const sel1 = (STATE.cursor === idxBase);   
                    const sel2 = (STATE.cursor === idxBase+1); 
                    const sel3 = (STATE.cursor === idxBase+2); 
                    
                    const styleSel = "background:#f1c40f; color:#000; font-weight:bold; border-radius:3px; padding:2px 5px;";
                    const styleDef = "padding:2px 5px;";

                    h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #333;">
                            <div style="width:60px; ${sel1?styleSel:styleDef}">
                                ${bc.active ? '✅ ON' : '❌ OFF'} <span style="font-size:0.8em">C${i}</span>
                            </div>
                            <div style="flex:1; text-align:center; ${sel2?styleSel:styleDef}">
                                ▶️ ${secToMinSec(bc.delay||0)}
                            </div>
                            <div style="flex:1; text-align:right; padding-right:30px; ${sel3?styleSel:styleDef}">
                                ⏹️ ${secToMinSec(bc.cutoff||0)}
                            </div>
                          </div>`;
                }
            }
            h += `</div>`; 
            
            // MENU ACTIONS
            const maxItm = (block.type==="SEQ") ? block.steps.length : 15;
            let buttonCursorBase = maxItm;

            // BOUTON 1 : AJOUTER ETAPE (SI SEQ UNIQUEMENT)
            if(block.type==="SEQ") {
                h += `<div class="save-btn-row ${STATE.cursor===buttonCursorBase ? 'selected':''}" style="color:#2ecc71;">[ + AJOUTER ETAPE ]</div>`;
                buttonCursorBase++;
            }

            // Calcul Label Durée / Boucle
            let durLabel = "";
            if (block.type === "VOL") {
                // Pour VOL, toujours en temps, pas de mode Loop visible
                durLabel = isLast ? "DUREE: INFINI (AUTO)" : `DUREE: ${secToMinSec(block.duration||0)}`;
            } else {
                // Pour SEQ
                if(isLast && block.mode!=="LOOP") durLabel = "FIN: INFINI (DUREE)";
                else if(block.mode === "LOOP") durLabel = `FIN: ${block.repeat} REPETITION(S)`;
                else durLabel = `FIN: ${secToMinSec(block.duration||0)} (DUREE)`;
            }

            // BOUTON 2 : DUREE / FIN
            h += `<div class="save-btn-row ${STATE.cursor===buttonCursorBase ? 'selected':''}" style="color:#3498db;">[ ${durLabel} ]</div>`;
            buttonCursorBase++;
            
            // BOUTON 3 : PARALLELE
            let parLabel = block.parallel ? "SUITE: EN MEME TPS ⚡" : "SUITE: ATTENDRE ⬇";
            h += `<div class="save-btn-row ${STATE.cursor===buttonCursorBase ? 'selected':''}" style="color:#9b59b6;">[ ${parLabel} ]</div>`;
            buttonCursorBase++;
            
            // BOUTON 4 : RETOUR
            h += `<div class="save-btn-row ${STATE.cursor===buttonCursorBase ? 'selected':''}" style="color:#e74c3c;">[ RETOUR ]</div>`;
            
            scr.innerHTML = h; 
            const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"});
            return;
        }

        // --- ACCES DIRECT ---
        if(mode === "SET_PROGS_LIST") {
            let h = `<div class="menu-title">CHOIX PROGRAMME</div>`;
            const allowedProgs = ["MESSE", "MARIAGE", "BAPTEME", "PLENUM", "ANGELUS", "GLAS", "TE_DEUM", "TOCSIN"];
            allowedProgs.forEach((k, idx) => {
                h += `<div class="menu-item ${idx===STATE.cursor?'selected':''}"><span>${k}</span></div>`;
            });
            scr.innerHTML = h; const sel = document.querySelector('.selected'); if(sel) sel.scrollIntoView({block:"nearest"}); return;
        }

        // MENUS LEAGCY (CODE MORT MAIS GARDE POUR COMPATIBILITE)
        if(mode === "SET_PROG_ROOT") {
            const pName = STATE.selectedPreset;
            let h = `<div class="menu-title">CONFIG: ${pName}</div>`;
            h += `<div class="menu-item ${STATE.cursor===0?'selected':''}" style="color:#f39c12;"><span>EDITER SEQUENCES ></span></div>`;
            h += `<div class="menu-item ${STATE.cursor===1?'selected':''}"><span>(Legacy) VOLEE ></span></div>`;
            scr.innerHTML = h; return;
        }
        if(mode === "SET_PROG_BELLS") {
            const pName = STATE.selectedPreset;
            let h = `<div class="menu-title">${pName}: VOLEE</div>`;
            for(let i=1; i<=5; i++) {
                const conf = PRESET_CONFIGS[pName][i];
                if(!conf) continue; 
                const status = conf.active ? "ON" : "OFF";
                h += `<div class="menu-item ${i-1===STATE.cursor?'selected':''}" style="justify-content:space-between"><span>CLOCHE ${i}</span><span>${status}</span></div>`;
            }
            scr.innerHTML = h; return;
        }
        if(mode === "SET_PROG_PARAM") {
            const pName = STATE.selectedPreset;
            const bId = STATE.selectedBellConfig;
            const conf = PRESET_CONFIGS[pName][bId];
            const showMS = (s) => `${pad(Math.floor(s/60))}:${pad(s%60)}`;
            let h = `<div class="menu-title">${pName} > CLOCHE ${bId}</div>`;
            h += `<div class="menu-item ${STATE.cursor===0?'selected':''}"><span>Active: </span><span>${conf.active?"OUI":"NON"}</span></div>`;
            h += `<div class="menu-item ${STATE.cursor===1?'selected':''}"><span>Delai Depart: </span><span>${showMS(conf.delay)}</span></div>`;
            h += `<div class="menu-item ${STATE.cursor===2?'selected':''}"><span>Arret Avant: </span><span>${showMS(conf.cutoff)}</span></div>`;
            scr.innerHTML = h; return;
        }

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
        if(!m) return;
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
        
        // INTERCEPTION POUR L'EDITEUR DE SEQUENCE (BLOCK_EDITOR)
        if(STATE.menuStack[STATE.menuStack.length-1] === "BLOCK_EDITOR") {
            const tmName = STATE.editingTimelineName;
            const blockIdx = STATE.editingBlockIndex;
            const block = SETTINGS.timelines[tmName][blockIdx];
            
            if(block.type === "SEQ") {
                const steps = block.steps;
                if(steps && STATE.cursor < steps.length) {
                    steps[STATE.cursor].bell = n; 
                    saveData();
                    UI.render();
                    return;
                }
            }
        }

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
        let nowH, nowM;
        if(SETTINGS.clock_mode === "AUTO") { const d = new Date(); nowH = d.getHours(); nowM = d.getMinutes(); } 
        else { nowH = STATE.manualDateObj.getHours(); nowM = STATE.manualDateObj.getMinutes(); }
        let defM = nowM + 1; let defH = nowH;
        if(defM > 59) { defM = 0; defH++; if(defH > 23) defH = 0; }
        
        if(n===1) STATE.menuStack=["MAIN"];
        if(n===2) { 
            loadEventToForm({
                type:"PRESET", progType:"PRESET", name: "Programmation", presetName:"MESSE", bells:[1,2,3], dur: SETTINGS.dur_messe, mode:"AUCUNE", date: getCurrentDateStr(), h: defH, m: defM, s: 0
            }, -1); STATE.menuStack=["FORM"]; 
        }
        if(n===3) { 
            loadEventToForm({
                type:"MANUAL", progType:"MANU", name: "Sonnerie manuelle", typeAudio: "VOL", bells:[], bellConfig: [], dur: 60, mode:"AUCUNE", date: getCurrentDateStr(), h: defH, m: defM, s: 0
            }, -1); STATE.menuStack=["FORM"]; 
        }
        if(n===4) STATE.menuStack=["AGENDA_VIEW"];
        UI.render();
    },

    input: function(key) {
        if(STATE.audioCtx && STATE.audioCtx.state==='suspended') STATE.audioCtx.resume();
        if(STATE.timeEditor.blockInput) return;
        if(STATE.timeEditor.active) { this.handleTimeEditor(key); return; }
        const mode = STATE.menuStack[STATE.menuStack.length-1];
        
        // RETOUR / CANCEL
        if(key === "C") { 
            if(mode==="HOME"){ STATE.manualMode = (STATE.manualMode==="TINT")?"VOL":"TINT"; UI.render(); return; } 
            
            if(mode === "SEQ_END_CHOICE") {
                STATE.menuStack.pop(); UI.render(); return;
            }

            if(mode === "TIMELINE_VIEW") {
                const tm = SETTINGS.timelines[STATE.editingTimelineName];
                if(STATE.cursor < tm.length) { if(confirm("Supprimer cette Séquence ?")) { tm.splice(STATE.cursor, 1); saveData(); } } 
                else { STATE.menuStack.pop(); STATE.cursor=0; }
                UI.render(); return;
            }
            if(mode === "BLOCK_EDITOR") {
                 const tmName = STATE.editingTimelineName;
                 const block = SETTINGS.timelines[tmName][STATE.editingBlockIndex];
                 if(block.type === "SEQ" && STATE.cursor < block.steps.length) {
                     if(confirm("Supprimer étape ?")) { block.steps.splice(STATE.cursor, 1); saveData(); }
                 } else { STATE.menuStack.pop(); STATE.cursor=0; }
                 UI.render(); return;
            }
            STATE.menuStack.pop(); if(!STATE.menuStack.length) STATE.menuStack=["HOME"]; STATE.cursor=0; UI.render(); return; 
        }

        // --- NAVIGATION CHOIX TYPE FIN ---
        if(mode === "SEQ_END_CHOICE") {
            if(key==="UP" || key==="DOWN") { STATE.cursor = (STATE.cursor===0) ? 1 : 0; }
            if(key==="OK") {
                const tmName = STATE.editingTimelineName;
                const block = SETTINGS.timelines[tmName][STATE.editingBlockIndex];
                
                if(STATE.cursor === 0) {
                    // MODE TEMPS
                    block.mode = "TIME";
                    let m=Math.floor(block.duration/60), s=Math.floor(block.duration%60);
                    openUnifiedEditor("BLOCK_DURATION", "MIN_SEC", [m, s], ["MIN","SEC"]);
                } else {
                    // MODE REPETITION
                    block.mode = "LOOP";
                    openUnifiedEditor("BLOCK_REPEAT", "INT", [block.repeat || 1], ["NB"]);
                }
                saveData();
                STATE.menuStack.pop(); // Close choice
            }
            UI.render(); return;
        }

        // --- NAVIGATION TIMELINE ---
        if(mode === "TIMELINE_VIEW") {
            const tm = SETTINGS.timelines[STATE.editingTimelineName];
            if(!tm) { SETTINGS.timelines[STATE.editingTimelineName] = []; UI.render(); return; }
            const max = tm.length + 2; 
            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=max; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>max) STATE.cursor=0; }
            if(key==="OK" || key==="RIGHT") {
                if(STATE.cursor < tm.length) { STATE.editingBlockIndex = STATE.cursor; STATE.menuStack.push("BLOCK_EDITOR"); STATE.cursor = 0; }
                else if(STATE.cursor === tm.length) { tm.push({ type: "SEQ", duration: 0, steps: [], parallel: false, mode:"TIME", repeat:1 }); saveData(); }
                else if(STATE.cursor === tm.length + 1) { tm.push({ type: "VOL", duration: 60, volConfig: {1:{active:false},2:{active:false},3:{active:false},4:{active:false},5:{active:false}}, parallel: false, mode:"TIME", repeat:1 }); saveData(); }
                else { STATE.menuStack.pop(); STATE.cursor = 0; }
            }
            UI.render(); return;
        }

        // --- NAVIGATION EDITEUR BLOC ---
        if(mode === "BLOCK_EDITOR") {
            const tmName = STATE.editingTimelineName;
            const block = SETTINGS.timelines[tmName][STATE.editingBlockIndex];
            
            // TINTEMENT
            if(block.type === "SEQ") {
                const steps = block.steps;
                const max = steps.length + 3; // Ajout, Durée, Parallèle, Retour
                
                if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=max; }
                if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>max) STATE.cursor=0; }
                
                if((key==="RIGHT" || key==="LEFT") && STATE.cursor < steps.length) {
                    let step = steps[STATE.cursor];
                    step.wait += (key==="RIGHT" ? 0.25 : -0.25); if(step.wait < 0.25) step.wait = 0.25; saveData();
                }

                if(key==="OK") {
                    // 1. AJOUT (Maintenant en PREMIER)
                    if(STATE.cursor === steps.length) { 
                        steps.push({ bell: 1, wait: 1.0 }); saveData();
                    }
                    // 2. DUREE / FIN (OUVRE LE MENU CHOIX)
                    else if(STATE.cursor === steps.length + 1) { 
                        STATE.menuStack.push("SEQ_END_CHOICE"); STATE.cursor=0;
                    }
                    // 3. PARALLELE
                    else if(STATE.cursor === steps.length + 2) { 
                        block.parallel = !block.parallel; saveData();
                    }
                    // 4. RETOUR
                    else if(STATE.cursor === steps.length + 3) { 
                        STATE.menuStack.pop(); STATE.cursor=0; 
                    }
                }
            }
            
            // VOLEE
            else if(block.type === "VOL") {
                const max = 17; // 15 slots + durée + parallèle + retour
                
                if(key==="UP") { 
                    if(STATE.cursor < 15) { if(STATE.cursor >= 3) STATE.cursor -= 3; else STATE.cursor = 17; } 
                    else { if(STATE.cursor === 15) STATE.cursor = 12; else STATE.cursor--; }
                }
                if(key==="DOWN") { 
                    if(STATE.cursor < 12) STATE.cursor += 3; else if(STATE.cursor < 15) STATE.cursor = 15; else if(STATE.cursor < 17) STATE.cursor++; else STATE.cursor = 0; 
                }
                if(key==="RIGHT" && STATE.cursor < 15) { if(STATE.cursor % 3 < 2) STATE.cursor++; }
                if(key==="LEFT" && STATE.cursor < 15) { if(STATE.cursor % 3 > 0) STATE.cursor--; }
                
                if(key==="OK") {
                    if(STATE.cursor < 15) {
                        const bId = Math.floor(STATE.cursor / 3) + 1; const sub = STATE.cursor % 3;
                        
                        if(!block.volConfig[bId]) block.volConfig[bId] = {active:false, delay:0, cutoff:0};
                        const conf = block.volConfig[bId];
                        
                        if(sub === 0) { conf.active = !conf.active; saveData(); }
                        else if(sub === 1) openUnifiedEditor("BLK_VOL_DEL_"+bId, "MIN_SEC", [Math.floor(conf.delay/60), conf.delay%60], ["MIN","SEC"]);
                        else if(sub === 2) openUnifiedEditor("BLK_VOL_CUT_"+bId, "MIN_SEC", [Math.floor(conf.cutoff/60), conf.cutoff%60], ["MIN","SEC"]);
                    }
                    else if(STATE.cursor === 15) { // DUREE (DIRECT POUR VOL)
                        let m=Math.floor(block.duration/60), s=Math.floor(block.duration%60);
                        openUnifiedEditor("BLOCK_DURATION", "MIN_SEC", [m, s], ["MIN","SEC"]);
                    }
                    else if(STATE.cursor === 16) { block.parallel = !block.parallel; saveData(); }
                    else if(STATE.cursor === 17) { STATE.menuStack.pop(); STATE.cursor=0; }
                }
            }
            UI.render(); return;
        }

        // --- ACCES DIRECT ---
        if(mode === "SET_PROGS_LIST") {
            const allowedProgs = ["MESSE", "MARIAGE", "BAPTEME", "PLENUM", "ANGELUS", "GLAS", "TE_DEUM", "TOCSIN"];
            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=allowedProgs.length-1; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>=allowedProgs.length) STATE.cursor=0; }
            if(key==="OK" || key==="RIGHT") {
                STATE.selectedPreset = allowedProgs[STATE.cursor];
                STATE.editingTimelineName = STATE.selectedPreset;
                if(!SETTINGS.timelines[STATE.editingTimelineName]) SETTINGS.timelines[STATE.editingTimelineName] = [];
                STATE.menuStack.push("TIMELINE_VIEW"); STATE.cursor = 0;
            }
            UI.render(); return;
        }

        // ... Generique ...
        const m = UI.menus[mode];
        if(m) {
            if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=m.items.length-1; }
            if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>=m.items.length) STATE.cursor=0; }
            if(key==="OK" || key==="RIGHT") {
                const it = m.items[STATE.cursor];
                if(it.link) { STATE.menuStack.push(it.link); STATE.cursor=0; }
                else if(it.run) { execPreset(it.run); STATE.menuStack=["HOME"]; }
                else if(it.action === "EDIT_SYS_TIME") openUnifiedEditor("SYS_TIME", "TIME", [SETTINGS.time_h, SETTINGS.time_m, SETTINGS.time_s], ["H","M","S"]);
                // ...
            }
            UI.render(); return;
        }
        
        if(mode === "FORM") {
             const f = STATE.formData; const totalRows = 7 + (f.progType==="MANU"?f.bellConfig.length*(f.typeAudio==="TINT"?3:2):0) + 1;
             if(key==="UP") { STATE.cursor--; if(STATE.cursor<0) STATE.cursor=totalRows; }
             if(key==="DOWN") { STATE.cursor++; if(STATE.cursor>totalRows) STATE.cursor=0; }
             if(key==="OK" && STATE.cursor >= totalRows-1) saveForm(); 
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
                if(te.targetField === "BLOCK_DURATION") { if(te.vals[0] < 0) te.vals[0] = 0; }
                te.vals[0] = parseFloat(te.vals[0].toFixed(2));
            } else if(te.targetField === "BLOCK_REPEAT" || te.type === "INT") {
                te.vals[0] += dir; if(te.vals[0]<1) te.vals[0]=1;
            } else {
                te.vals[te.cursor] += dir; 
                if(te.type==="TIME") { 
                    if(te.cursor===0) { if(te.vals[0]>23) te.vals[0]=0; if(te.vals[0]<0) te.vals[0]=23; }
                    else { if(te.vals[te.cursor]>59) te.vals[te.cursor]=0; if(te.vals[te.cursor]<0) te.vals[te.cursor]=59; }
                }
                if(te.type==="MIN_SEC") {
                     if(te.vals[te.cursor]>59) te.vals[te.cursor]=0; if(te.vals[te.cursor]<0) te.vals[te.cursor]=59;
                }
            }
        }
        if(key==="OK") { 
            const tmName = STATE.editingTimelineName;
            const blkIdx = STATE.editingBlockIndex;
            
            if(te.targetField === "BLOCK_REPEAT") {
                SETTINGS.timelines[tmName][blkIdx].repeat = te.vals[0];
            }
            if(te.targetField === "BLOCK_DURATION") { SETTINGS.timelines[tmName][blkIdx].duration = (te.vals[0] * 60) + te.vals[1]; }
            
            if(te.targetField && te.targetField.startsWith("BLK_VOL_")) {
                const parts = te.targetField.split('_'); const type = parts[2]; const bId = parseInt(parts[3]);
                const sec = (te.vals[0] * 60) + te.vals[1];
                if(!SETTINGS.timelines[tmName][blkIdx].volConfig[bId]) SETTINGS.timelines[tmName][blkIdx].volConfig[bId] = {active:false,delay:0,cutoff:0};
                if(type === "DEL") SETTINGS.timelines[tmName][blkIdx].volConfig[bId].delay = sec; else SETTINGS.timelines[tmName][blkIdx].volConfig[bId].cutoff = sec;
            }
            if(te.targetField === "CONF_DELAY") { PRESET_CONFIGS[STATE.selectedPreset][STATE.selectedBellConfig].delay = (te.vals[0]*60) + te.vals[1]; }
            if(te.targetField === "CONF_CUTOFF") { PRESET_CONFIGS[STATE.selectedPreset][STATE.selectedBellConfig].cutoff = (te.vals[0]*60) + te.vals[1]; }
            if(te.targetField && te.targetField.startsWith("SET_PROG_DUR_")) { SETTINGS[te.targetField.substring(13)] = (te.vals[0]*60) + te.vals[1]; }
            if(te.targetField === "EDIT_ANG_TIME") { STATE.tempAngelus.h = te.vals[0]; STATE.tempAngelus.m = te.vals[1]; STATE.tempAngelus.s = te.vals[2]; te.active = false; UI.render(); return; }
            
            const f = STATE.formData;
            if(te.targetField==="START") { f.h=te.vals[0]; f.m=te.vals[1]; f.s=te.vals[2]; }
            if(te.targetField==="PROG_DATE") f.date = `${pad(te.vals[0])}/${pad(te.vals[1])}/${te.vals[2]}`;
            if(te.targetField==="PROG_DUR") f.dur = te.vals[0]*3600 + te.vals[1]*60 + te.vals[2];
            if(te.targetField && te.targetField.startsWith("B_")) { const [_, type, idx] = te.targetField.split('_'); if(type==="CAD") f.bellConfig[idx].cadence = te.vals[0]; else { const s=te.vals[1]*60+te.vals[2]; if(type==="DEL") f.bellConfig[idx].delay=s; else f.bellConfig[idx].cutoff=s; } }
            if(te.targetField && te.targetField.startsWith("SET_")) { SETTINGS[te.targetField.substring(4)] = (te.vals[0]*3600) + (te.vals[1]*60) + te.vals[2]; }
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