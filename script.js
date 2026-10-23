// =====================================================
// 1. CONSTANTS (numbers that never change while playing)
// =====================================================
const DAY_LENGTH = 60; // how long one day lasts, in seconds (used in milestone 5)

// Which emoji to show for each type of map object.
// The water hole is drawn with CSS, so it has no emoji.
const SPRITES = {
    house: '🛖',
    tree: '🌳',
    'water-hole': ''
};

// =====================================================
// 2. GAME STATE (everything that changes while playing)
// =====================================================
const state = {
    water: 60,     // village water level, from 0 to 100
    timeOfDay: 0,  // seconds since sunrise
    day: 1,        // days survived

    // The player is stored as an "entity" object.
    // Later, villagers will use this same shape.
    player: { id: 'player', x: 330, y: 345, carrying: false, task: null }
};

// The village screen. x and y are the CENTER of each object, in pixels,
// measured from the top-left corner of the 800 x 600 game box.
const villageMap = [
    // Houses (left side)
    { type: 'house', x: 230, y: 110 },
    { type: 'house', x: 170, y: 195 },
    { type: 'house', x: 295, y: 205 },
    { type: 'house', x: 170, y: 300 },
    { type: 'house', x: 270, y: 300 },
    { type: 'house', x: 390, y: 290 },
    { type: 'house', x: 230, y: 430 },

    // Trees (right side)
    { type: 'tree', x: 450, y: 90 },
    { type: 'tree', x: 510, y: 125 },
    { type: 'tree', x: 590, y: 80 },
    { type: 'tree', x: 700, y: 105 },
    { type: 'tree', x: 480, y: 215 },
    { type: 'tree', x: 600, y: 210 },
    { type: 'tree', x: 670, y: 185 },
    { type: 'tree', x: 740, y: 230 },
    { type: 'tree', x: 720, y: 320 },
    { type: 'tree', x: 470, y: 370 },
    { type: 'tree', x: 550, y: 420 },

    // Water source (bottom-right)
    { type: 'water-hole', x: 660, y: 470 }
];

// =====================================================
// 3. DOM REFERENCES (elements we change from JavaScript)
// =====================================================
const worldEl = document.getElementById('world');
const playerEl = document.getElementById('player');
const dayFillEl = document.getElementById('day-fill');
const waterFillEl = document.getElementById('water-fill');
const dayCounterEl = document.getElementById('day-counter');

// =====================================================
// 4. FUNCTIONS
// =====================================================

// Draw every object in a map (an array of { type, x, y }) into the world.
function renderWorld(mapData) {
    // Remove whatever was drawn before
    worldEl.innerHTML = '';

    mapData.forEach((item) => {
        const el = document.createElement('div');
        el.className = `sprite ${item.type}`;
        el.textContent = SPRITES[item.type];
        el.style.left = `${item.x}px`;
        el.style.top = `${item.y}px`;
        worldEl.appendChild(el);
    });
}

// Move the player's <div> to match the player's x and y in the state.
function renderPlayer() {
    playerEl.style.left = `${state.player.x}px`;
    playerEl.style.top = `${state.player.y}px`;
}

// Update the HUD meters and day counter so they match the state.
function updateHUD() {
    // Water bar: width matches the water level (0–100%)
    waterFillEl.style.width = `${state.water}%`;

    // Daylight bar: full at sunrise, empty at sunset
    const daylightLeft = 100 - (state.timeOfDay / DAY_LENGTH) * 100;
    dayFillEl.style.height = `${daylightLeft}%`;

    dayCounterEl.textContent = `Day ${state.day}`;
}

// =====================================================
// 5. START-UP
// =====================================================
renderWorld(villageMap);
renderPlayer();
updateHUD();
console.log('Milestone 1: world and HUD drawn.');
