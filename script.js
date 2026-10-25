// =====================================================
// 1. CONSTANTS (numbers that never change while playing)
// =====================================================
const DAY_LENGTH = 20;      // how long daytime lasts, in seconds
const NIGHT_LENGTH = 2.5;  // how long night lasts, in seconds
const DAYS_TO_WIN = 4;  // survive this many days and charity: water builds a pump

// Where the player starts, and where they're sent back to at night
const HOME_POSITION = { x: 330, y: 345 };

const GAME_WIDTH = 800;  // must match #game width in styles.css
const GAME_HEIGHT = 600; // must match #game height in styles.css

const TICK_MS = 30;        // the game loop runs every 30 milliseconds (about 33 times a second)
const PLAYER_SPEED = 4;    // pixels the player moves each tick (slow-ish on purpose: walking is a chore!)
const PLAYER_HALF_SIZE = 20; // half the player's size, so they can't walk halfway out of the box

const DRAIN_PER_SECOND = 1;        // how much village water is used up each second during the day (out of 100)
const NIGHT_DRAIN_PER_SECOND = 0.5; // water still gets used at night, just less
const LOW_WATER_LEVEL = 25;  // below this, the water bar turns red as a warning

const WATER_PER_TRIP = 15;     // how much one bucket adds to the village water (out of 100)
const INTERACT_DISTANCE = 90;  // how close (in pixels) the player must be to use something

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
    'water-hole': '',
    pump: '' // drawn with an image in styles.css
};

// =====================================================
// 2. GAME STATE (everything that changes while playing)
// =====================================================
// Build a brand-new copy of the starting game state.
// It's a function so resetGame() can get a fresh copy every time someone plays again.
function createStartingState() {
    return {
        // What the game is doing right now:
        // 'start' (waiting for Start button), 'playing', 'night', 'won' or 'lost'.
        // Only 'playing' lets the player move.
        phase: 'start',

        water: 60,     // village water level, from 0 to 100
        timeOfDay: 0,  // seconds since sunrise
        nightTime: 0,  // seconds since nightfall (only counts during the night)
        day: 1,        // days survived

        // The player is stored as an "entity" object.
        // Later, villagers will use this same shape.
        player: { id: 'player', x: HOME_POSITION.x, y: HOME_POSITION.y, carrying: false, task: null },

        // Wells and pumps built in the village. They're drawn on the map with the houses and trees.
        // Empty at the start; charity: water's pump is added when you win.
        wells: []
    };
}

// 'let' instead of 'const' because resetGame() replaces it with a fresh copy
let state = createStartingState();

// Which directions are being held down right now.
// keydown sets these to true, keyup sets them back to false.
const heldDirections = { up: false, down: false, left: false, right: false };

// The ID of the game loop timer, so we can stop it later with clearInterval()
let loopId = null;

// The ID of the timer that shows the win screen, so Reset can cancel it with clearTimeout()
let winTimeoutId = null;

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
const loseScreenEl = document.getElementById('lose-screen');
const loseMessageEl = document.getElementById('lose-message');
const tryAgainBtn = document.getElementById('try-again-btn');
const carryIconEl = document.getElementById('carry-icon');
const promptEl = document.getElementById('prompt');
const nightOverlayEl = document.getElementById('night-overlay');
const messageBoxEl = document.getElementById('message-box');
const winScreenEl = document.getElementById('win-screen');
const playAgainBtn = document.getElementById('play-again-btn');
const startScreenEl = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');

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

    // Show the water can only while carrying water
    carryIconEl.classList.toggle('hidden', !state.player.carrying);
}

// Distance in pixels between two things that have x and y (like the player and a house).
function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy); // Pythagorean theorem: √(dx² + dy²)
}

// Is the player close enough to the water hole to fill their bucket?
function isNearWater() {
    const waterHole = villageMap.find((item) => item.type === 'water-hole');
    return getDistance(state.player, waterHole) < INTERACT_DISTANCE;
}

// Is the player close enough to ANY house to deliver water?
// .some() returns true if at least one item in the array passes the test.
function isNearVillage() {
    return villageMap.some((item) => item.type === 'house' && getDistance(state.player, item) < INTERACT_DISTANCE);
}

// Show a hint above the player's head when they can do something.
function updatePrompt() {
    // No hints unless the player can actually do something
    if (state.phase !== 'playing') {
        promptEl.classList.add('hidden');
        return;
    }

    let message = '';

    if (isNearWater() && !state.player.carrying) {
        message = 'Press ENTER to collect water';
    } else if (isNearWater() && state.player.carrying) {
        message = 'Your bucket is full! Bring it to the village';
    } else if (isNearVillage() && state.player.carrying) {
        message = 'Press ENTER to deliver water';
    }

    promptEl.textContent = message;
    promptEl.classList.toggle('hidden', message === '');

    // Place the prompt just above the player
    promptEl.style.left = `${state.player.x}px`;
    promptEl.style.top = `${state.player.y - 45}px`;
}

// What happens when the player presses ENTER.
function handleInteract() {
    if (isNearWater() && !state.player.carrying) {
        // Fill the bucket (you can only carry one at a time)
        state.player.carrying = true;
        console.log('Collected water! Bring it back to the village.');
    } else if (isNearVillage() && state.player.carrying) {
        // Empty the bucket into the village. Math.min keeps water at 100 or less.
        state.water = Math.min(state.water + WATER_PER_TRIP, 100);
        state.player.carrying = false;
        console.log(`Delivered water! Village water is now ${Math.round(state.water)}%.`);
    }

    renderPlayer();
    updateHUD();
}

// Update the HUD meters so they match the state.
// (The day counter has its own function below, since it only changes once a day.)
function updateHUD() {
    // Water bar: width matches the water level (0–100%)
    waterFillEl.style.width = `${state.water}%`;

    // Turn the bar red when water is low (toggle adds the class if true, removes it if false)
    waterFillEl.classList.toggle('low', state.water < LOW_WATER_LEVEL);

    // Daylight bar: full at sunrise, empty at sunset
    const daylightLeft = 100 - (state.timeOfDay / DAY_LENGTH) * 100;
    dayFillEl.style.height = `${daylightLeft}%`;
}

// Show the new day number and make it "pop" (grow, then shrink back).
function updateDayCounter() {
    dayCounterEl.textContent = `Day ${state.day}`;

    // Adding the 'pop' class starts the CSS animation.
    // It's removed again when the animation ends (see the 'animationend' listener).
    dayCounterEl.classList.add('pop');
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

// Use up a little of the village's water. Called once per tick.
// ratePerSecond is DRAIN_PER_SECOND in the day, NIGHT_DRAIN_PER_SECOND at night.
function drainWater(ratePerSecond) {
    // The rate is per second, but a tick is only TICK_MS long,
    // so only drain that fraction of a second's worth.
    const drainThisTick = ratePerSecond * (TICK_MS / 1000);

    // Math.max keeps the water from going below 0
    state.water = Math.max(state.water - drainThisTick, 0);
}

// Show a message at the top of the game box.
function showMessage(text) {
    messageBoxEl.textContent = text;
    messageBoxEl.classList.remove('hidden');
}

function hideMessage() {
    messageBoxEl.classList.add('hidden');
}

// Move the daytime clock forward one tick. When the day is over, start the night.
function advanceDay() {
    state.timeOfDay += TICK_MS / 1000;

    if (state.timeOfDay >= DAY_LENGTH) {
        startNight();
    }
}

// Night falls: send the player home and stop them collecting water.
function startNight() {
    state.phase = 'night';
    state.timeOfDay = DAY_LENGTH; // keep the daylight bar empty all night
    state.nightTime = 0;

    // Everyone heads home for the night
    state.player.x = HOME_POSITION.x;
    state.player.y = HOME_POSITION.y;

    // Any water still in the bucket spills on the way home (it's a hard life!)
    state.player.carrying = false;
    renderPlayer();

    nightOverlayEl.classList.add('active');
    showMessage("Night has fallen. It's too dark to collect water, so you head home.");
    console.log(`Night ${state.day} begins.`);
}

// Move the night clock forward one tick. When the night is over, start a new day.
function advanceNight() {
    state.nightTime += TICK_MS / 1000;

    if (state.nightTime >= NIGHT_LENGTH) {
        startNewDay();
    }
}

// Morning: either charity: water arrives (win) or a new day begins.
function startNewDay() {
    // Made it through the last night? Help has arrived!
    if (state.day >= DAYS_TO_WIN) {
        winGame();
        return;
    }

    state.day += 1;
    state.timeOfDay = 0;
    state.phase = 'playing';

    nightOverlayEl.classList.remove('active');
    hideMessage();
    updateDayCounter();
    console.log(`Day ${state.day} begins.`);
}

// charity: water builds a water pump for the village. The player wins!
function winGame() {
    state.phase = 'won';
    clearInterval(loopId); // stop the game loop

    nightOverlayEl.classList.remove('active');

    // Add the water pump to the village so the player can see it.
    // .concat() joins the two arrays so the pump is drawn along with the houses and trees.
    state.wells.push({ type: 'pump', x: 120, y: 390 });
    renderWorld(villageMap.concat(state.wells));
    showMessage('Help has arrived! charity: water built a water pump for your village!');
    console.log('You win! charity: water built a pump.');

    // Give the player 3 seconds to see the new pump, then show the win screen.
    // The win screen stays up until the player clicks Play Again or Reset.
    winTimeoutId = setTimeout(() => {
        hideMessage();
        winScreenEl.classList.remove('hidden');
    }, 3000);
}

// Check if the player has lost. (Winning is checked in startNewDay.)
function checkWinLose() {
    if (state.water <= 0) {
        loseGame();
    }
}

// Stop the game and show the lose screen.
function loseGame() {
    state.phase = 'lost';
    clearInterval(loopId); // stop the game loop

    const dayWord = state.day === 1 ? 'day' : 'days';
    loseMessageEl.textContent = `Your village ran out of water. You survived ${state.day} ${dayWord}.`;
    loseScreenEl.classList.remove('hidden');

    console.log('Game over: out of water.');
}

// Let go of every direction key (so the player doesn't keep walking by themselves).
function releaseAllKeys() {
    heldDirections.up = false;
    heldDirections.down = false;
    heldDirections.left = false;
    heldDirections.right = false;
}

// Put everything back to how it was at the very beginning.
function resetGame() {
    // Stop the old game loop so we never have two loops running at once
    // (that would make the game run twice as fast!)
    clearInterval(loopId);

    // If Reset is clicked during the "Help has arrived!" message,
    // cancel the timer so the win screen doesn't pop up over the new game
    clearTimeout(winTimeoutId);

    // Fresh copy of all the starting values
    state = createStartingState();
    releaseAllKeys();

    // Hide anything left over from the last game
    loseScreenEl.classList.add('hidden');
    winScreenEl.classList.add('hidden');
    nightOverlayEl.classList.remove('active');
    hideMessage();

    // Redraw everything (this also removes the pump if the last game was won)
    renderWorld(villageMap.concat(state.wells));
    renderPlayer();
    updateHUD();
    updatePrompt();
    dayCounterEl.textContent = `Day ${state.day}`;
}

// Start playing: hide the start screen and start the game loop.
function startGame() {
    startScreenEl.classList.add('hidden');
    state.phase = 'playing';

    clearInterval(loopId); // just in case a loop is already running
    loopId = setInterval(gameLoop, TICK_MS);
    console.log('Game started!');
}

// The game loop: runs every TICK_MS milliseconds and updates everything.
function gameLoop() {
    if (state.phase === 'playing') {
        // Daytime: the player can move, and water drains at the normal rate
        movePlayer();
        drainWater(DRAIN_PER_SECOND);
        advanceDay();
    } else if (state.phase === 'night') {
        // Night: no moving, water drains more slowly
        drainWater(NIGHT_DRAIN_PER_SECOND);
        advanceNight();
    } else {
        // Any other phase (won, lost...): do nothing
        return;
    }

    updateHUD();
    updatePrompt();
    checkWinLose();
}

// =====================================================
// 5. EVENT LISTENERS
// =====================================================

// When a key is pressed down, remember its direction
document.addEventListener('keydown', (event) => {
    // On the win or lose screen, keys do nothing. Only the buttons restart the game.
    if (state.phase === 'won' || state.phase === 'lost') return;

    const direction = KEY_DIRECTIONS[event.key.toLowerCase()];

    if (direction) {
        event.preventDefault(); // stop the arrow keys from scrolling the page
        heldDirections[direction] = true;
    }

    // ENTER = interact. Only while playing, and ignore the repeats the browser
    // sends when ENTER is held down (event.repeat), so one press = one action.
    if (event.key === 'Enter' && !event.repeat && state.phase === 'playing') {
        handleInteract();
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
window.addEventListener('blur', releaseAllKeys);

// IMPORTANT: every button handler calls event.currentTarget.blur().
// A clicked button stays "focused", and pressing ENTER on a focused button clicks it again.
// Since ENTER is also our collect/deliver key, that would restart the game by accident!

// Start button (only on the very first game)
startBtn.addEventListener('click', (event) => {
    event.currentTarget.blur();
    startGame();
});

// Reset button (always visible under the game): restart whenever the player wants
resetBtn.addEventListener('click', (event) => {
    event.currentTarget.blur();
    resetGame();
    startGame();
});

// Try Again button (lose screen): reset and jump straight back into the game.
// The start screen isn't shown again (and in milestone 9, neither is the tutorial).
tryAgainBtn.addEventListener('click', (event) => {
    event.currentTarget.blur();
    resetGame();
    startGame();
});

// When the day counter's pop animation finishes, remove the class
// so it can be added again (and pop again) tomorrow.
dayCounterEl.addEventListener('animationend', () => {
    dayCounterEl.classList.remove('pop');
});

// Play Again button (win screen): same as Try Again
playAgainBtn.addEventListener('click', (event) => {
    event.currentTarget.blur();
    resetGame();
    startGame();
});

// =====================================================
// 6. START-UP
// =====================================================
// Draw the world and HUD. The start screen is showing (it's not hidden in index.html),
// so the game waits until the Start button is clicked.
resetGame();
console.log(`Milestone 6: click Start, survive ${DAYS_TO_WIN} days for charity: water to arrive.`);
