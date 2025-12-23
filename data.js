// =============================================================================
// DATA.JS - CONFIGURATION (V77 - MAJ DERNIERE CLOCHE / CLOCHE 5)
// =============================================================================

const BELL_PARAMS = { 
    // cutTime: 0.15s (Arrêt net et propre pour éviter le double coup)
    
    // CLOCHE 1 (Volée ~57s)
    1: { name: "Cloche 1 (57s)", overlap: 0.200, cutTime: 0.15 }, 
    
    // CLOCHE 2 (Volée ~111s)
    2: { name: "Cloche 2 (1m51)", overlap: 0.200, cutTime: 0.15 }, 
    
    // CLOCHE 3 (Volée ~107s)
    3: { name: "Cloche 3 (1m47)", overlap: 0.200, cutTime: 0.15 }, 
    
    // CLOCHE 4 (Volée ~110s)
    4: { name: "Cloche 4 (1m50)", overlap: 0.200, cutTime: 0.15 }, 
    
    // CLOCHE 5 (Mise à jour : Volée ~111s / 1m51)
    5: { name: "Cloche 5 (1m51)", overlap: 0.200, cutTime: 0.15 } 
};

const AUDIO_FILES = {
    // RAPPEL DE L'ORGANISATION DES DOSSIERS
    
    // Bouton 1 -> Dossier Cloche 2
    1: "Sons/Cloche 2/",  
    
    // Bouton 2 -> Dossier Cloche 3
    2: "Sons/Cloche 3/",  
    
    // Bouton 3 -> Dossier Cloche 4
    3: "Sons/Cloche 4/",  
    
    // Bouton 4 -> Dossier Cloche 5
    4: "Sons/Cloche 5/",  
    
    // Bouton 5 -> Dossier Cloche 6 (Celle que vous venez de modifier)
    5: "Sons/Cloche 6/"   
};

let SETTINGS = {
    clock_mode: "AUTO", 
    time_h: 12, time_m: 0, time_s: 0, 
    date_d: 21, date_m: 12, date_y: 2025,
    emergency_mode: false,

    angelus_times: [
        {h: 8, m: 3, s: 0},
        {h: 12, m: 3, s: 0},
        {h: 19, m: 3, s: 0}
    ],

    auto_h: { on: true, rep: false, del: 120, int: 2.25 }, 
    auto_m: { on: true, rep: false, del: 120 },
    auto_q: { on: false, rep: false, del: 120 },
    
    night_mode: true,
    night_start_h: 22, night_start_m: 0, 
    night_end_h: 7, night_end_m: 0,
    
    dur_angelus: 30,   
    dur_messe: 180,    
    dur_mariage: 180,  
    dur_plenum: 300,   
    dur_bapteme: 180,  
    dur_glas: 300,     
    dur_tedeum: 180,   
    dur_tocsin: 180    
};

const PRESET_NAMES = ["MESSE", "MARIAGE", "BAPTEME", "ANGELUS", "GLAS", "PLENUM", "GLAS_H", "GLAS_F", "TE_DEUM", "TOCSIN"];
const REP_UNITS = ["MIN", "HEURE", "JOUR", "SEM", "MOIS", "AN"];
const REP_END_TYPES = ["JAMAIS", "DATE", "NB FOIS"];

const DAYS_LABELS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const MONTHS_LABELS = ["JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE"];

let SCHEDULE = [];
let LIBRARY = [];
let ACTIVE_LOOPS = [];

const STATE = {
    audioCtx: null, engines: {}, stopSignal: false, relays: [0,0,0,0,0],
    menuStack: ["HOME"], cursor: 0, bellCursor: 1, 
    formData: null, editingIndex: -1, editingLibrary: false, editingAngelusIdx: -1, tempAngelus: {h:0, m:0, s:0},
    timeEditor: { active: false, targetField: null, type: "TIME", vals:[], labels:[], cursor: 0, blockInput: false },
    repEditor: { active: false, isEditing: false, interval: 1, unitIdx: 3, days: [0], endTypeIdx: 0, endVal: 10, endD: 1, endM: 1, endY: 2025, cursor: 0, subCursor: 0, monthMode: 0, refDay: 1, refNth: 1, refWeekday: 0 },
    isChiming: false, manualMode: "TINT", manualDateObj: null
};

function pad(v) { return String(v).padStart(2,'0'); }
function secToMinSec(sec) { 
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
    return `${pad(m)}m ${pad(s)}s`;
}
function getHomeDateStr() {
    const dateObj = new Date(SETTINGS.date_y, SETTINGS.date_m-1, SETTINGS.date_d);
    const jsDay = dateObj.getDay(); const frDayIndex = (jsDay + 6) % 7; 
    return `${DAYS_LABELS[frDayIndex]} ${pad(SETTINGS.date_d)} ${MONTHS_LABELS[SETTINGS.date_m-1]} ${SETTINGS.date_y}`;
}
function getHeaderDateStr() { return `${pad(SETTINGS.date_d)}/${pad(SETTINGS.date_m)}/${SETTINGS.date_y}`; }
function getCurrentDateStr() { return getHeaderDateStr(); }
const wait = (ms) => new Promise(r=>setTimeout(r,ms));