// =============================================================================
// SYSTÈME D'EXPLOITATION OPUS 10
// =============================================================================

const SYS = {
    state: "IDLE", // IDLE, MENU, FORM
    menuStack: [],
    cursor: 0,
    
    // Données pour le formulaire de programmation
    formData: null, // { h, m, s, bells:[], duration, type }
    formCursor: 0,  // Quel champ est sélectionné

    init: function() {
        this.startClock();
        this.render();
    },

    startClock: function() {
        setInterval(() => {
            this.tick();
            if(this.state === "IDLE") this.renderHome();
        }, 1000);
    },

    tick: function() {
        // Horloge logique (similaire au code précédent)
        let now = new Date();
        if(CLOCK_PARAMS.mode === "MANUAL") { /* ... logique manuelle ... */ }
        
        const h = now.getHours();
        const m = now.getMinutes();
        const s = now.getSeconds();

        // Vérification Planning
        // ... (Code identique au précédent pour déclenchement) ...
        USER_SCHEDULE.forEach(evt => {
            if(evt.h === h && evt.m === m && evt.s === s) {
                if(evt.category === "PRESET") this.runRoutine(evt.type, evt.duration);
                else this.execManualEvent(evt);
            }
        });
    },

    // --- NAVIGATION MATÉRIELLE (FLÈCHES) ---
    input: function(key) {
        if(ctx.state === 'suspended') ctx.resume();

        // 1. NAVIGATION MENU CLASSIQUE
        if(this.state === "MENU") {
            const currentMenu = this.MENUS[this.menuStack[this.menuStack.length-1]];
            
            if(key === "UP") {
                this.cursor--;
                if(this.cursor < 0) this.cursor = currentMenu.items.length - 1;
            }
            else if(key === "DOWN") {
                this.cursor++;
                if(this.cursor >= currentMenu.items.length) this.cursor = 0;
            }
            else if(key === "OK" || key === "RIGHT") {
                const item = currentMenu.items[this.cursor];
                if(item.go) this.goMenu(item.go);
                else if(item.run) { this.runRoutine(item.run); this.goHome(); }
                else if(item.action === "NEW_PROG") this.startForm();
            }
            else if(key === "C" || key === "LEFT") {
                this.menuStack.pop();
                if(this.menuStack.length === 0) this.state = "IDLE";
                this.cursor = 0;
            }
            this.render();
        }

        // 2. NAVIGATION FORMULAIRE (PROGRAMMATION)
        else if(this.state === "FORM") {
            // Haut/Bas = Changer de champ
            if(key === "UP") {
                this.formCursor--;
                if(this.formCursor < 0) this.formCursor = 5; // 6 champs (0-5)
            }
            else if(key === "DOWN") {
                this.formCursor++;
                if(this.formCursor > 5) this.formCursor = 0;
            }
            
            // Gauche/Droite = Modifier Valeur
            else if(key === "RIGHT") this.modifyForm(1);
            else if(key === "LEFT") this.modifyForm(-1);
            
            // OK = Valider / C = Annuler
            else if(key === "OK") this.saveForm();
            else if(key === "C") { this.state = "IDLE"; }
            
            this.render();
        }

        // 3. RACCOURCIS ECRAN ACCUEIL
        else if(this.state === "IDLE") {
            if(key === "OK") this.goMenu("MAIN"); // OK ouvre le menu
        }
    },

    // Touches F1-F4 (Contextuel)
    fKey: function(n) {
        if(n === 1) this.goMenu("MAIN");
        if(n === 2) this.goMenu("PROGS"); // Liturgie
        if(n === 3) this.startForm();     // Prog Manuelle Directe
        if(n === 4) this.goMenu("SETTINGS");
        this.render();
    },

    // --- LOGIQUE FORMULAIRE (LA GROSSE DEMANDE) ---
    startForm: function() {
        const now = new Date();
        this.formData = {
            h: now.getHours(),
            m: now.getMinutes(),
            s: 0,
            type: "VOLEE",
            bells: [],
            dur: 180
        };
        this.state = "FORM";
        this.formCursor = 0;
        this.render();
    },

    modifyForm: function(dir) {
        const d = this.formData;
        switch(this.formCursor) {
            case 0: // HEURE
                d.h += dir;
                if(d.h > 23) d.h = 0; if(d.h < 0) d.h = 23;
                break;
            case 1: // MINUTE
                d.m += dir;
                if(d.m > 59) d.m = 0; if(d.m < 0) d.m = 59;
                break;
            case 2: // SECONDE
                d.s += dir;
                if(d.s > 59) d.s = 0; if(d.s < 0) d.s = 59;
                break;
            case 3: // TYPE
                d.type = (d.type === "VOLEE" ? "TINT" : "VOLEE");
                break;
            case 4: // CLOCHES (Navigation spéciale ou via pavé num)
                // Ici on ne fait rien avec flèches, il faut utiliser pavé numérique
                break;
            case 5: // DUREE
                d.dur += (dir * 10); // Par pas de 10s
                if(d.dur < 10) d.dur = 10;
                break;
        }
    },

    // Appelé quand on appuie sur 1, 2, 3, 4
    numpad: function(n) {
        if(this.state === "FORM" && this.formCursor === 4) {
            const idx = this.formData.bells.indexOf(n);
            if(idx > -1) this.formData.bells.splice(idx, 1);
            else { this.formData.bells.push(n); this.formData.bells.sort(); }
            this.render();
        } else {
            // Mode direct: fait sonner la cloche
            AUDIO.tinte(n);
        }
    },

    saveForm: function() {
        if(this.formData.bells.length === 0) {
            alert("Sélectionnez au moins une cloche !");
            return;
        }
        USER_SCHEDULE.push({
            h: this.formData.h, m: this.formData.m, s: this.formData.s,
            type: this.formData.type,
            bells: this.formData.bells,
            duration: this.formData.dur,
            category: "MANUAL"
        });
        alert("Programmation enregistrée !");
        this.state = "IDLE";
        this.render();
    },

    // --- RENDU GRAPHIQUE ---
    render: function() {
        const screen = document.getElementById('screen-content');
        screen.innerHTML = ""; // Clear

        // VUE ACCUEIL
        if(this.state === "IDLE") {
            this.renderHome();
        }
        // VUE MENU
        else if(this.state === "MENU") {
            const menuID = this.menuStack[this.menuStack.length-1];
            const menu = this.MENUS[menuID];
            
            let html = `<div style="background:white; color:blue; padding:2px;">${menu.title}</div>`;
            menu.items.forEach((item, i) => {
                const active = (i === this.cursor) ? "selected" : "";
                html += `<div class="menu-item ${active}">${item.t}</div>`;
            });
            screen.innerHTML = html;
        }
        // VUE FORMULAIRE
        else if(this.state === "FORM") {
            const f = this.formData;
            const c = this.formCursor;
            
            const line = (idx, label, val) => {
                const focus = (idx === c) ? "focus" : "";
                return `<div class="form-line ${focus}"><span class="form-label">${label}</span><span class="form-val">${val}</span></div>`;
            };

            let html = `<div style="background:white; color:blue; font-size:0.8rem; padding:2px;">NOUVELLE PROG.</div>`;
            html += line(0, "HEURE", String(f.h).padStart(2,'0'));
            html += line(1, "MINUTE", String(f.m).padStart(2,'0'));
            html += line(2, "SECONDE", String(f.s).padStart(2,'0'));
            html += line(3, "MODE", f.type);
            html += line(4, "CLOCHES", f.bells.length > 0 ? f.bells.join('-') : "_");
            html += line(5, "DUREE", f.dur + " sec");
            
            html += `<div style="margin-top:auto; font-size:0.7rem; text-align:center;">OK=Valider  C=Annuler</div>`;
            screen.innerHTML = html;
        }
    },

    renderHome: function() {
        const screen = document.getElementById('screen-content');
        const now = new Date();
        // Le look "Bodet" : Heure géante au milieu
        const timeStr = now.toLocaleTimeString('fr-FR');
        const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

        screen.innerHTML = `
            <div class="big-clock">${timeStr}</div>
            <div class="date-line">${dateStr}</div>
            <div class="next-event">
                Prochaine sonnerie:<br>
                ${this.getNextEventStr()}
            </div>
            
            <div style="position:absolute; left:0; top:0; height:100%; display:flex; flex-direction:column; justify-content:space-around; padding-left:2px; font-size:0.8rem;">
                <div>📂</div>
                <div>🙏</div>
                <div>🔨</div>
                <div>⚙️</div>
            </div>
        `;
    },

    getNextEventStr: function() {
        // Logique simplifiée pour afficher le prochain event
        if(USER_SCHEDULE.length > 0) return "PROG MANUELLE";
        return "ANGELUS (AUTO)";
    },

    goMenu: function(id) {
        this.menuStack = [id];
        this.cursor = 0;
        this.state = "MENU";
        this.render();
    },
    goHome: function() {
        this.state = "IDLE";
        this.render();
    },

    // DEFINITIONS DES MENUS
    MENUS: {
        'MAIN': { title: "MENU PRINCIPAL", items: [
            { t: "PROGRAMMES", go: "PROGS" },
            { t: "PROG MANUELLE", action: "NEW_PROG" },
            { t: "PARAMETRES", go: "SETTINGS" }
        ]},
        'PROGS': { title: "LITURGIE", items: [
            { t: "ANGELUS", run: "ANGELUS" },
            { t: "MESSE", run: "MESSE" },
            { t: "MARIAGE", run: "MARIAGE" },
            { t: "BAPTEME", run: "BAPTEME" },
            { t: "GLAS", run: "GLAS" },
            { t: "TOCSIN", run: "TOCSIN" }
        ]},
        'SETTINGS': { title: "REGLAGES", items: [
            { t: "RETOUR", go: "MAIN" }
            // Ajoute ici tes réglages si besoin
        ]}
    },
    
    // ... (Fonctions Audio Wrapper runRoutine, execManualEvent identiques à avant) ...
    runRoutine: async function(name, d) {
        if(PROGRAMS[name]) await PROGRAMS[name](d);
    },
    execManualEvent: async function(evt) {
        if(evt.type === "TINT") {
             // ... Logique tintement ...
             for(let i=0; i<5; i++) {
                 for(let id of evt.bells) AUDIO.tinte(id);
                 await COMMON.sleep(2000);
             }
        } else {
            // Logique volée
            for(let id of evt.bells) { AUDIO.start(id); await COMMON.sleep(1500); }
            await COMMON.sleep(evt.duration * 1000);
            for(let id of evt.bells) AUDIO.stop(id);
        }
    },
    stopAll: function() {
        COMMON.stopSignal = true;
        AUDIO.stopAll();
    }
};