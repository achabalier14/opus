// =============================================================================
// 1. CONFIGURATION MATÉRIELLE
// =============================================================================
const BELL_SETUP = {
    1: { name: "C1 (Bourdon)", pathV: "Sons/Volée/Cloche 2/", pathT: "Sons/Tintements/2.mp3", overlap: 0.250 },
    2: { name: "C2 (Feriale)", pathV: "Sons/Volée/Cloche 3/", pathT: "Sons/Tintements/3.mp3", overlap: 0.250 },
    3: { name: "C3 (Moyenne)", pathV: "Sons/Volée/Cloche 4/", pathT: "Sons/Tintements/4.mp3", overlap: 0.081 },
    4: { name: "C4 (Petite)",  pathV: "Sons/Volée/Cloche 5/", pathT: "Sons/Tintements/5.mp3", overlap: 0.080 }
};

// =============================================================================
// 2. PARAMÈTRES UTILISATEUR (Modifiables via Menu)
// =============================================================================
const CLOCK_PARAMS = {
    mode: "AUTO", manualH: 12, manualM: 0, manualS: 0,
    chimeHour: true, chimeHalf: true, chimeQuarter: false,
    repeatHour: true, repeatHalf: false, repeatDelay: 2
};

const PROG_PARAMS = {
    ANGELUS_M: 8, ANGELUS_D: 12, ANGELUS_S: 19,
    DUR_ANGELUS_VOL: 180, 
    DUR_MESSE: 180, DUR_MARIAGE: 180, DUR_BAPTEME: 180,
    DUR_GLAS: 300, DUR_TOCSIN: 60
};

// =============================================================================
// 3. OUTILS GLOBAUX (Accessibles partout)
// =============================================================================
const USER_SCHEDULE = [];
const PROGRAMS = {}; // Le registre qui va recevoir les programmes des autres fichiers

const COMMON = {
    stopSignal: false,
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    log: (txt) => console.log(txt)
};

// HELPER : Fonction globale pour lancer des volées (utilisée par Messe, Mariage, etc.)
async function volleyHelper(bells, duration) {
    COMMON.log("VOLÉE: C" + bells.join('+') + " (" + duration + "s)");
    for(let id of bells) {
        if(COMMON.stopSignal) return;
        AUDIO.start(id);
        await COMMON.sleep(1500); // Galopade
    }
    let elapsed = 0;
    while(elapsed < duration * 1000) {
        if(COMMON.stopSignal) break;
        await COMMON.sleep(100);
        elapsed += 100;
    }
    for(let id of bells) AUDIO.stop(id);
}