// =============================================================================
// AUDIO.JS - MOTEUR AUDIO (V71 - CHARGEMENT SIMPLIFIE)
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
            // On récupère le dossier (ex: "Sons/Cloche 2/")
            const folder = AUDIO_FILES[this.id];
            
            // On charge les 4 fichiers standardisés
            this.buffers.tint  = await this._fetch(folder + 'tintement.mp3');
            this.buffers.debut = await this._fetch(folder + 'debut.mp3');
            this.buffers.volee = await this._fetch(folder + 'volee.mp3');
            this.buffers.fin   = await this._fetch(folder + 'fin.mp3');
            
        } catch(e) { console.log("Audio manquant ou erreur cloche " + this.id, e); }
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
        if(this.buffers.tint) this._playOneShot(this.buffers.tint);
    }

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

    stopVolley() { 
        if(!this.isSwinging) return;
        
        if(this.nextLoopTimer) clearTimeout(this.nextLoopTimer);
        this.isSwinging = false;

        // Lancement immédiat de la fin
        if(this.buffers.fin) {
            this._playOneShot(this.buffers.fin);
        }

        // Coupure rapide de la volée (cutTime)
        const cutTime = BELL_PARAMS[this.id].cutTime || 0.15;
        
        if(this.activeGain) {
            try {
                const now = STATE.audioCtx.currentTime;
                this.activeGain.gain.cancelScheduledValues(now);
                this.activeGain.gain.setValueAtTime(this.activeGain.gain.value, now);
                this.activeGain.gain.linearRampToValueAtTime(0, now + cutTime);
            } catch(e) {}
            
            const oldSource = this.activeSource;
            setTimeout(() => { if(oldSource) try{oldSource.stop();}catch(e){} }, cutTime * 1000 + 50);
        }

        this.activeSource = null;
        this.activeGain = null;
        updateRelay(this.id, false);
        const btn = document.getElementById('btn-'+this.id);
        if(btn) btn.classList.remove('ringing');
    }

    _playSequence(type) {
        if(!this.isSwinging) return;

        const buf = (type === 'debut') ? this.buffers.debut : this.buffers.volee;
        if(!buf) return;

        const source = STATE.audioCtx.createBufferSource();
        const gainNode = STATE.audioCtx.createGain();
        
        source.buffer = buf;
        source.connect(gainNode);
        gainNode.connect(STATE.audioCtx.destination);
        
        this.activeSource = source;
        this.activeGain = gainNode;

        source.start(0);

        const overlap = BELL_PARAMS[this.id].overlap || 0.1;
        const duration = buf.duration;
        const timeToNext = (duration - overlap) * 1000;

        this.nextLoopTimer = setTimeout(() => {
            if(this.isSwinging) {
                this._playSequence('volee'); 
            }
        }, timeToNext);
    }

    _playOneShot(buf) {
        const s = STATE.audioCtx.createBufferSource(); 
        s.buffer = buf; 
        s.connect(STATE.audioCtx.destination); 
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