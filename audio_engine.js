const ctx = new (window.AudioContext || window.webkitAudioContext)();

class BellChannel {
    constructor(id) {
        this.id = id;
        this.conf = BELL_SETUP[id];
        this.buffers = {};
        this.isPlaying = false;
        this.stopRequested = false;
    }

    async load() {
        try {
            this.buffers.tint = await this._fetch(this.conf.pathT);
            this.buffers.debut = await this._fetch(this.conf.pathV + 'debut.mp3');
            this.buffers.volee = await this._fetch(this.conf.pathV + 'volee.mp3');
            this.buffers.fin = await this._fetch(this.conf.pathV + 'fin.mp3');
            return true;
        } catch(e) { console.error("Erreur chargement C"+this.id, e); return false; }
    }

    async _fetch(url) {
        const r = await fetch(url);
        const b = await r.arrayBuffer();
        return await ctx.decodeAudioData(b);
    }

    tinte() {
        if(ctx.state === 'suspended') ctx.resume();
        if(this.buffers.tint) this._play(this.buffers.tint);
        this._flashLED();
    }

    startVolley() {
        if(this.isPlaying) return;
        if(ctx.state === 'suspended') ctx.resume();
        this.isPlaying = true;
        this.stopRequested = false;
        this._flashLED(true); // LED fixe

        // Intro
        this.nextTime = ctx.currentTime;
        this._play(this.buffers.debut, this.nextTime);
        this.nextTime += (this.buffers.debut.duration - this.conf.overlap);
        this._scheduleLoop();
    }

    requestStop() {
        if(this.isPlaying) this.stopRequested = true;
    }

    _scheduleLoop() {
        while(this.nextTime < ctx.currentTime + 0.1) {
            if(this.stopRequested) {
                this._play(this.buffers.volee, this.nextTime);
                let finTime = this.nextTime + (this.buffers.volee.duration - this.conf.overlap);
                this._play(this.buffers.fin, finTime);
                this.isPlaying = false;
                this._flashLED(false); // LED off
                return;
            } else {
                this._play(this.buffers.volee, this.nextTime);
                this.nextTime += (this.buffers.volee.duration - this.conf.overlap);
            }
        }
        if(this.isPlaying) setTimeout(() => this._scheduleLoop(), 25);
    }

    _play(buf, t=0) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.connect(ctx.destination);
        s.start(t || ctx.currentTime);
    }

    _flashLED(state) {
        const led = document.getElementById(`led-${this.id}`);
        if(state === true) led.classList.add('active');
        else if(state === false) led.classList.remove('active');
        else {
            led.classList.add('active');
            setTimeout(()=>led.classList.remove('active'), 200);
        }
    }
}

const AUDIO = {
    engines: {},
    init: async () => {
        const p = [];
        for(let i=1; i<=4; i++) { 
            AUDIO.engines[i] = new BellChannel(i); 
            p.push(AUDIO.engines[i].load()); 
        }
        await Promise.all(p);
        COMMON.log("AUDIO PRÊT");
    },
    tinte: (id) => AUDIO.engines[id].tinte(),
    start: (id) => AUDIO.engines[id].startVolley(),
    stop: (id) => AUDIO.engines[id].requestStop(),
    stopAll: () => { for(let i=1; i<=4; i++) AUDIO.stop(i); }
};