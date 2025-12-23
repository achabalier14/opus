// =============================================================================
// AUDIO.JS - MOTEUR AUDIO (V79 - DOUBLE FADE DEBUT/FIN)
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

    tinte() {
        if(this.isSwinging) return;
        this._chkCtx();
        updateRelay(this.id, true); 
        setTimeout(() => updateRelay(this.id, false), 200);
        if(this.buffers.tint) this._playSimple(this.buffers.tint);
    }

    startVolley() {
        if(this.isSwinging) return;
        this._chkCtx();
        this.isSwinging = true;
        
        updateRelay(this.id, true);
        const btn = document.getElementById('btn-'+this.id);
        if(btn) btn.classList.add('ringing');
        
        // On démarre la séquence par le début (sans fade in spécial, juste le micro anti-click)
        if(this.buffers.debut) {
            this._playSequence('debut');
        } else {
            this._playSequence('volee');
        }
    }

    stopVolley() { 
        if(!this.isSwinging) return;
        
        if(this.nextLoopTimer) clearTimeout(this.nextLoopTimer);
        this.isSwinging = false;

        const now = STATE.audioCtx.currentTime;
        
        // FADE IN SUR LA FIN (Pour masquer l'attaque)
        if(this.buffers.fin) {
            const fadeInTime = BELL_PARAMS[this.id].fadeIn || 0.5;
            
            const s = STATE.audioCtx.createBufferSource();
            const g = STATE.audioCtx.createGain();
            s.buffer = this.buffers.fin;
            s.connect(g);
            g.connect(STATE.audioCtx.destination);
            
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(1, now + fadeInTime);
            
            s.start(now);
        }

        // FADE OUT SUR LA VOLÉE EN COURS
        const fadeOutTime = BELL_PARAMS[this.id].fadeOut || 1.0;
        
        if(this.activeGain) {
            try {
                this.activeGain.gain.cancelScheduledValues(now);
                this.activeGain.gain.setValueAtTime(this.activeGain.gain.value, now);
                this.activeGain.gain.linearRampToValueAtTime(0, now + fadeOutTime);
            } catch(e) {}
            
            const oldSource = this.activeSource;
            setTimeout(() => { if(oldSource) try{oldSource.stop();}catch(e){} }, fadeOutTime * 1000 + 100);
        }

        this.activeSource = null;
        this.activeGain = null;
        updateRelay(this.id, false);
        const btn = document.getElementById('btn-'+this.id);
        if(btn) btn.classList.remove('ringing');
    }

    // GESTION DES SEQUENCES AVEC FADE SPECIFIQUE
    _playSequence(type, customFadeIn = 0) {
        if(!this.isSwinging) return;

        const buf = (type === 'debut') ? this.buffers.debut : this.buffers.volee;
        if(!buf) return;

        const source = STATE.audioCtx.createBufferSource();
        const gainNode = STATE.audioCtx.createGain();
        
        source.buffer = buf;
        source.connect(gainNode);
        gainNode.connect(STATE.audioCtx.destination);
        
        const now = STATE.audioCtx.currentTime;
        
        // CALCUL DU FADE IN
        // Si customFadeIn est demandé (transition debut->volee), on l'utilise
        // Sinon, on met juste un micro fade (0.05s) pour éviter le clic numérique
        const fadeDuration = (customFadeIn > 0) ? customFadeIn : 0.05;
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1, now + fadeDuration);

        this.activeSource = source;
        this.activeGain = gainNode;

        source.start(now);

        const overlap = BELL_PARAMS[this.id].overlap || 0.5;
        const duration = buf.duration;
        const timeToNext = (duration - overlap) * 1000;

        // PREPARATION DE LA SUITE
        this.nextLoopTimer = setTimeout(() => {
            if(this.isSwinging) {
                // Si on vient de jouer 'debut', la prochaine est 'volee' AVEC UN FADE IN SPECIAL
                if(type === 'debut') {
                    // On récupère le paramètre volFadeIn de data.js
                    const vFade = BELL_PARAMS[this.id].volFadeIn || 0.5;
                    this._playSequence('volee', vFade);
                } else {
                    // Si on est déjà dans 'volee', on boucle normalement (juste anti-click)
                    this._playSequence('volee', 0);
                }
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