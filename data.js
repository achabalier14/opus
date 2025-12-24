// =============================================================================
// DATA.JS - CONFIGURATION ET DONNEES (V103)
// =============================================================================

const BELL_PARAMS = { 
    1: { name: "Bourdon",        overlap: 1.0, fadeOut: 1.5, fadeIn: 0.8, volFadeIn: 0.5 }, 
    2: { name: "Cloche 2 (1m51)", overlap: 1.0, fadeOut: 1.5, fadeIn: 0.8, volFadeIn: 0.8 }, 
    3: { name: "Cloche 3 (1m47)", overlap: 1.0, fadeOut: 1.5, fadeIn: 0.8, volFadeIn: 0.8 }, 
    4: { name: "Cloche 4 (1m50)", overlap: 1.0, fadeOut: 1.5, fadeIn: 0.8, volFadeIn: 0.8 }, 
    5: { name: "Cloche 5 (2m00)", overlap: 1.0, fadeOut: 1.5, fadeIn: 0.8, volFadeIn: 0.8 } 
};

const AUDIO_FILES = {
    1: "Sons/Cloche 2/", 
    2: "Sons/Cloche 3/", 
    3: "Sons/Cloche 4/", 
    4: "Sons/Cloche 5/", 
    5: "Sons/Cloche 6/"
};

// Configurations des Programmes Prédéfinis (Legacy pour migration)
let PRESET_CONFIGS = {
    "MESSE": { 1: {active:false}, 2: {active:true}, 3: {active:true}, 4: {active:true}, 5: {active:false} },
    "MARIAGE": { 1: {active:false}, 2: {active:true}, 3: {active:true}, 4: {active:true}, 5: {active:true} },
    "BAPTEME": { 1: {active:false}, 2: {active:false}, 3: {active:true}, 4: {active:true}, 5: {active:true} },
    "PLENUM": { 1: {active:true}, 2: {active:true}, 3: {active:true}, 4: {active:true}, 5: {active:true} },
    "ANGELUS": { 1: {active:false}, 2: {active:true}, 3: {active:false}, 4: {active:false}, 5: {active:false} }
};

let SETTINGS = {
    // Horloge
    clock_mode: "AUTO", 
    time_h: 12, time_m: 0, time_s: 0, 
    date_d: 21, date_m: 12, date_y: 2025,
    
    // Urgence
    emergency_mode: false,

    // Automatisations
    angelus_times: [ {h: 8, m: 3, s: 0}, {h: 12, m: 3, s: 0}, {h: 19, m: 3, s: 0} ],

    auto_h: { on: true, rep: false, del: 120, int: 2.25 }, 
    auto_m: { on: true, rep: false, del: 120 },
    auto_q: { on: false, rep: false, del: 120 },
    
    // Mode Nuit
    night_mode: true,
    night_start_h: 22, night_start_m: 0, 
    night_end_h: 7, night_end_m: 0,
    
    // Durées par défaut (Legacy)
    dur_angelus: 30, dur_messe: 180, dur_mariage: 180, dur_plenum: 300,   
    dur_bapteme: 180, dur_glas: 300, dur_tedeum: 180, dur_tocsin: 60,

    // STOCKAGE DES TIMELINES (SEQUENCES)
    timelines: {
        "GLAS": [
            { type: "SEQ", duration: 20, mode:"TIME", repeat:1, steps: [ {bell:1, wait:5.0} ], parallel: false },
            { type: "SEQ", duration: 0, mode:"TIME", repeat:1, steps: [ {bell:1, wait:2.0}, {bell:2, wait:2.0} ], parallel: false }
        ],
        "TOCSIN": [
            { type: "SEQ", duration: 0, mode:"TIME", repeat:1, steps: [ {bell:2, wait:0.25}, {bell:3, wait:0.25} ], parallel: false }
        ]
    }
};

const PRESET_NAMES = ["MESSE", "MARIAGE", "BAPTEME", "PLENUM", "ANGELUS", "GLAS", "TE_DEUM", "TOCSIN"]; 
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
    selectedPreset: "PLENUM",
    selectedBellConfig: 1,
    
    // Variables pour l'éditeur de Timeline
    editingTimelineName: null, 
    editingBlockIndex: -1,

    // Editeurs Popup
    timeEditor: { active: false, targetField: null, type: "TIME", vals:[], labels:[], cursor: 0, blockInput: false },
    repEditor: { active: false, isEditing: false, interval: 1, unitIdx: 3, days: [0], endTypeIdx: 0, endVal: 10, endD: 1, endM: 1, endY: 2025, cursor: 0, subCursor: 0, monthMode: 0, refDay: 1, refNth: 1, refWeekday: 0 },
    
    // Etats système
    isChiming: false, manualMode: "TINT", manualDateObj: null,
    
    // Sécurité
    lockedBells: [false, false, false, false, false, false]
};

// Fonctions utilitaires globales
function pad(v) { return String(v).padStart(2,'0'); }
function secToMinSec(sec) { 
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
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