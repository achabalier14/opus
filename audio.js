// =============================================================================
// AUDIO.JS - MOTEUR AUDIO (V78 - CROSSFADE & ANTI-CLICK)
// =============================================================================

class BellEngine {
    constructor(id) { 
        this.id = id; 
        this.isSwinging = false; 
        this.buffers = {}; 
        
        this.activeSource = null; 
        this.activeGain = null;
        this.nextLoopTimer = null;
    }

    async load() {
        try { 
            const folder = AUDIO_FILES[this.id];
            this.buffers.tint  = await this._fetch(folder + 'tintement.mp3');
            this.buffers.debut = await this._fetch(folder + 'debut.mp3');
            this.buffers.volee = await this._fetch(folder + 'volee.mp3');
            this.buffers.fin   = await this._fetch(folder + 'fin.mp3');
        } catch(e) { console.log("Err audio cloche " + this.id, e); }
    }

    async _fetch(url) {
        const r = await fetch(url); const b = await r.arrayBuffer();
        return await STATE.audioCtx.decodeAudioData(b);
    }

    // TINTEMENT : Simple, pas de mélange complexe
    tinte() {
        if(this.isSwinging) return;
        this._chkCtx();
        updateRelay(this.id, true); 
        setTimeout(() => updateRelay(this.id, false), 200);
        if(this.buffers.tint) this._playSimple(this.buffers.tint);
    }

    // DÉMARRAGE VOLÉE
    startVolley() {
        if(this.isSwinging) return;
        this._chkCtx();
        this.isSwinging = true;
        
        updateRelay(this.id, true);
        const btn = document.getElementById('btn-'+this.id);
        if(btn) btn.classList.add('ringing');
        
        if(this.buffers.debut) {
            this._playSequence('debut');
        } else {
            this._playSequence('volee');
        }
    }

    // ARRÊT VOLÉE (La partie critique)
    stopVolley() { 
        if(!this.isSwinging) return;
        
        // 1. On annule la prochaine boucle prévue
        if(this.nextLoopTimer) clearTimeout(this.nextLoopTimer);
        this.isSwinging = false;

        const now = STATE.audioCtx.currentTime;
        
        // 2. LANCEMENT DE LA FIN (Avec FADE IN)
        // Le fade in (0.8s) permet de masquer l'attaque si elle tombe mal
        if(this.buffers.fin) {
            const fadeInTime = BELL_PARAMS[this.id].fadeIn || 0.5;
            
            const s = STATE.audioCtx.createBufferSource();
            const g = STATE.audioCtx.createGain();
            s.buffer = this.buffers.fin;
            s.connect(g);
            g.connect(STATE.audioCtx.destination);
            
            // On part de 0 et on monte le volume
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(1, now + fadeInTime);
            
            s.start(now);
        }

        // 3. ARRÊT DE LA VOLÉE EN COURS (Avec FADE OUT)
        // On la laisse "mourir" doucement (1.5s)
        const fadeOutTime = BELL_PARAMS[this.id].fadeOut || 1.0;
        
        if(this.activeGain) {
            try {
                // On fige la valeur actuelle pour éviter un saut
                this.activeGain.gain.cancelScheduledValues(now);
                this.activeGain.gain.setValueAtTime(this.activeGain.gain.value, now);
                // Descente progressive vers 0
                this.activeGain.gain.linearRampToValueAtTime(0, now + fadeOutTime);
            } catch(e) {}
            
            // On coupe réellement le moteur un peu après
            const oldSource = this.activeSource;
            setTimeout(() => { if(oldSource) try{oldSource.stop();}catch(e){} }, fadeOutTime * 1000 + 100);
        }

        this.activeSource = null;
        this.activeGain = null;
        updateRelay(this.id, false);
        const btn = document.getElementById('btn-'+this.id);
        if(btn) btn.classList.remove('ringing');
    }

    // Gestion de la séquence Début -> Volée -> Volée...
    _playSequence(type) {
        if(!this.isSwinging) return;

        const buf = (type === 'debut') ? this.buffers.debut : this.buffers.volee;
        if(!buf) return;

        const source = STATE.audioCtx.createBufferSource();
        const gainNode = STATE.audioCtx.createGain();
        
        source.buffer = buf;
        source.connect(gainNode);
        gainNode.connect(STATE.audioCtx.destination);
        
        // MICRO FADE-IN ANTI-CLICK au démarrage du fichier
        // Même si le fichier est propre, on met 10ms de fade in pour éviter le "tique" numérique
        const now = STATE.audioCtx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1, now + 0.05); // 50ms de fade in

        this.activeSource = source;
        this.activeGain = gainNode;

        source.start(now);

        // Calcul du temps avant la suite
        // On utilise l'overlap défini dans data.js (ex: 1.0s)
        const overlap = BELL_PARAMS[this.id].overlap || 0.5;
        const duration = buf.duration;
        
        // Temps avant de lancer la prochaine boucle
        // Le prochain son partira AVANT la fin de celui-ci (crossfade)
        const timeToNext = (duration - overlap) * 1000;

        // On planifie aussi le fade-out de CE fichier quand le prochain démarrera
        // pour que la transition soit fluide
        setTimeout(() => {
            if(this.activeGain === gainNode) { // Si c'est toujours le gain actif
                 // On ne fait rien ici, le fade out naturel du fichier suffit souvent si overlap est bon
                 // Mais on pourrait ajouter un fade out ici si besoin.
            }
        }, timeToNext);

        this.nextLoopTimer = setTimeout(() => {
            if(this.isSwinging) {
                this._playSequence('volee'); 
            }
        }, timeToNext);
    }

    _playSimple(buf) {
        const s = STATE.audioCtx.createBufferSource(); 
        const g = STATE.audioCtx.createGain();
        s.buffer = buf; 
        s.connect(g); 
        g.connect(STATE.audioCtx.destination);
        s.start(0);
    }

    _chkCtx() { if(STATE.audioCtx && STATE.audioCtx.state === 'suspended') STATE.audioCtx.resume(); }
}

function updateRelay(id, state) {
    if(id > STATE.relays.length) return;
    STATE.relays[id-1] = state ? 1 : 0;
    const el = document.getElementById('rel-'+id);
    if(el) { if(state) el.classList.add('on'); else el.classList.remove('on'); }
}

const AUDIO = {
    tinte: (id) => STATE.engines[id].tinte(),
    start: (id) => STATE.engines[id].startVolley(),
    stop: (id) => STATE.engines[id].stopVolley(),
    stopAll: () => { 
        for(let i=1; i<=5; i++) { if(STATE.engines[i]) STATE.engines[i].stopVolley(); }
        ACTIVE_LOOPS.forEach(l => clearTimeout(l)); ACTIVE_LOOPS=[];
        STATE.stopSignal=true; STATE.isChiming=false; 
    }
};