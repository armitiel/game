/**
 * Simple i18n system — auto-detects browser language, falls back to English.
 * Usage: import { t } from './i18n.js';  then t('key')
 */

const translations = {
  pl: {
    // Menu
    subtitle: 'Maluj miasto. Kryj sie w cieniu.',
    tapToStart: '[ DOTKNIJ BY ZACZAC ]',
    spaceToStart: '[ NACISNIJ SPACJE BY ZACZAC ]',
    controlsMobile: 'D-pad: ruch   JUMP: skok   ACT: maluj   E: interakcja',
    controlsDesktop1: 'STRZALKI: Ruch   SPACJA: Skok   E: Maluj/Podnieś',
    controlsDesktop2: 'GORA/DOL na drabinie   Ukryj sie w cieniu przed policja',
    visitors: 'odwiedziny',
    lastUpdate: 'aktualizacja',

    // Level select
    chooseMode: 'WYBIERZ TRYB',
    chooseLevel: 'WYBIERZ LEVEL',
    stealthName: 'STEALTH',
    stealthDesc: 'Uciekaj przed policja\ni maluj murale w cieniu',
    puzzleName: 'PUZZLE',
    puzzleDesc: 'Uzyj drabin i koszy\nby dotrzec do murali',
    towerName: 'WIEZA',
    towerDesc: 'Wspinaj sie w gore\nczas ucieka!',
    levelCount: 'Level',
    tutorial: '[ TUTORIAL ]',
    modeSelectHint: '[ Kliknij tryb lub nacisnij 1-3 | T = tutorial | ESC = menu ]',
    levelSelectHint: '[ Kliknij level | ESC = tryby ]',

    // Intro
    skipHint: '[ SPACJA / TAP — POMIN ]',

    // Win
    levelComplete: 'LEVEL UKONCZONY',
    winSubtitle: 'Miasto jest Twoim plotnem.',
    tapReplay: '[ TAP - Zagraj ponownie ]',
    spaceReplay: '[ SPACE - Zagraj ponownie ]',
    mainMenu: '[ M - Menu glowne ]',

    // Boot
    loading: 'Ladowanie...',

    // Game — tower
    timeUp: 'CZAS MINAL!',
    newColor: 'NOWY KOLOR',

    // Game — tutorial
    tutWelcome: 'TUTORIAL',
    bravo: ['Brawo!', 'Swietnie!', 'Super!', 'Dobrze!', 'Tak trzymaj!'],

    // Game — tutorial overlays (mobile)
    tutMoveJoystick: 'Przeciagnij joystick ← →',
    tutJump: 'Nacisnij przycisk JUMP!',
    tutLadderE: 'Drabina ↑↓ | E = kosz',
    tutCollectPaint: 'Przejdz obok puszek by je zebrac!',
    tutPaintACT: 'Podejdz do muralu i nacisnij ACT!',

    // Game — tutorial overlays (desktop)
    tutMove: 'poruszanie',
    tutJumpWord: 'skok',
    tutLadder: 'drabina',
    tutPushCrate: 'przesun kosz',
    tutCollectPaintDesktop: 'Zbierz puszki z farba — przejdz obok!',
    tutPaintMural: '= maluj mural',

    // Game — status bar hints
    painting: 'MALOWANIE',
    paintColor: 'Kolor',
    paintCancel: 'SPACE anuluj',
    movingLadder: 'PRZESUWANIE DRABINY — E pusc',
    movingCrate: 'PRZESUWANIE KOSZA — E pusc',
    paintMural: 'SPACE: maluj mural',
    noPaint: 'brak farb',
    climbLadder: '\u2191/W: wejdz na drabine',
    descendLadder: '\u2193/S: zejdz po drabinie',
    grabLadder: 'E: chwytaj drabine',
    hideInShadow: '\u2193/S: ukryj sie w cieniu',
    needPaint: 'Potrzebujesz farb',
    tagged: 'TAGGED!',

    // Levels
    lvlTutorial: 'Tutorial',
    lvlTutorialDesc: 'Naucz sie podstaw gry',
    lvlStreet: 'Ulica',
    lvlStreetDesc: 'Pomaluj dwa murale w miescie',
    lvlSkyscraper: 'Wiezowiec',
    lvlSkyscraperDesc: 'Pokoloruj wielki mural na scianie wiezowca',
    lvlPuzzle: 'Lamiglowka',
    lvlPuzzleDesc: 'Przesuwaj kosze, buduj mosty i znajdz droge do murali',
    lvlTower: 'Wieza',
    lvlTowerDesc: 'Wspinaj sie i maluj — czas ucieka!',

    // Tutorial hints (levels.js)
    tutHintMove: 'Uzyj ← → by sie poruszac',
    tutHintMoveMobile: 'Przeciagnij joystick w lewo/prawo',
    tutHintJump: 'Nacisnij ↑ lub SPACJE by skoczyc!',
    tutHintJumpMobile: 'Nacisnij przycisk JUMP by skoczyc!',
    tutHintLadder: 'Wejdz na drabine (↑↓) | E = przesun kosz',
    tutHintLadderMobile: 'Joystick ↑↓ = drabina | przycisk E = kosz',
    tutHintCollect: 'Zbierz puszki z farba!',
    tutHintPaint: 'Podejdz do muralu i nacisnij SPACJE!',
    tutHintPaintMobile: 'Podejdz do muralu i nacisnij ACT!',

    // PWA
    pwaInstall: 'Zainstaluj Shadow Tagger na ekranie!',
    pwaInstallBtn: 'Instaluj',
    pwaIosTitle: 'Zainstaluj Shadow Tagger',
    pwaIosStep1: 'na pasku Safari',
    pwaIosStep2: 'Na ekranie poczatkowym',
    pwaIosStep3: 'Gotowe!',
    pwaIosTapAdd: 'Dodaj',
    pwaOpenSafari: 'Otworz w <strong>Safari</strong> aby zainstalowac jako aplikacje',

    // Rotate overlay
    rotatePrimary: 'Obroc telefon do pozycji poziomej',
    rotateSecondary: 'Rotate your phone to landscape',
  },

  en: {
    // Menu
    subtitle: 'Paint the city. Stay in the shadows.',
    tapToStart: '[ TAP TO START ]',
    spaceToStart: '[ PRESS SPACE TO START ]',
    controlsMobile: 'D-pad: move   JUMP: jump   ACT: paint   E: interact',
    controlsDesktop1: 'ARROWS: Move   SPACE: Jump   E: Paint/Pickup',
    controlsDesktop2: 'UP/DOWN on ladder   Hide in shadows to avoid cops',
    visitors: 'visitors',
    lastUpdate: 'last update',

    // Level select
    chooseMode: 'CHOOSE MODE',
    chooseLevel: 'CHOOSE LEVEL',
    stealthName: 'STEALTH',
    stealthDesc: 'Escape the cops\nand paint murals in the shadows',
    puzzleName: 'PUZZLE',
    puzzleDesc: 'Use ladders and crates\nto reach the murals',
    towerName: 'TOWER',
    towerDesc: 'Climb up and paint\ntime is running out!',
    levelCount: 'Level',
    tutorial: '[ TUTORIAL ]',
    modeSelectHint: '[ Click a mode or press 1-3 | T = tutorial | ESC = menu ]',
    levelSelectHint: '[ Click a level | ESC = modes ]',

    // Intro
    skipHint: '[ SPACE / TAP — SKIP ]',

    // Win
    levelComplete: 'LEVEL COMPLETE',
    winSubtitle: 'The city is your canvas.',
    tapReplay: '[ TAP - Play again ]',
    spaceReplay: '[ SPACE - Play again ]',
    mainMenu: '[ M - Main menu ]',

    // Boot
    loading: 'Loading...',

    // Game — tower
    timeUp: 'TIME\'S UP!',
    newColor: 'NEW COLOR',

    // Game — tutorial
    tutWelcome: 'TUTORIAL',
    bravo: ['Bravo!', 'Great!', 'Awesome!', 'Nice!', 'Keep it up!'],

    // Game — tutorial overlays (mobile)
    tutMoveJoystick: 'Drag joystick ← →',
    tutJump: 'Press the JUMP button!',
    tutLadderE: 'Ladder ↑↓ | E = crate',
    tutCollectPaint: 'Walk near the cans to collect them!',
    tutPaintACT: 'Approach the mural and press ACT!',

    // Game — tutorial overlays (desktop)
    tutMove: 'movement',
    tutJumpWord: 'jump',
    tutLadder: 'ladder',
    tutPushCrate: 'push crate',
    tutCollectPaintDesktop: 'Collect paint cans — walk near them!',
    tutPaintMural: '= paint mural',

    // Game — status bar hints
    painting: 'PAINTING',
    paintColor: 'Color',
    paintCancel: 'SPACE cancel',
    movingLadder: 'MOVING LADDER — E release',
    movingCrate: 'MOVING CRATE — E release',
    paintMural: 'SPACE: paint mural',
    noPaint: 'no paint',
    climbLadder: '\u2191/W: climb ladder',
    descendLadder: '\u2193/S: descend ladder',
    grabLadder: 'E: grab ladder',
    hideInShadow: '\u2193/S: hide in shadow',
    needPaint: 'You need paint',
    tagged: 'TAGGED!',

    // Levels
    lvlTutorial: 'Tutorial',
    lvlTutorialDesc: 'Learn the basics',
    lvlStreet: 'Street',
    lvlStreetDesc: 'Paint two murals in the city',
    lvlSkyscraper: 'Skyscraper',
    lvlSkyscraperDesc: 'Paint a large mural on the skyscraper wall',
    lvlPuzzle: 'Puzzle',
    lvlPuzzleDesc: 'Move crates, build bridges and find your way to the murals',
    lvlTower: 'Tower',
    lvlTowerDesc: 'Climb and paint — time is running out!',

    // Tutorial hints (levels.js)
    tutHintMove: 'Use ← → to move',
    tutHintMoveMobile: 'Drag the joystick left/right',
    tutHintJump: 'Press ↑ or SPACE to jump!',
    tutHintJumpMobile: 'Press the JUMP button to jump!',
    tutHintLadder: 'Climb the ladder (↑↓) | E = push crate',
    tutHintLadderMobile: 'Joystick ↑↓ = ladder | E button = crate',
    tutHintCollect: 'Collect the paint cans!',
    tutHintPaint: 'Approach the mural and press SPACE!',
    tutHintPaintMobile: 'Approach the mural and press ACT!',

    // PWA
    pwaInstall: 'Install Shadow Tagger on your screen!',
    pwaInstallBtn: 'Install',
    pwaIosTitle: 'Install Shadow Tagger',
    pwaIosStep1: 'on the Safari toolbar',
    pwaIosStep2: 'Add to Home Screen',
    pwaIosStep3: 'Done!',
    pwaIosTapAdd: 'Add',
    pwaOpenSafari: 'Open in <strong>Safari</strong> to install as an app',

    // Rotate overlay
    rotatePrimary: 'Rotate your phone to landscape',
    rotateSecondary: '',
  }
};

// Detect language: check localStorage override, then URL param, then browser language
function detectLang() {
  const stored = localStorage.getItem('st_lang');
  if (stored && translations[stored]) return stored;

  const params = new URLSearchParams(window.location.search);
  const param = params.get('lang');
  if (param && translations[param]) {
    localStorage.setItem('st_lang', param);
    return param;
  }

  const browserLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return translations[browserLang] ? browserLang : 'en';
}

let currentLang = detectLang();

export function t(key) {
  return translations[currentLang]?.[key] ?? translations.en[key] ?? key;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('st_lang', lang);
  }
}
