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
const PLAYER_SPEED = 4;    // pixels the player moves each tick with the keyboard (slow-ish on purpose: walking is a chore!)
const CLICK_WALK_SPEED = 3; // pixels per tick when walking to a tapped/clicked spot.
                            // Slower than the keyboard because tapping walks in a perfectly straight
                            // line, which gets you there sooner than steering with the arrow keys.
const PLAYER_HALF_SIZE = 20; // half the player's size, so they can't walk halfway out of the box

const DRAIN_PER_SECOND = 1;        // how much village water is used up each second during the day (out of 100)
const NIGHT_DRAIN_PER_SECOND = 0.5; // water still gets used at night, just less
const LOW_WATER_LEVEL = 25;  // below this, the water bar turns red as a warning

const WATER_PER_TRIP = 15;       // how much one bucket of CLEAN water adds to the village water (out of 100)
const DIRTY_WATER_PENALTY = 10;  // how much one bucket of DIRTY water takes away (people get sick)
const LITERS_PER_TRIP = 20;      // a jerry can holds about 20 liters
const INTERACT_DISTANCE = 90;    // how close (in pixels) the player must be to use something
const MESSAGE_TIME_MS = 3500;    // how long short messages stay on screen

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

// Is this a touch screen (phone/tablet)? 'pointer: coarse' means a finger instead of a mouse.
// Used to say "Tap" instead of "Press ENTER" in the hints.
const IS_TOUCH_SCREEN = window.matchMedia('(pointer: coarse)').matches;
// The clickable part is wrapped in a span so CSS can underline it (see .hint-action in styles.css).
const ACTION_HINT = IS_TOUCH_SCREEN
    ? '<span class="hint-action">Tap here</span>'
    : 'Press <span class="hint-action">ENTER</span>';

// The brand guide says "charity: water" must never be split onto two lines.
//   is a "non-breaking space", so the browser won't wrap between the two words.
const BRAND_NAME = 'charity: water';

// Tutorial messages, shown one at a time the first time someone plays.
// highlight is a CSS selector for the thing the message talks about (or null for nothing).
const CONTINUE_HINT = IS_TOUCH_SCREEN ? '(tap to continue)' : '(press ENTER or click to continue)';
const TUTORIAL_STEPS = [
    {
        text: "Your village needs water, and it's your job to fetch it. Keep the village's water level up for as long as you can.",
        highlight: null
    },
    {
        text: "This is the daylight bar. When the sun sets, you head home. You can't collect water in the dark.",
        highlight: '#day-tracker'
    },
    {
        text: "This is your village's water level. It drops all day, so don't let it reach empty!",
        highlight: '#water-tracker'
    },
    {
        text: 'The muddy water hole is close, but its water makes people sick. The clean water is farther away.',
        highlight: '.water-hole, .dirty-hole'
    },
    {
        text: IS_TOUCH_SCREEN
            ? 'Tap where you want to walk. Tap the hint above your head to collect or deliver water.'
            : 'Move with WASD or the arrow keys, or click where you want to walk. Press ENTER to collect and deliver water.',
        highlight: null
    }
];

// Short sounds, made with the Web Audio API (no sound files needed).
// Each note is [frequency in Hz, when it starts in seconds, how long it lasts in seconds].
// Higher frequency = higher pitch.
const SOUNDS = {
    clean: [[659, 0, 0.15], [988, 0.1, 0.3]],                          // happy "ding-ding"
    dirty: [[220, 0, 0.25], [175, 0.15, 0.35]],                        // low "bonk-bonk"
    win: [[523, 0, 0.2], [659, 0.15, 0.2], [784, 0.3, 0.2], [1047, 0.45, 0.6]] // rising fanfare
};

// Brand colors for the confetti
const CONFETTI_COLORS = ['#FFC907', '#003366', '#77A8BB', '#FED8C1', '#BF6C46', '#FFF7E1'];

// Which emoji to show for each type of map object.
// The water hole is drawn with CSS, so it has no emoji.
const SPRITES = {
    house: '🛖',
    tree: '🌳',
    'water-hole': '',
    'dirty-hole': '', // also drawn with CSS
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
        // 'start' (waiting for Start button), 'tutorial', 'playing', 'night', 'won' or 'lost'.
        // Only 'playing' lets the player move.
        phase: 'start',

        water: 60,     // village water level, from 0 to 100
        timeOfDay: 0,  // seconds since sunrise
        nightTime: 0,  // seconds since nightfall (only counts during the night)
        day: 1,        // days survived
        litersDelivered: 0, // total clean water brought home (shown on the end screens)

        // The player is stored as an "entity" object.
        // Later, villagers will use this same shape.
        // carrying is null (empty bucket), 'clean' or 'dirty'.
        // target is the spot the player is walking to after a tap/click: { x, y }, or null.
        player: { id: 'player', x: HOME_POSITION.x, y: HOME_POSITION.y, carrying: null, target: null, task: null },

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

// The ID of the timer that hides a short message (see showMessage)
let messageTimeoutId = null;

// The hint currently showing above the player (so we only rebuild it when it changes)
let currentPromptMessage = '';

// Has the player finished the tutorial? This lives OUTSIDE the state object on purpose:
// resetGame() replaces the state, but we want the tutorial to stay skipped on replays.
let tutorialSeen = false;

// Which tutorial message is showing (an index into TUTORIAL_STEPS)
let tutorialStep = 0;

// The Web Audio "sound system". Browsers only allow sound after the player clicks
// something, so it's created when Start is clicked (see initAudio).
let audioContext = null;

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

    // Water sources:
    // the CLEAN water hole is far away in the bottom-right corner (a long walk)...
    { type: 'water-hole', x: 725, y: 535 },
    // ...and the DIRTY one is temptingly close to the village (the obstacle!)
    { type: 'dirty-hole', x: 430, y: 470 }
];

// =====================================================
// 3. DOM REFERENCES (elements we change from JavaScript)
// =====================================================
const worldEl = document.getElementById('world');
const playerEl = document.getElementById('player');
const gameEl = document.getElementById('game');
const gameWrapperEl = document.getElementById('game-wrapper');
const controlsBarEl = document.getElementById('controls-bar');
const dayFillEl = document.getElementById('day-fill');
const waterFillEl = document.getElementById('water-fill');
const dayCounterEl = document.getElementById('day-counter');
const loseScreenEl = document.getElementById('lose-screen');
const loseMessageEl = document.getElementById('lose-message');
const winMessageEl = document.getElementById('win-message');
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
const waterTrackerEl = document.getElementById('water-tracker');
const waterBarEl = document.getElementById('water-bar');
const waterPercentEl = document.getElementById('water-percent');

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
    // (!null is true, so the can is hidden when the bucket is empty)
    carryIconEl.classList.toggle('hidden', !state.player.carrying);

    // Show a little brown drop next to the can when the water is dirty
    playerEl.classList.toggle('carrying-dirty', state.player.carrying === 'dirty');
}

// Distance in pixels between two things that have x and y (like the player and a house).
function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy); // Pythagorean theorem: √(dx² + dy²)
}

// Find the water source (clean or dirty) the player is standing next to.
// Returns that map item, or undefined if they aren't near any water.
function getNearbyWaterSource() {
    return villageMap.find((item) =>
        (item.type === 'water-hole' || item.type === 'dirty-hole') &&
        getDistance(state.player, item) < INTERACT_DISTANCE
    );
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
    const source = getNearbyWaterSource();

    if (source && !state.player.carrying) {
        const kind = source.type === 'dirty-hole' ? 'dirty' : 'clean';
        message = `${ACTION_HINT} to collect ${kind} water`;
    } else if (source && state.player.carrying) {
        message = 'Your bucket is full! Bring it to the village';
    } else if (isNearVillage() && state.player.carrying) {
        message = `${ACTION_HINT} to deliver ${state.player.carrying} water`;
    }

    // Only rebuild the hint when its text changes. This function runs every tick, and
    // replacing the HTML that often can "eat" clicks (the mouse would press on one
    // element and release on a brand-new one, so the browser never fires 'click').
    // innerHTML is safe here because the message is our own text, not something a user typed.
    if (message !== currentPromptMessage) {
        promptEl.innerHTML = message;
        currentPromptMessage = message;
    }
    promptEl.classList.toggle('hidden', message === '');

    // Place the prompt just above the player, but keep it inside the game box
    // so it doesn't get cut off when the player is near the left or right edge.
    // (offsetWidth = the prompt's width in pixels; the prompt is centered, so use half of it.)
    const halfWidth = promptEl.offsetWidth / 2;
    promptEl.style.left = `${clamp(state.player.x, halfWidth + 8, GAME_WIDTH - halfWidth - 8)}px`;
    promptEl.style.top = `${state.player.y - 45}px`;
}

// What happens when the player presses ENTER.
function handleInteract() {
    const source = getNearbyWaterSource();

    if (source && !state.player.carrying) {
        // Fill the bucket (you can only carry one at a time).
        // Remember which kind of water is in it.
        state.player.carrying = source.type === 'dirty-hole' ? 'dirty' : 'clean';
        console.log(`Collected ${state.player.carrying} water! Bring it back to the village.`);
    } else if (isNearVillage() && state.player.carrying === 'clean') {
        // Clean water: fill up the village. Math.min keeps water at 100 or less.
        state.water = Math.min(state.water + WATER_PER_TRIP, 100);
        state.litersDelivered += LITERS_PER_TRIP;
        state.player.carrying = null;
        showStars(waterTrackerEl);
        playSound(SOUNDS.clean);
        console.log(`Delivered clean water! Village water is now ${Math.round(state.water)}%.`);
    } else if (isNearVillage() && state.player.carrying === 'dirty') {
        // Dirty water: people get sick, so the village LOSES water caring for them.
        // Math.max keeps water at 0 or more.
        state.water = Math.max(state.water - DIRTY_WATER_PENALTY, 0);
        state.player.carrying = null;
        flashWaterBar();
        playSound(SOUNDS.dirty);
        showMessage('That water was dirty and people got sick. The clean water is farther away, but it keeps everyone healthy.', MESSAGE_TIME_MS);
        console.log(`Delivered dirty water. Village water dropped to ${Math.round(state.water)}%.`);
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

    // The score: water level as a whole number, e.g. "62%"
    waterPercentEl.textContent = `${Math.round(state.water)}%`;

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

    const target = state.player.target;

    if (dx !== 0 || dy !== 0) {
        // Using the keyboard cancels any tap/click target
        state.player.target = null;

        // Moving diagonally would be faster than moving straight,
        // so slow down a little when moving in two directions at once.
        if (dx !== 0 && dy !== 0) {
            dx *= 0.7;
            dy *= 0.7;
        }
    } else if (target) {
        // No keys held, but there's a tapped/clicked spot: walk toward it
        const distance = getDistance(state.player, target);

        if (distance <= CLICK_WALK_SPEED) {
            // Close enough: step exactly onto the target and stop
            dx = target.x - state.player.x;
            dy = target.y - state.player.y;
            state.player.target = null;
        } else {
            // Take one CLICK_WALK_SPEED-sized step along the straight line to the target.
            // Dividing by the distance turns the difference into a "direction" of length 1.
            dx = ((target.x - state.player.x) / distance) * CLICK_WALK_SPEED;
            dy = ((target.y - state.player.y) / distance) * CLICK_WALK_SPEED;
        }
    }

    // Move, but keep the player inside the game box
    state.player.x = clamp(state.player.x + dx, PLAYER_HALF_SIZE, GAME_WIDTH - PLAYER_HALF_SIZE);
    state.player.y = clamp(state.player.y + dy, PLAYER_HALF_SIZE, GAME_HEIGHT - PLAYER_HALF_SIZE);

    renderPlayer();
}

// Keep a number between a smallest and largest value.
// Math.max stops it going below min, Math.min stops it going above max.
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Shrink the game to fit small screens (phones, tablets, small windows).
// Everything inside still uses the same 800 x 600 coordinates; CSS just draws it smaller.
function fitGameToScreen() {
    // The screen's size. We use document.documentElement.clientWidth/clientHeight instead of
    // window.innerWidth/innerHeight because on phones innerWidth can report a "zoomed out" page
    // that's wider than the actual screen.
    const screenWidth = document.documentElement.clientWidth;
    const screenHeight = document.documentElement.clientHeight;

    // Width: the screen minus a 16px gap on each side
    const availableWidth = screenWidth - 32;

    // Height: from the top of the game down to the bottom of the window,
    // minus the space the Reset button bar needs (its height plus its margins).
    // getBoundingClientRect().top already includes the title above the game, if it's showing.
    const controlsStyle = getComputedStyle(controlsBarEl);
    const controlsSpace = controlsBarEl.offsetHeight + parseFloat(controlsStyle.marginTop) + parseFloat(controlsStyle.marginBottom);
    const gameTop = gameWrapperEl.getBoundingClientRect().top + window.scrollY;
    const availableHeight = screenHeight - gameTop - controlsSpace;

    // Shrink enough to fit both ways, but never grow bigger than full size (1).
    // Math.max(..., 0.3) stops it from becoming tiny (or negative) in very short windows.
    const scale = Math.max(Math.min(availableWidth / GAME_WIDTH, availableHeight / GAME_HEIGHT, 1), 0.3);

    gameEl.style.transform = `scale(${scale})`;
    gameWrapperEl.style.width = `${GAME_WIDTH * scale}px`;
    gameWrapperEl.style.height = `${GAME_HEIGHT * scale}px`;

    // When the game is drawn smaller, its text gets smaller too.
    // --text-boost makes text bigger to make up for it (at most 2x), so it stays readable.
    gameEl.style.setProperty('--text-boost', Math.min(1 / scale, 2));
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
// If hideAfterMs is given, the message hides itself after that many milliseconds.
// Otherwise it stays until hideMessage() is called.
function showMessage(text, hideAfterMs) {
    // A new message replaces the old one, so cancel the old one's hide timer
    // (otherwise it could hide this new message too early)
    clearTimeout(messageTimeoutId);

    messageBoxEl.textContent = text;
    messageBoxEl.classList.remove('hidden');
    messageBoxEl.classList.remove('centered'); // only tutorial messages are centered

    if (hideAfterMs) {
        messageTimeoutId = setTimeout(hideMessage, hideAfterMs);
    }
}

// ---------- Tutorial ----------

// Show the current tutorial message and highlight what it's talking about.
function showTutorialStep() {
    const step = TUTORIAL_STEPS[tutorialStep];

    clearHighlights();
    showMessage(`${step.text}\n${CONTINUE_HINT}`);
    messageBoxEl.classList.add('centered');

    if (step.highlight) {
        document.querySelectorAll(step.highlight).forEach((el) => el.classList.add('highlight'));
    }
}

// Go to the next tutorial message, or start playing after the last one.
function nextTutorialStep() {
    tutorialStep += 1;

    if (tutorialStep < TUTORIAL_STEPS.length) {
        showTutorialStep();
    } else {
        finishTutorial();
    }
}

function finishTutorial() {
    clearHighlights();
    tutorialSeen = true; // don't show it again, even after Reset
    state.phase = 'playing';
    showMessage('Now go get some water!', 2000);
}

// Remove the pulsing tutorial outline from everything
function clearHighlights() {
    document.querySelectorAll('.highlight').forEach((el) => el.classList.remove('highlight'));
}

// ---------- Sound ----------

// Create the sound system. Must happen after a click, or browsers block it.
function initAudio() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    audioContext.resume();
}

// Play a list of notes (see SOUNDS at the top of the file).
function playSound(notes) {
    if (!audioContext) return; // no sound until the player has clicked Start

    const now = audioContext.currentTime;

    notes.forEach(([frequency, start, length]) => {
        // An oscillator makes a tone; a gain node controls its volume
        const oscillator = audioContext.createOscillator();
        const volume = audioContext.createGain();

        oscillator.type = 'triangle'; // a soft, flute-like tone
        oscillator.frequency.value = frequency;

        // Fade in very quickly, then fade out, so the note doesn't "click"
        volume.gain.setValueAtTime(0.0001, now + start);
        volume.gain.exponentialRampToValueAtTime(0.2, now + start + 0.02);
        volume.gain.exponentialRampToValueAtTime(0.0001, now + start + length);

        // Connect: oscillator -> volume -> speakers
        oscillator.connect(volume);
        volume.connect(audioContext.destination);

        oscillator.start(now + start);
        oscillator.stop(now + start + length + 0.05);
    });
}

// ---------- Confetti ----------

// Rain brand-colored confetti over the game (when the player wins).
function launchConfetti() {
    for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti';

        // Random everything, so each piece looks and moves a little differently
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        piece.style.animationDuration = `${2.5 + Math.random() * 2}s`; // 2.5 to 4.5 seconds to fall
        piece.style.animationDelay = `${Math.random() * 1.5}s`;        // don't all start at once
        piece.style.setProperty('--drift', `${Math.random() * 160 - 80}px`); // sideways: -80 to 80px

        // Remove each piece when it has finished falling
        piece.addEventListener('animationend', () => piece.remove());
        gameEl.appendChild(piece);
    }
}

// Make little stars twinkle around an element (like the water bar) to celebrate.
function showStars(targetEl) {
    for (let i = 0; i < 6; i++) {
        const star = document.createElement('span');
        star.className = 'star';
        star.textContent = '★';

        // Random spot around the target: a bit outside its edges.
        // Percentages are relative to the target's size.
        star.style.left = `${Math.random() * 110 - 5}%`;
        star.style.top = `${Math.random() * 80 - 30}%`;

        // Start each star a little later than the last, so they twinkle one after another
        star.style.animationDelay = `${i * 0.08}s`;

        // When its animation finishes, remove the star so they don't pile up
        star.addEventListener('animationend', () => star.remove());
        targetEl.appendChild(star);
    }
}

// Shake the water bar and flash it red (when dirty water is delivered).
function flashWaterBar() {
    waterBarEl.classList.add('hurt');
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

    // Everyone heads home for the night (and forgets where they were walking to)
    state.player.x = HOME_POSITION.x;
    state.player.y = HOME_POSITION.y;
    state.player.target = null;

    // Any water still in the bucket spills on the way home (it's a hard life!)
    state.player.carrying = null;
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
    showMessage(`Help has arrived! ${BRAND_NAME} built a water pump for your village!`);
    playSound(SOUNDS.win);
    console.log('You win! charity: water built a pump.');

    // Give the player 3 seconds to see the new pump, then show the win screen.
    // The win screen stays up until the player clicks Play Again or Reset.
    winTimeoutId = setTimeout(() => {
        hideMessage();
        winMessageEl.textContent = `You carried ${state.litersDelivered} liters of clean water home over ${state.day} days. With a pump close by, nobody has to make that walk anymore. That time can go to school, work and family instead.`;
        winScreenEl.classList.remove('hidden');
        launchConfetti();
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
    loseMessageEl.textContent = `Your village ran out of water after ${state.day} ${dayWord}. You carried ${state.litersDelivered} liters of clean water home.`;
    hideMessage(); // don't leave an old message peeking out behind the lose screen
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
    clearTimeout(messageTimeoutId);

    // Fresh copy of all the starting values
    state = createStartingState();
    releaseAllKeys();

    // Hide anything left over from the last game
    loseScreenEl.classList.add('hidden');
    winScreenEl.classList.add('hidden');
    nightOverlayEl.classList.remove('active');
    hideMessage();
    waterBarEl.classList.remove('hurt');
    document.querySelectorAll('.star, .confetti').forEach((el) => el.remove());
    clearHighlights();

    // Redraw everything (this also removes the pump if the last game was won)
    renderWorld(villageMap.concat(state.wells));
    renderPlayer();
    updateHUD();
    updatePrompt();
    dayCounterEl.textContent = `Day ${state.day}`;
}

// Start playing: hide the start screen, bring the world to life and start the game loop.
function startGame() {
    startScreenEl.classList.add('hidden');
    gameEl.classList.remove('not-started'); // the world fades from gray into full color
    initAudio(); // Start was a click, so the browser now allows sound

    clearInterval(loopId); // just in case a loop is already running
    loopId = setInterval(gameLoop, TICK_MS);

    // First game: show the tutorial (the loop waits while phase is 'tutorial').
    // After that (Try Again, Play Again, Reset): jump straight in.
    if (!tutorialSeen) {
        state.phase = 'tutorial';
        tutorialStep = 0;
        showTutorialStep();
    } else {
        state.phase = 'playing';
    }
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

    // During the tutorial, ENTER goes to the next message (and does nothing else)
    if (state.phase === 'tutorial') {
        if (event.key === 'Enter' && !event.repeat) {
            nextTutorialStep();
        }
        return;
    }

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
// The start screen and the tutorial are not shown again.
tryAgainBtn.addEventListener('click', (event) => {
    event.currentTarget.blur();
    resetGame();
    startGame();
});

// Tap or click anywhere in the game to walk there.
// 'pointerdown' works for mouse clicks AND finger taps.
gameEl.addEventListener('pointerdown', (event) => {
    // During the tutorial, a tap/click anywhere goes to the next message
    if (state.phase === 'tutorial') {
        nextTutorialStep();
        return;
    }

    if (state.phase !== 'playing') return;

    // Taps on buttons (like the hint above the player) shouldn't move the player
    if (event.target.closest('button')) return;

    // The game might be drawn smaller than 800 x 600 (see fitGameToScreen),
    // so convert the tap from screen pixels to game pixels.
    const rect = gameEl.getBoundingClientRect();
    const scale = rect.width / GAME_WIDTH;
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;

    // Keep the target inside the area the player can actually reach
    state.player.target = {
        x: clamp(x, PLAYER_HALF_SIZE, GAME_WIDTH - PLAYER_HALF_SIZE),
        y: clamp(y, PLAYER_HALF_SIZE, GAME_HEIGHT - PLAYER_HALF_SIZE)
    };
});

// Clicking/tapping the hint above the player does the same thing as pressing ENTER
promptEl.addEventListener('click', (event) => {
    event.currentTarget.blur();
    if (state.phase === 'playing') {
        handleInteract();
    }
});

// Re-fit the game whenever the window changes size (or a phone is rotated)
window.addEventListener('resize', fitGameToScreen);

// When the day counter's pop animation finishes, remove the class
// so it can be added again (and pop again) tomorrow.
dayCounterEl.addEventListener('animationend', () => {
    dayCounterEl.classList.remove('pop');
});

// Same idea for the water bar's red "hurt" flash
waterBarEl.addEventListener('animationend', () => {
    waterBarEl.classList.remove('hurt');
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
fitGameToScreen(); // size the game for this screen
resetGame();
console.log(`Milestone 9: Click Start, survive ${DAYS_TO_WIN} days for charity: water to arrive.`);
