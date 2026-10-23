// =====================================================
// 1. CONSTANTS (numbers that never change while playing)
// =====================================================
const DAY_LENGTH = 60; // how long one day lasts, in seconds (used in milestone 5)

const GAME_WIDTH = 800;  // must match #game width in styles.css
const GAME_HEIGHT = 600; // must match #game height in styles.css

const TICK_MS = 30;        // the game loop runs every 30 milliseconds (about 33 times a second)
const PLAYER_SPEED = 3;    // pixels the player moves each tick (slow on purpose: walking is a chore!)
const PLAYER_HALF_SIZE = 20; // half the player's size, so they can't walk halfway out of the box

// Which direction each key moves the player.
// Keys are lowercase so 'W' (caps lock) and 'w' both work.
const KEY_DIRECTIONS = {
    w: 'up',
    arrowup: 'up',
    s: 'down',
    arrowdown: 'down',
    a: 'left',
    arrowleft: 'left',
    d: 'right',
    arrowright: 'right'
};

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
    // What the game is doing right now. Only 'playing' lets the player move.
    // (In milestone 6 the game will start as 'start' and wait for the Start button.)
    phase: 'playing',

    water: 60,     // village water level, from 0 to 100
    timeOfDay: 0,  // seconds since sunrise
    day: 1,        // days survived

    // The player is stored as an "entity" object.
    // Later, villagers will use this same shape.
    player: { id: 'player', x: 330, y: 345, carrying: false, task: null }
};

// Which directions are being held down right now.
// keydown sets these to true, keyup sets them back to false.
const heldDirections = { up: false, down: false, left: false, right: false };

// The ID of the game loop timer, so we can stop it later with clearInterval()
let loopId = null;

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

// Move the player one step based on which directions are held down.
function movePlayer() {
    // dx = change in x (left/right), dy = change in y (up/down)
    let dx = 0;
    let dy = 0;

    if (heldDirections.left) dx -= PLAYER_SPEED;
    if (heldDirections.right) dx += PLAYER_SPEED;
    if (heldDirections.up) dy -= PLAYER_SPEED;
    if (heldDirections.down) dy += PLAYER_SPEED;

    // Moving diagonally would be faster than moving straight,
    // so slow down a little when moving in two directions at once.
    if (dx !== 0 && dy !== 0) {
        dx *= 0.7;
        dy *= 0.7;
    }

    // Move, but keep the player inside the game box.
    // Math.max stops them going too far left/up, Math.min too far right/down.
    state.player.x = Math.min(Math.max(state.player.x + dx, PLAYER_HALF_SIZE), GAME_WIDTH - PLAYER_HALF_SIZE);
    state.player.y = Math.min(Math.max(state.player.y + dy, PLAYER_HALF_SIZE), GAME_HEIGHT - PLAYER_HALF_SIZE);

    renderPlayer();
}

// The game loop: runs every TICK_MS milliseconds and updates everything.
function gameLoop() {
    // Do nothing unless the game is being played
    if (state.phase !== 'playing') return;

    movePlayer();
}

// =====================================================
// 5. EVENT LISTENERS
// =====================================================

// When a key is pressed down, remember its direction
document.addEventListener('keydown', (event) => {
    const direction = KEY_DIRECTIONS[event.key.toLowerCase()];

    if (direction) {
        event.preventDefault(); // stop the arrow keys from scrolling the page
        heldDirections[direction] = true;
    }
});

// When a key is let go, forget its direction
document.addEventListener('keyup', (event) => {
    const direction = KEY_DIRECTIONS[event.key.toLowerCase()];

    if (direction) {
        heldDirections[direction] = false;
    }
});

// If the window loses focus (e.g. you click another app) while a key is held,
// the browser never sends keyup, so the player would keep walking forever.
// Let go of every direction to prevent that.
window.addEventListener('blur', () => {
    heldDirections.up = false;
    heldDirections.down = false;
    heldDirections.left = false;
    heldDirections.right = false;
});

// =====================================================
// 6. START-UP
// =====================================================
renderWorld(villageMap);
renderPlayer();
updateHUD();

// Start the game loop
loopId = setInterval(gameLoop, TICK_MS);
console.log('Milestone 2: use WASD or the arrow keys to move.');
