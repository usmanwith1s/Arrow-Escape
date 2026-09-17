/* =========================================================
   ARROW ESCAPE
   Complete Game Engine
========================================================= */


/* =========================================================
   DIRECTION DATA
========================================================= */

const DIRS = {
    up: {
        dr: -1,
        dc: 0
    },

    down: {
        dr: 1,
        dc: 0
    },

    left: {
        dr: 0,
        dc: -1
    },

    right: {
        dr: 0,
        dc: 1
    }
};


/* =========================================================
   DIFFICULTY SETTINGS
========================================================= */

const DIFFICULTIES = {
    Easy: {
        rows: 6,
        cols: 6,
        cellPx: 48,
        zoomPan: false,
        gridToggle: false
    },

    Medium: {
        rows: 8,
        cols: 8,
        cellPx: 40,
        zoomPan: false,
        gridToggle: false
    },

    Hard: {
        rows: 10,
        cols: 12,
        cellPx: 32,
        zoomPan: true,
        gridToggle: true
    },

    Nightmare: {
        rows: 14,
        cols: 16,
        cellPx: 24,
        zoomPan: true,
        gridToggle: true
    }
};


/* =========================================================
   GAME STATE
========================================================= */

let currentLevel = 1;

let difficultyName = "Easy";

let rows = 6;
let cols = 6;
let cellPx = 48;

let zoomPan = false;

let board = {};
let present = new Set();
let solveOrder = [];

let clearedCount = 0;
let lives = 3;

let moveHistory = [];

let gameLocked = false;

let worldWidth = 0;
let worldHeight = 0;

let scale = 1;
let panX = 0;
let panY = 0;

let gridVisible = false;

let hintTimeout = null;


/* =========================================================
   DOM REFERENCES
========================================================= */

const boardWrap = document.getElementById("boardWrap");
const boardSvg = document.getElementById("boardSvg");
const world = document.getElementById("world");
const gridGroup = document.getElementById("gridGroup");

const difficultyNameElement =
    document.getElementById("difficultyName");

const levelLabelElement =
    document.getElementById("levelLabel");

const heartsElement =
    document.getElementById("hearts");

const statusText =
    document.getElementById("statusText");

const progressText =
    document.getElementById("progressText");

const progressFill =
    document.getElementById("progressFill");

const hintButton =
    document.getElementById("hintButton");

const undoButton =
    document.getElementById("undoButton");

const restartButton =
    document.getElementById("restartButton");

const backButton =
    document.getElementById("backButton");

const gridToggle =
    document.getElementById("gridToggle");

const zoomTip =
    document.getElementById("zoomTip");

const winOverlay =
    document.getElementById("winOverlay");

const gameOverOverlay =
    document.getElementById("gameOverOverlay");

const starRating =
    document.getElementById("starRating");

const winDetails =
    document.getElementById("winDetails");

const nextLevelButton =
    document.getElementById("nextLevelButton");

const winMenuButton =
    document.getElementById("winMenuButton");

const retryButton =
    document.getElementById("retryButton");

const newPuzzleButton =
    document.getElementById("newPuzzleButton");


/* =========================================================
   BASIC HELPERS
========================================================= */

function svgElement(name, attributes = {}) {
    const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        name
    );

    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, String(value));
    }

    return element;
}


function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}


function keyFor(r, c) {
    return `${r},${c}`;
}


/* =========================================================
   BOARD BOUNDS
========================================================= */

function inBounds(r, c, rows, cols) {
    return (
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < cols
    );
}


/* =========================================================
   SINGLE SOURCE OF TRUTH FOR PATH CLEARANCE
========================================================= */

/*
    Is the straight line from (r,c) to the edge, in `dir`,
    free of any still-present arrow?

    This function is used by BOTH:

    1. Level generation
    2. Live gameplay

    This prevents the generator and gameplay from ever
    disagreeing about what counts as a legal move.
*/

function isPathClear(r, c, dir, rows, cols, present) {
    const { dr, dc } = DIRS[dir];

    let nr = r + dr;
    let nc = c + dc;

    while (inBounds(nr, nc, rows, cols)) {

        if (present.has(`${nr},${nc}`)) {
            return false;
        }

        nr += dr;
        nc += dc;
    }

    return true;
}


/* =========================================================
   SOLVABLE LEVEL GENERATION
========================================================= */

/*
    IMPORTANT:

    We do NOT randomly assign directions to all cells.

    Random directions can create impossible / locked boards.

    Instead, we construct the puzzle by simulating a legal
    solve in reverse.

    At every step:

    - present contains all arrows that have NOT yet been
      "cleared" in the simulation.
    - We find cells that currently have at least one legal
      direction.
    - We assign one of those legal directions to the cell.
    - We remove that cell from the simulation.

    Why can `candidates` never be empty?

    Take whichever remaining cell has the smallest column
    index (the left-most surviving arrow).

    Every cell to its left in that row must already be cleared.
    Otherwise that cell would also still be remaining and would
    have an even smaller column index, contradicting our choice.

    Therefore `left` is always a legal direction for that cell.

    So the generation loop can never stall.

    Because an arrow is assigned a direction only when that
    direction is currently legal, and all cells only disappear
    from `present` after that point, the recorded solveOrder
    remains valid when replayed later.

    Result:

        Generated board
              ↓
        Known legal solveOrder
              ↓
        100% solvable puzzle
*/

function generateSolvableBoard(rows, cols) {

    const present = new Set();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            present.add(`${r},${c}`);
        }
    }

    const board = {};
    const solveOrder = [];

    while (present.size > 0) {

        const candidates = [];

        for (const key of present) {

            const [r, c] = key
                .split(",")
                .map(Number);

            const validDirs =
                Object.keys(DIRS).filter(dir =>
                    isPathClear(
                        r,
                        c,
                        dir,
                        rows,
                        cols,
                        present
                    )
                );

            if (validDirs.length > 0) {

                candidates.push({
                    r,
                    c,
                    key,
                    validDirs
                });
            }
        }


        /*
            This should NEVER happen.

            The proof above guarantees that at least the
            left-most surviving cell has a legal `left`
            direction.
        */

        if (candidates.length === 0) {
            throw new Error(
                "Level generation stalled. This should never happen."
            );
        }


        const pick =
            candidates[
                Math.floor(
                    Math.random() * candidates.length
                )
            ];


        const dir =
            pick.validDirs[
                Math.floor(
                    Math.random() *
                    pick.validDirs.length
                )
            ];


        board[pick.key] = {
            row: pick.r,
            col: pick.c,
            dir
        };

        solveOrder.push({
            row: pick.r,
            col: pick.c,
            dir
        });

        present.delete(pick.key);
    }


    /*
        Extra verification.

        The generation method already proves solvability,
        but verifying the generated solve order gives us a
        second safety check during development.
    */

    if (
        !verifyGeneratedBoard(
            board,
            solveOrder,
            rows,
            cols
        )
    ) {
        throw new Error(
            "Generated board failed solvability verification."
        );
    }


    return {
        board,
        solveOrder
    };
}


/* =========================================================
   SOLUTION VERIFICATION
========================================================= */

function verifyGeneratedBoard(
    board,
    solveOrder,
    rows,
    cols
) {

    const simulation =
        new Set(Object.keys(board));


    for (const move of solveOrder) {

        const key =
            `${move.row},${move.col}`;


        if (!simulation.has(key)) {
            return false;
        }


        const piece =
            board[key];


        if (
            !isPathClear(
                move.row,
                move.col,
                piece.dir,
                rows,
                cols,
                simulation
            )
        ) {
            return false;
        }


        simulation.delete(key);
    }


    return simulation.size === 0;
}


/* =========================================================
   DIFFICULTY BY LEVEL
========================================================= */

function getDifficultyForLevel(level) {

    if (level <= 25) {
        return "Easy";
    }

    if (level <= 50) {
        return "Medium";
    }

    if (level <= 75) {
        return "Hard";
    }

    return "Nightmare";
}


/* =========================================================
   LOAD LEVEL
========================================================= */

function loadLevel(level) {

    currentLevel = Math.max(1, level);

    difficultyName =
        getDifficultyForLevel(currentLevel);

    const settings =
        DIFFICULTIES[difficultyName];

    rows = settings.rows;
    cols = settings.cols;
    cellPx = settings.cellPx;
    zoomPan = settings.zoomPan;

    worldWidth =
        cols * cellPx;

    worldHeight =
        rows * cellPx;


    const generated =
        generateSolvableBoard(
            rows,
            cols
        );


    board = generated.board;
    solveOrder = generated.solveOrder;

    present =
        new Set(Object.keys(board));

    clearedCount = 0;
    lives = 3;

    moveHistory = [];

    gameLocked = false;

    resetView();

    hideOverlays();

    renderBoard();

    updateUI();

    updateZoomUI();

    setStatus(
        "Clear all the arrows."
    );
}


/* =========================================================
   RETRY SAME BOARD
========================================================= */

function retrySameBoard() {

    present =
        new Set(Object.keys(board));

    clearedCount = 0;
    lives = 3;

    moveHistory = [];

    gameLocked = false;

    hideOverlays();

    renderBoard();

    updateUI();

    setStatus(
        "Same puzzle. Try a different order."
    );
}


/* =========================================================
   RESTART = NEW PUZZLE AT SAME LEVEL
========================================================= */

function restartCurrentLevel() {
    loadLevel(currentLevel);

    setStatus(
        "New puzzle generated."
    );
}


/* =========================================================
   UI
========================================================= */

function updateUI() {

    difficultyNameElement.textContent =
        difficultyName;

    levelLabelElement.textContent =
        `Level ${currentLevel}`;

    updateHeartsUI();

    updateProgress();

    undoButton.disabled =
        moveHistory.length === 0;

    gridToggle.disabled =
        !DIFFICULTIES[difficultyName].gridToggle;
}


function updateProgress() {

    const total =
        rows * cols;

    progressText.textContent =
        `${clearedCount} / ${total}`;

    const percent =
        total === 0
            ? 0
            : (clearedCount / total) * 100;

    progressFill.style.width =
        `${percent}%`;
}


function updateHeartsUI(lostHeartIndex = -1) {

    heartsElement.innerHTML = "";

    heartsElement.setAttribute(
        "aria-label",
        `${lives} lives remaining`
    );

    for (let i = 0; i < 3; i++) {

        const heart =
            document.createElement("span");

        heart.className = "heart";

        heart.textContent =
            i < lives
                ? "♥"
                : "♡";

        if (i >= lives) {
            heart.classList.add("empty");
        }

        if (i === lostHeartIndex) {
            heart.classList.add("breaking");
        }

        heartsElement.appendChild(
            heart
        );
    }
}


function setStatus(message) {

    statusText.textContent =
        message;
}


/* =========================================================
   BOARD GRID
========================================================= */

function renderGrid() {

    gridGroup.innerHTML = "";

    for (let c = 0; c <= cols; c++) {

        const x =
            c * cellPx;

        const line =
            svgElement("line", {
                x1: x,
                y1: 0,
                x2: x,
                y2: worldHeight,
                class: "grid-line"
            });

        gridGroup.appendChild(line);
    }


    for (let r = 0; r <= rows; r++) {

        const y =
            r * cellPx;

        const line =
            svgElement("line", {
                x1: 0,
                y1: y,
                x2: worldWidth,
                y2: y,
                class: "grid-line"
            });

        gridGroup.appendChild(line);
    }


    gridGroup.classList.toggle(
        "visible",
        gridVisible
    );
}


/* =========================================================
   ARROW VISUAL CREATION
========================================================= */

function createArrowCell(r, c, dir) {

    const key =
        keyFor(r, c);

    const centerX =
        c * cellPx +
        cellPx / 2;

    const centerY =
        r * cellPx +
        cellPx / 2;


    const angleMap = {
        right: 0,
        down: 90,
        left: 180,
        up: -90
    };


    /*
        Outer group:

        Responsible for movement.

        Inner group:

        Responsible for direction rotation.

        Keeping those transforms separate prevents the
        movement animation from fighting the arrow rotation.
    */

    const outer =
        svgElement("g", {
            class: "arrow-cell",
            "data-key": key,
            "data-row": r,
            "data-col": c,
            "aria-label":
                `${dir} arrow at row ${r + 1}, column ${c + 1}`,
            transform:
                `translate(${centerX} ${centerY})`
        });


    const visual =
        svgElement("g", {
            class: "arrow-visual",
            transform:
                `rotate(${angleMap[dir]})`
        });


    /*
        Arrow points RIGHT by default.

        Other directions are created by rotating this one
        inner SVG group.
    */

    const shaft =
        svgElement("line", {
            x1: -cellPx * 0.44,
            y1: 0,
            x2: cellPx * 0.19,
            y2: 0,
            class: "arrow-shaft"
        });


    /*
        Small triangular arrowhead.
    */

    const head =
        svgElement("polygon", {
            points: [
                `${cellPx * 0.15},${-cellPx * 0.16}`,
                `${cellPx * 0.49},0`,
                `${cellPx * 0.15},${cellPx * 0.16}`
            ].join(" "),
            class: "arrow-head"
        });


    /*
        Invisible full-cell click target.

        Every cell remains clickable even where the visual arrow
        itself doesn't cover every pixel.
    */

    const hit =
        svgElement("rect", {
            x: -cellPx / 2,
            y: -cellPx / 2,
            width: cellPx,
            height: cellPx,
            rx: Math.max(3, cellPx * 0.08),
            class: "arrow-hit"
        });


    visual.appendChild(shaft);
    visual.appendChild(head);

    outer.appendChild(visual);
    outer.appendChild(hit);

    return outer;
}


/* =========================================================
   RENDER BOARD
========================================================= */

function renderBoard() {

    world.innerHTML = "";

    /*
        Grid is added first so arrows are always drawn above it.
    */

    world.appendChild(gridGroup);

    renderGrid();


    for (const key of present) {

        const piece =
            board[key];

        const arrow =
            createArrowCell(
                piece.row,
                piece.col,
                piece.dir
            );

        world.appendChild(
            arrow
        );
    }


    /*
        Reinsert the grid group if innerHTML operations ever
        changed its position.
    */

    if (gridGroup.parentNode !== world) {
        world.insertBefore(
            gridGroup,
            world.firstChild
        );
    }
}


/* =========================================================
   EXIT ANIMATION
========================================================= */

function playExitAnimation(
    r,
    c,
    dir
) {

    const key =
        keyFor(r, c);

    const arrow =
        world.querySelector(
            `[data-key="${key}"]`
        );

    if (!arrow) {
        return;
    }


    const piece =
        board[key];

    const startX =
        piece.col * cellPx +
        cellPx / 2;

    const startY =
        piece.row * cellPx +
        cellPx / 2;


    let targetX =
        startX;

    let targetY =
        startY;


    const extra =
        cellPx * 0.80;


    if (dir === "right") {
        targetX =
            worldWidth + extra;
    }

    if (dir === "left") {
        targetX =
            -extra;
    }

    if (dir === "down") {
        targetY =
            worldHeight + extra;
    }

    if (dir === "up") {
        targetY =
            -extra;
    }


    const deltaX =
        targetX - startX;

    const deltaY =
        targetY - startY;


    arrow.style.pointerEvents =
        "none";


    const translation =
        svgElement(
            "animateTransform",
            {
                attributeName: "transform",
                attributeType: "XML",
                type: "translate",

                from: "0 0",

                to:
                    `${deltaX} ${deltaY}`,

                dur: "200ms",

                fill: "freeze",

                additive: "sum"
            }
        );


    const opacity =
        svgElement(
            "animate",
            {
                attributeName: "opacity",

                from: "1",
                to: "0",

                dur: "190ms",

                fill: "freeze"
            }
        );


    arrow.appendChild(
        translation
    );

    arrow.appendChild(
        opacity
    );


    translation.beginElement();
    opacity.beginElement();


    window.setTimeout(() => {

        if (arrow.parentNode) {
            arrow.parentNode.removeChild(
                arrow
            );
        }

    }, 220);
}


/* =========================================================
   ILLEGAL MOVE FEEDBACK
========================================================= */

function playShakeAnimation(
    r,
    c
) {

    const key =
        keyFor(r, c);

    const arrow =
        world.querySelector(
            `[data-key="${key}"]`
        );

    if (!arrow) {
        return;
    }


    const visual =
        arrow.querySelector(
            ".arrow-visual"
        );


    if (visual) {

        visual.classList.remove(
            "blocked"
        );

        /*
            Force browser to restart the flash animation.
        */

        void visual.offsetWidth;

        visual.classList.add(
            "blocked"
        );

        window.setTimeout(() => {
            visual.classList.remove(
                "blocked"
            );
        }, 220);
    }


    /*
        Shake is deliberately tiny because cell sizes can become
        as small as 24px on Nightmare.
    */

    const shake =
        cellPx * 0.075;


    const animation =
        svgElement(
            "animateTransform",
            {
                attributeName: "transform",
                attributeType: "XML",
                type: "translate",

                values: [
                    "0 0",
                    `${-shake} 0`,
                    `${shake} 0`,
                    `${-shake * 0.65} 0`,
                    `${shake * 0.65} 0`,
                    "0 0"
                ].join(";"),

                dur: "200ms",

                fill: "freeze",

                additive: "sum"
            }
        );


    arrow.appendChild(
        animation
    );

    animation.beginElement();


    window.setTimeout(() => {

        if (animation.parentNode) {
            animation.parentNode.removeChild(
                animation
            );
        }

    }, 220);
}


/* =========================================================
   RUNTIME TAP HANDLER
========================================================= */

function handleTap(
    r,
    c
) {

    if (gameLocked) {
        return;
    }


    const key =
        keyFor(r, c);


    /*
        Already cleared arrows are ignored.
    */

    if (!present.has(key)) {
        return;
    }


    const piece =
        board[key];


    /*
        Use the SAME path-clear function used during generation.
    */

    if (
        isPathClear(
            r,
            c,
            piece.dir,
            rows,
            cols,
            present
        )
    ) {

        /*
            Legal move.
        */

        present.delete(key);

        moveHistory.push(key);

        clearedCount++;


        playExitAnimation(
            r,
            c,
            piece.dir
        );


        updateProgress();

        undoButton.disabled = false;


        if (
            clearedCount ===
            rows * cols
        ) {

            showWinOverlay();

            return;
        }


        setStatus(
            "Nice. Find the next clear path."
        );


    } else {

        /*
            Illegal move.

            Exactly ONE life is removed.
        */

        const lostHeartIndex =
            lives - 1;

        lives--;


        playShakeAnimation(
            r,
            c
        );


        updateHeartsUI(
            lostHeartIndex
        );


        if (lives <= 0) {

            lives = 0;

            gameLocked = true;

            showGameOverOverlay();

            return;
        }


        setStatus(
            "Blocked! That move cost a life."
        );
    }
}


/* =========================================================
   HINT SYSTEM
========================================================= */

function getHint() {

    for (const key of present) {

        const [r, c] =
            key
                .split(",")
                .map(Number);


        const {
            dir
        } =
            board[key];


        if (
            isPathClear(
                r,
                c,
                dir,
                rows,
                cols,
                present
            )
        ) {
            return {
                r,
                c
            };
        }
    }


    return null;
}


function useHint() {

    if (gameLocked) {
        return;
    }


    const hint =
        getHint();


    if (!hint) {

        setStatus(
            "No legal move found."
        );

        return;
    }


    const key =
        keyFor(
            hint.r,
            hint.c
        );


    const arrow =
        world.querySelector(
            `[data-key="${key}"]`
        );


    if (!arrow) {
        return;
    }


    const visual =
        arrow.querySelector(
            ".arrow-visual"
        );


    if (!visual) {
        return;
    }


    visual.classList.remove(
        "hint"
    );

    void visual.offsetWidth;

    visual.classList.add(
        "hint"
    );


    if (hintTimeout) {
        window.clearTimeout(
            hintTimeout
        );
    }


    hintTimeout =
        window.setTimeout(() => {

            visual.classList.remove(
                "hint"
            );

        }, 1600);


    setStatus(
        "Hint: this arrow can be cleared now."
    );
}


/* =========================================================
   UNDO
========================================================= */

function undoLastMove() {

    if (gameLocked) {
        return;
    }


    if (moveHistory.length === 0) {
        return;
    }


    const key =
        moveHistory.pop();


    if (
        board[key] &&
        !present.has(key)
    ) {

        present.add(key);

        clearedCount--;

        renderBoard();

        updateProgress();

        undoButton.disabled =
            moveHistory.length === 0;

        setStatus(
            "Last cleared arrow restored."
        );
    }
}


/* =========================================================
   GRID TOGGLE
========================================================= */

function toggleGrid() {

    if (
        !DIFFICULTIES[
            difficultyName
        ].gridToggle
    ) {
        return;
    }


    gridVisible =
        !gridVisible;


    gridGroup.classList.toggle(
        "visible",
        gridVisible
    );


    gridToggle.setAttribute(
        "aria-pressed",
        String(gridVisible)
    );
}


/* =========================================================
   VIEW / ZOOM
========================================================= */

function resetView() {

    scale = 1;

    panX = 0;
    panY = 0;

    applyWorldTransform();
}


function applyWorldTransform() {

    world.setAttribute(
        "transform",
        `translate(${panX} ${panY}) scale(${scale})`
    );
}


function clampPan() {

    /*
        Allow a little overscroll but don't let the board
        disappear completely.
    */

    const margin =
        cellPx * 2;


    const minX =
        worldWidth -
        worldWidth * scale -
        margin;


    const maxX =
        margin;


    const minY =
        worldHeight -
        worldHeight * scale -
        margin;


    const maxY =
        margin;


    panX =
        clamp(
            panX,
            minX,
            maxX
        );


    panY =
        clamp(
            panY,
            minY,
            maxY
        );
}


function updateZoomUI() {

    boardWrap.classList.toggle(
        "zoomable",
        zoomPan
    );

    zoomTip.style.display =
        zoomPan
            ? "block"
            : "none";
}


/* =========================================================
   CLIENT → SVG COORDINATES
========================================================= */

function clientToSvg(
    clientX,
    clientY
) {

    const point =
        boardSvg.createSVGPoint();

    point.x = clientX;
    point.y = clientY;


    const matrix =
        boardSvg.getScreenCTM();


    if (!matrix) {
        return {
            x: 0,
            y: 0
        };
    }


    const result =
        point.matrixTransform(
            matrix.inverse()
        );


    return {
        x: result.x,
        y: result.y
    };
}


/* =========================================================
   ZOOM AROUND POINTER
========================================================= */

function zoomAroundPoint(
    clientX,
    clientY,
    factor
) {

    if (!zoomPan) {
        return;
    }


    const point =
        clientToSvg(
            clientX,
            clientY
        );


    const worldX =
        (point.x - panX) / scale;

    const worldY =
        (point.y - panY) / scale;


    const newScale =
        clamp(
            scale * factor,
            0.7,
            3
        );


    panX =
        point.x -
        worldX * newScale;


    panY =
        point.y -
        worldY * newScale;


    scale =
        newScale;


    clampPan();

    applyWorldTransform();
}


/* =========================================================
   POINTER / TOUCH STATE
========================================================= */

const pointers = new Map();

let gesture = null;


/* =========================================================
   POINTER DOWN
========================================================= */

function handlePointerDown(event) {

    const keyElement =
        event.target.closest
            ? event.target.closest(
                "[data-key]"
            )
            : null;


    pointers.set(
        event.pointerId,
        {
            x: event.clientX,
            y: event.clientY
        }
    );


    try {
        boardSvg.setPointerCapture(
            event.pointerId
        );
    } catch (error) {
        /*
            Pointer capture is optional.
            The game still works without it.
        */
    }


    /*
        Non-zoom difficulties:

        Only care about simple taps.
    */

    if (!zoomPan) {

        gesture = {
            mode: "tap",

            pointerId:
                event.pointerId,

            startX:
                event.clientX,

            startY:
                event.clientY,

            moved: false,

            tapKey:
                keyElement
                    ? keyElement.dataset.key
                    : null
        };

        return;
    }


    /*
        First pointer = potential pan or tap.
    */

    if (pointers.size === 1) {

        gesture = {
            mode: "pan",

            pointerId:
                event.pointerId,

            startX:
                event.clientX,

            startY:
                event.clientY,

            startPanX:
                panX,

            startPanY:
                panY,

            moved: false,

            tapKey:
                keyElement
                    ? keyElement.dataset.key
                    : null
        };

        return;
    }


    /*
        Second pointer = pinch gesture.
    */

    if (pointers.size === 2) {

        const points =
            Array.from(
                pointers.values()
            );


        const first =
            points[0];

        const second =
            points[1];


        const centerX =
            (first.x + second.x) / 2;

        const centerY =
            (first.y + second.y) / 2;


        const distance =
            Math.hypot(
                second.x - first.x,
                second.y - first.y
            );


        const centerSvg =
            clientToSvg(
                centerX,
                centerY
            );


        const anchorWorldX =
            (centerSvg.x - panX) /
            scale;

        const anchorWorldY =
            (centerSvg.y - panY) /
            scale;


        gesture = {
            mode: "pinch",

            startDistance:
                Math.max(
                    distance,
                    1
                ),

            startScale:
                scale,

            anchorWorldX,
            anchorWorldY
        };
    }
}


/* =========================================================
   POINTER MOVE
========================================================= */

function handlePointerMove(event) {

    if (
        !pointers.has(
            event.pointerId
        )
    ) {
        return;
    }


    pointers.set(
        event.pointerId,
        {
            x: event.clientX,
            y: event.clientY
        }
    );


    if (!gesture) {
        return;
    }


    /*
        Normal tap / non-zoom movement.
    */

    if (
        !zoomPan &&
        gesture.mode === "tap"
    ) {

        const distance =
            Math.hypot(
                event.clientX -
                    gesture.startX,

                event.clientY -
                    gesture.startY
            );


        if (distance > 8) {
            gesture.moved = true;
        }


        return;
    }


    /*
        One-finger pan.
    */

    if (
        zoomPan &&
        pointers.size === 1 &&
        gesture.mode === "pan"
    ) {

        const startSvg =
            clientToSvg(
                gesture.startX,
                gesture.startY
            );


        const currentSvg =
            clientToSvg(
                event.clientX,
                event.clientY
            );


        const dx =
            currentSvg.x -
            startSvg.x;

        const dy =
            currentSvg.y -
            startSvg.y;


        if (
            Math.hypot(
                dx,
                dy
            ) > 5
        ) {
            gesture.moved = true;
        }


        panX =
            gesture.startPanX +
            dx;

        panY =
            gesture.startPanY +
            dy;


        clampPan();

        applyWorldTransform();

        return;
    }


    /*
        Two-finger pinch + pan.
    */

    if (
        zoomPan &&
        pointers.size === 2 &&
        gesture.mode === "pinch"
    ) {

        const points =
            Array.from(
                pointers.values()
            );


        const first =
            points[0];

        const second =
            points[1];


        const centerX =
            (first.x + second.x) / 2;

        const centerY =
            (first.y + second.y) / 2;


        const distance =
            Math.hypot(
                second.x - first.x,
                second.y - first.y
            );


        const newScale =
            clamp(
                gesture.startScale *
                    (
                        distance /
                        gesture.startDistance
                    ),
                0.7,
                3
            );


        const centerSvg =
            clientToSvg(
                centerX,
                centerY
            );


        scale =
            newScale;


        panX =
            centerSvg.x -
            gesture.anchorWorldX *
            scale;


        panY =
            centerSvg.y -
            gesture.anchorWorldY *
            scale;


        clampPan();

        applyWorldTransform();
    }
}


/* =========================================================
   POINTER UP
========================================================= */

function handlePointerUp(event) {

    const currentGesture =
        gesture;


    pointers.delete(
        event.pointerId
    );


    /*
        Simple tap.
    */

    if (
        currentGesture &&
        (
            currentGesture.mode === "tap" ||
            currentGesture.mode === "pan"
        ) &&
        !currentGesture.moved &&
        currentGesture.tapKey
    ) {

        const [
            r,
            c
        ] =
            currentGesture.tapKey
                .split(",")
                .map(Number);


        /*
            In pinch-enabled mode, don't count a pointer
            as a tap if another pointer was involved.
        */

        if (
            !zoomPan ||
            pointers.size === 0
        ) {

            handleTap(
                r,
                c
            );
        }
    }


    /*
        If a pinch ends but one finger remains,
        convert that remaining finger into a new pan gesture.
    */

    if (
        zoomPan &&
        pointers.size === 1
    ) {

        const [
            remainingId,
            remainingPoint
        ] =
            Array.from(
                pointers.entries()
            )[0];


        gesture = {
            mode: "pan",

            pointerId:
                remainingId,

            startX:
                remainingPoint.x,

            startY:
                remainingPoint.y,

            startPanX:
                panX,

            startPanY:
                panY,

            moved: true,

            tapKey: null
        };

        return;
    }


    gesture = null;
}


/* =========================================================
   POINTER CANCEL
========================================================= */

function handlePointerCancel(event) {

    pointers.delete(
        event.pointerId
    );

    gesture = null;
}


/* =========================================================
   WHEEL ZOOM
========================================================= */

function handleWheel(event) {

    if (!zoomPan) {
        return;
    }


    event.preventDefault();


    const factor =
        event.deltaY < 0
            ? 1.10
            : 0.90;


    zoomAroundPoint(
        event.clientX,
        event.clientY,
        factor
    );
}


/* =========================================================
   WIN STATE
========================================================= */

function showWinOverlay() {

    gameLocked = true;


    let stars = 1;

    if (lives === 3) {
        stars = 3;
    } else if (lives === 2) {
        stars = 2;
    }


    starRating.textContent =
        "★".repeat(stars) +
        "☆".repeat(3 - stars);


    starRating.setAttribute(
        "aria-label",
        `${stars} out of 3 stars`
    );


    winDetails.textContent =
        `Level ${currentLevel} cleared with ${lives} ${lives === 1 ? "life" : "lives"} remaining.`;


    winOverlay.hidden = false;
}


/* =========================================================
   GAME OVER
========================================================= */

function showGameOverOverlay() {

    gameLocked = true;

    updateHeartsUI();

    gameOverOverlay.hidden =
        false;
}


/* =========================================================
   HIDE OVERLAYS
========================================================= */

function hideOverlays() {

    winOverlay.hidden =
        true;

    gameOverOverlay.hidden =
        true;
}


/* =========================================================
   BACK / MENU
========================================================= */

function goBack() {

    /*
        First try browser history.

        If this game is opened directly with no useful history,
        fall back to ../index.html.

        This also makes it suitable for later placement inside
        a GameHub/games/ folder.
    */

    if (
        window.history.length > 1
    ) {

        window.history.back();

        return;
    }


    window.location.href =
        "../index.html";
}


/* =========================================================
   NEXT LEVEL
========================================================= */

function goNextLevel() {

    hideOverlays();

    loadLevel(
        currentLevel + 1
    );
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

hintButton.addEventListener(
    "click",
    useHint
);


undoButton.addEventListener(
    "click",
    undoLastMove
);


restartButton.addEventListener(
    "click",
    restartCurrentLevel
);


backButton.addEventListener(
    "click",
    goBack
);


gridToggle.addEventListener(
    "click",
    toggleGrid
);


nextLevelButton.addEventListener(
    "click",
    goNextLevel
);


winMenuButton.addEventListener(
    "click",
    goBack
);


retryButton.addEventListener(
    "click",
    retrySameBoard
);


newPuzzleButton.addEventListener(
    "click",
    restartCurrentLevel
);


/* =========================================================
   BOARD POINTER EVENTS
========================================================= */

boardSvg.addEventListener(
    "pointerdown",
    handlePointerDown
);

boardSvg.addEventListener(
    "pointermove",
    handlePointerMove
);

boardSvg.addEventListener(
    "pointerup",
    handlePointerUp
);

boardSvg.addEventListener(
    "pointercancel",
    handlePointerCancel
);

boardSvg.addEventListener(
    "wheel",
    handleWheel,
    {
        passive: false
    }
);


/* =========================================================
   PREVENT CONTEXT MENU ON THE BOARD
========================================================= */

boardSvg.addEventListener(
    "contextmenu",
    event => {
        event.preventDefault();
    }
);


/* =========================================================
   START GAME
========================================================= */

loadLevel(1);
