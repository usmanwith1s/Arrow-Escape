/* =========================================================
   ARROW ESCAPE
   Complete Game Engine
========================================================= */


/* =========================================================
   DIRECTIONS
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
   DIFFICULTIES
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
   STATE
========================================================= */

let currentLevel = 1;

let difficultyName = "Easy";

let rows = 6;
let cols = 6;
let cellPx = 48;

let worldWidth = 0;
let worldHeight = 0;

let board = {};

let present = new Set();

let solveOrder = [];

let clearedCount = 0;

let lives = 3;

let moveHistory = [];

let gameLocked = false;

let zoomPan = false;

let gridVisible = false;


/* =========================================================
   ZOOM STATE
========================================================= */

let scale = 1;
let panX = 0;
let panY = 0;

const pointers = new Map();

let gesture = null;


/* =========================================================
   DOM
========================================================= */

const boardWrap =
    document.getElementById("boardWrap");

const boardSvg =
    document.getElementById("boardSvg");

const world =
    document.getElementById("world");

const gridGroup =
    document.getElementById("gridGroup");

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
   HELPERS
========================================================= */

function keyFor(r, c) {
    return `${r},${c}`;
}


function inBounds(r, c, rows, cols) {

    return (
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < cols
    );
}


/* =========================================================
   SINGLE SOURCE OF TRUTH
========================================================= */

function isPathClear(
    r,
    c,
    dir,
    rows,
    cols,
    present
) {

    const {
        dr,
        dc
    } = DIRS[dir];


    let nr = r + dr;
    let nc = c + dc;


    while (
        inBounds(
            nr,
            nc,
            rows,
            cols
        )
    ) {

        if (
            present.has(
                `${nr},${nc}`
            )
        ) {

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
    We NEVER randomly assign directions and hope.

    Instead we build a valid solution backwards.

    `present` starts with every cell.

    At every step:

      1. Find cells that currently have a legal exit.
      2. Choose one.
      3. Give it one of its currently legal directions.
      4. Remove it from the simulation.

    WHY CAN candidates NEVER BE EMPTY?

    Consider the remaining cell with the smallest column index.

    Every cell to its left in the same row must already have
    been removed from `present`.

    Otherwise there would still be a surviving cell with an
    even smaller column index.

    Therefore LEFT is always clear for that cell.

    So there is always at least one candidate.

    Because every direction is assigned while it is legal,
    replaying solveOrder from the original full board is
    guaranteed to clear every arrow.
*/

function generateSolvableBoard(
    rows,
    cols
) {

    const generationPresent =
        new Set();


    for (
        let r = 0;
        r < rows;
        r++
    ) {

        for (
            let c = 0;
            c < cols;
            c++
        ) {

            generationPresent.add(
                keyFor(r, c)
            );
        }
    }


    const generatedBoard = {};

    const generatedSolveOrder = [];


    while (
        generationPresent.size > 0
    ) {

        const candidates = [];


        for (
            const key
            of generationPresent
        ) {

            const [
                r,
                c
            ] =
                key
                    .split(",")
                    .map(Number);


            const validDirs =
                Object.keys(DIRS)
                    .filter(dir =>
                        isPathClear(
                            r,
                            c,
                            dir,
                            rows,
                            cols,
                            generationPresent
                        )
                    );


            if (
                validDirs.length > 0
            ) {

                candidates.push({
                    r,
                    c,
                    key,
                    validDirs
                });
            }
        }


        if (
            candidates.length === 0
        ) {

            throw new Error(
                "Level generation stalled."
            );
        }


        const pick =
            candidates[
                Math.floor(
                    Math.random() *
                    candidates.length
                )
            ];


        const dir =
            pick.validDirs[
                Math.floor(
                    Math.random() *
                    pick.validDirs.length
                )
            ];


        generatedBoard[pick.key] = {
            row: pick.r,
            col: pick.c,
            dir
        };


        generatedSolveOrder.push({
            row: pick.r,
            col: pick.c,
            dir
        });


        generationPresent.delete(
            pick.key
        );
    }


    /*
        Verify our generated board before displaying it.
    */

    if (
        !verifyGeneratedBoard(
            generatedBoard,
            generatedSolveOrder,
            rows,
            cols
        )
    ) {

        throw new Error(
            "Generated board failed verification."
        );
    }


    return {
        board: generatedBoard,
        solveOrder: generatedSolveOrder
    };
}


/* =========================================================
   VERIFY SOLUTION
========================================================= */

function verifyGeneratedBoard(
    board,
    solveOrder,
    rows,
    cols
) {

    const simulation =
        new Set(
            Object.keys(board)
        );


    for (
        const move
        of solveOrder
    ) {

        const key =
            keyFor(
                move.row,
                move.col
            );


        if (
            !simulation.has(key)
        ) {

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


    return (
        simulation.size === 0
    );
}


/* =========================================================
   LEVEL DIFFICULTY
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

    currentLevel =
        Math.max(1, level);


    difficultyName =
        getDifficultyForLevel(
            currentLevel
        );


    const settings =
        DIFFICULTIES[
            difficultyName
        ];


    rows =
        settings.rows;

    cols =
        settings.cols;

    cellPx =
        settings.cellPx;

    zoomPan =
        settings.zoomPan;


    worldWidth =
        cols * cellPx;

    worldHeight =
        rows * cellPx;


    /*
        THIS WAS THE BIG BUG IN THE OLD VERSION.

        The SVG now knows exactly how large our game world is.
    */

    boardSvg.setAttribute(
        "viewBox",
        `0 0 ${worldWidth} ${worldHeight}`
    );


    boardSvg.setAttribute(
        "preserveAspectRatio",
        "xMidYMid meet"
    );


    const generated =
        generateSolvableBoard(
            rows,
            cols
        );


    board =
        generated.board;

    solveOrder =
        generated.solveOrder;


    present =
        new Set(
            Object.keys(board)
        );


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
        new Set(
            Object.keys(board)
        );

    clearedCount = 0;

    lives = 3;

    moveHistory = [];

    gameLocked = false;


    hideOverlays();

    resetView();

    renderBoard();

    updateUI();


    setStatus(
        "Same puzzle. Try a different order."
    );
}


/* =========================================================
   NEW PUZZLE
========================================================= */

function restartCurrentLevel() {

    loadLevel(
        currentLevel
    );

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
        !DIFFICULTIES[
            difficultyName
        ].gridToggle;
}


function updateProgress() {

    const total =
        rows * cols;


    progressText.textContent =
        `${clearedCount} / ${total}`;


    const percentage =
        total === 0
            ? 0
            : (
                clearedCount /
                total
            ) * 100;


    progressFill.style.width =
        `${percentage}%`;
}


function updateHeartsUI(
    lostHeartIndex = -1
) {

    heartsElement.innerHTML = "";


    heartsElement.setAttribute(
        "aria-label",
        `${lives} lives remaining`
    );


    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const heart =
            document.createElement(
                "span"
            );


        heart.className =
            "heart";


        heart.textContent =
            i < lives
                ? "♥"
                : "♡";


        if (i >= lives) {
            heart.classList.add(
                "empty"
            );
        }


        if (
            i === lostHeartIndex
        ) {

            heart.classList.add(
                "breaking"
            );
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
   GRID
========================================================= */

function renderGrid() {

    gridGroup.innerHTML = "";


    for (
        let c = 0;
        c <= cols;
        c++
    ) {

        const x =
            c * cellPx;


        gridGroup.appendChild(
            svgElement(
                "line",
                {
                    x1: x,
                    y1: 0,
                    x2: x,
                    y2: worldHeight,
                    class: "grid-line"
                }
            )
        );
    }


    for (
        let r = 0;
        r <= rows;
        r++
    ) {

        const y =
            r * cellPx;


        gridGroup.appendChild(
            svgElement(
                "line",
                {
                    x1: 0,
                    y1: y,
                    x2: worldWidth,
                    y2: y,
                    class: "grid-line"
                }
            )
        );
    }


    gridGroup.classList.toggle(
        "visible",
        gridVisible
    );
}


/* =========================================================
   SVG HELPER
========================================================= */

function svgElement(
    name,
    attributes = {}
) {

    const element =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            name
        );


    for (
        const [
            key,
            value
        ]
        of Object.entries(attributes)
    ) {

        element.setAttribute(
            key,
            value
        );
    }


    return element;
}


/* =========================================================
   ARROW CREATION
========================================================= */

function createArrowCell(
    r,
    c,
    dir
) {

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


    const strokeWidth =
        Math.max(
            2.8,
            cellPx * 0.085
        );


    /*
        OUTER GROUP

        Handles movement.

        INNER GROUP

        Handles direction.

        Keeping these separate avoids the transform problems
        from the previous version.
    */

   const outer =
    svgElement(
        "g",
        {
            class: "arrow-cell",
            "data-key": key,
            "data-row": r,
            "data-col": c,
            "aria-label": `${dir} arrow`,

                "data-key": key,

                "data-row": r,

                "data-col": c,

                role: "gridcell",

                "aria-label":
                    `${dir} arrow`
            }
        );


    const movement =
        svgElement(
            "g",
            {
                transform:
                    `translate(${centerX} ${centerY})`
            }
        );


    const visual =
        svgElement(
            "g",
            {
                class: "arrow-visual",

                style:
                    `--arrow-stroke:${strokeWidth}px`,

                transform:
                    `rotate(${angleMap[dir]})`
            }
        );


    /*
        MUCH LONGER SHAFT.

        Old version:
            -0.44 → 0.19

        New version:
            -0.48 → 0.32

        This lets neighboring arrows visually flow into
        each other instead of looking like disconnected sticks.
    */

    const shaft =
        svgElement(
            "line",
            {
                x1:
                    -cellPx * 0.48,

                y1: 0,

                x2:
                    cellPx * 0.32,

                y2: 0,

                class: "arrow-shaft"
            }
        );


    /*
        SMALL ARROWHEAD NEAR THE CELL EDGE
    */

    const head =
        svgElement(
            "polygon",
            {
                points: [
                    `${cellPx * 0.28},${-cellPx * 0.13}`,

                    `${cellPx * 0.50},0`,

                    `${cellPx * 0.28},${cellPx * 0.13}`
                ].join(" "),

                class: "arrow-head"
            }
        );


    /*
        FULL-CELL HIT TARGET
    */

    const hit =
        svgElement(
            "rect",
            {
                x:
                    -cellPx / 2,

                y:
                    -cellPx / 2,

                width:
                    cellPx,

                height:
                    cellPx,

                rx:
                    Math.max(
                        2,
                        cellPx * 0.04
                    ),

                class:
                    "arrow-hit"
            }
        );


    visual.appendChild(
        shaft
    );

    visual.appendChild(
        head
    );

    movement.appendChild(
        visual
    );

    outer.appendChild(
        movement
    );

    outer.appendChild(
        hit
    );


    return outer;
}


/* =========================================================
   RENDER BOARD
========================================================= */

function renderBoard() {

    /*
        Don't accidentally lose the grid group.
    */

    world.innerHTML = "";

    world.appendChild(
        gridGroup
    );


    renderGrid();


    for (
        const key
        of present
    ) {

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


    const movement =
        arrow.querySelector(
            ".arrow-visual"
        )
            ?.parentElement;


    if (!movement) {
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
        cellPx;


    if (dir === "right") {
        targetX =
            worldWidth +
            extra;
    }


    if (dir === "left") {
        targetX =
            -extra;
    }


    if (dir === "down") {
        targetY =
            worldHeight +
            extra;
    }


    if (dir === "up") {
        targetY =
            -extra;
    }


    const dx =
        targetX -
        startX;


    const dy =
        targetY -
        startY;


    arrow.style.pointerEvents =
        "none";


    const animation =
        svgElement(
            "animateTransform",
            {
                attributeName:
                    "transform",

                attributeType:
                    "XML",

                type:
                    "translate",

                from:
                    "0 0",

                to:
                    `${dx} ${dy}`,

                dur:
                    "190ms",

                fill:
                    "freeze",

                additive:
                    "sum"
            }
        );


    const opacity =
        svgElement(
            "animate",
            {
                attributeName:
                    "opacity",

                from:
                    "1",

                to:
                    "0",

                dur:
                    "180ms",

                fill:
                    "freeze"
            }
        );


    movement.appendChild(
        animation
    );


    arrow.appendChild(
        opacity
    );


    animation.beginElement();

    opacity.beginElement();


    window.setTimeout(
        () => {

            if (
                arrow.parentNode
            ) {

                arrow.parentNode.removeChild(
                    arrow
                );
            }

        },
        210
    );
}


/* =========================================================
   ILLEGAL MOVE
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


    if (!visual) {
        return;
    }


    visual.classList.remove(
        "blocked"
    );


    void visual.offsetWidth;


    visual.classList.add(
        "blocked"
    );


    window.setTimeout(
        () => {

            visual.classList.remove(
                "blocked"
            );

        },
        220
    );
}


/* =========================================================
   TAP
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


    if (!present.has(key)) {
        return;
    }


    const piece =
        board[key];


    /*
        SAME path check used by the generator.
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
            LEGAL
        */

        present.delete(
            key
        );


        moveHistory.push(
            key
        );


        clearedCount++;


        playExitAnimation(
            r,
            c,
            piece.dir
        );


        updateProgress();


        undoButton.disabled =
            false;


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
            ILLEGAL

            Exactly one life lost.
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
   HINT
========================================================= */

function getHint() {

    for (
        const key
        of present
    ) {

        const [
            r,
            c
        ] =
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


    setStatus(
        "Hint: this arrow can leave now."
    );


    window.setTimeout(
        () => {

            visual.classList.remove(
                "hint"
            );

        },
        1600
    );
}


/* =========================================================
   UNDO
========================================================= */

function undoLastMove() {

    if (gameLocked) {
        return;
    }


    if (
        moveHistory.length === 0
    ) {
        return;
    }


    const key =
        moveHistory.pop();


    if (
        board[key] &&
        !present.has(key)
    ) {

        present.add(
            key
        );


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
   GRID
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
   VIEW
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
        Math.min(
            Math.max(
                panX,
                minX
            ),
            maxX
        );


    panY =
        Math.min(
            Math.max(
                panY,
                minY
            ),
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
   SCREEN → SVG
========================================================= */

function clientToSvg(
    clientX,
    clientY
) {

    const point =
        boardSvg.createSVGPoint();


    point.x =
        clientX;

    point.y =
        clientY;


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
   ZOOM
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
        (
            point.x -
            panX
        ) / scale;


    const worldY =
        (
            point.y -
            panY
        ) / scale;


    const newScale =
        Math.min(
            Math.max(
                scale * factor,
                0.7
            ),
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
   POINTERS
========================================================= */

function handlePointerDown(
    event
) {

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
        */
    }


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


    if (
        pointers.size === 1
    ) {

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


    if (
        pointers.size === 2
    ) {

        const points =
            Array.from(
                pointers.values()
            );


        const a =
            points[0];

        const b =
            points[1];


        const centerX =
            (a.x + b.x) / 2;


        const centerY =
            (a.y + b.y) / 2;


        const distance =
            Math.hypot(
                b.x - a.x,
                b.y - a.y
            );


        const centerSvg =
            clientToSvg(
                centerX,
                centerY
            );


        gesture = {

            mode: "pinch",

            startDistance:
                Math.max(
                    distance,
                    1
                ),

            startScale:
                scale,

            anchorWorldX:
                (
                    centerSvg.x -
                    panX
                ) / scale,

            anchorWorldY:
                (
                    centerSvg.y -
                    panY
                ) / scale
        };
    }
}


function handlePointerMove(
    event
) {

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


        if (
            distance > 8
        ) {

            gesture.moved = true;
        }


        return;
    }


    if (
        zoomPan &&
        pointers.size === 1 &&
        gesture.mode === "pan"
    ) {

        const start =
            clientToSvg(
                gesture.startX,
                gesture.startY
            );


        const current =
            clientToSvg(
                event.clientX,
                event.clientY
            );


        const dx =
            current.x -
            start.x;


        const dy =
            current.y -
            start.y;


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


    if (
        zoomPan &&
        pointers.size === 2 &&
        gesture.mode === "pinch"
    ) {

        const points =
            Array.from(
                pointers.values()
            );


        const a =
            points[0];

        const b =
            points[1];


        const centerX =
            (a.x + b.x) / 2;


        const centerY =
            (a.y + b.y) / 2;


        const distance =
            Math.hypot(
                b.x - a.x,
                b.y - a.y
            );


        scale =
            Math.min(
                Math.max(
                    gesture.startScale *
                    (
                        distance /
                        gesture.startDistance
                    ),
                    0.7
                ),
                3
            );


        const centerSvg =
            clientToSvg(
                centerX,
                centerY
            );


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


function handlePointerUp(
    event
) {

    const currentGesture =
        gesture;


    pointers.delete(
        event.pointerId
    );


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


    if (
        zoomPan &&
        pointers.size === 1
    ) {

        const [
            id,
            point
        ] =
            Array.from(
                pointers.entries()
            )[0];


        gesture = {

            mode: "pan",

            pointerId: id,

            startX: point.x,

            startY: point.y,

            startPanX: panX,

            startPanY: panY,

            moved: true,

            tapKey: null
        };


        return;
    }


    gesture = null;
}


function handlePointerCancel(
    event
) {

    pointers.delete(
        event.pointerId
    );

    gesture = null;
}


/* =========================================================
   WHEEL
========================================================= */

function handleWheel(
    event
) {

    if (!zoomPan) {
        return;
    }


    event.preventDefault();


    zoomAroundPoint(
        event.clientX,
        event.clientY,
        event.deltaY < 0
            ? 1.10
            : 0.90
    );
}


/* =========================================================
   WIN
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
        "☆".repeat(
            3 - stars
        );


    winDetails.textContent =
        `Level ${currentLevel} cleared with ${lives} ${lives === 1 ? "life" : "lives"} remaining.`;


    winOverlay.hidden =
        false;
}


/* =========================================================
   GAME OVER
========================================================= */

function showGameOverOverlay() {

    gameLocked = true;

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
   BACK
========================================================= */

function goBack() {

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
   EVENTS
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
    () =>
        loadLevel(
            currentLevel + 1
        )
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
   BOARD EVENTS
========================================================= */

/*
    NORMAL DIFFICULTIES
    -------------------
    Use a simple click event.

    This avoids the pointer-gesture system interfering with
    ordinary taps/clicks.
*/

boardSvg.addEventListener("click", event => {

    if (zoomPan) {
        return;
    }

    const arrow =
        event.target.closest("[data-key]");

    if (!arrow) {
        return;
    }

    const r =
        Number(arrow.dataset.row);

    const c =
        Number(arrow.dataset.col);

    handleTap(r, c);
});


/*
    ZOOM/PAN DIFFICULTIES
    ---------------------
    Keep the pointer system only where it is actually needed.
*/

boardSvg.addEventListener(
    "pointerdown",
    event => {

        if (zoomPan) {
            handlePointerDown(event);
        }
    }
);


boardSvg.addEventListener(
    "pointermove",
    event => {

        if (zoomPan) {
            handlePointerMove(event);
        }
    }
);


boardSvg.addEventListener(
    "pointerup",
    event => {

        if (zoomPan) {
            handlePointerUp(event);
        }
    }
);


boardSvg.addEventListener(
    "pointercancel",
    event => {

        if (zoomPan) {
            handlePointerCancel(event);
        }
    }
);


boardSvg.addEventListener(
    "wheel",
    handleWheel,
    {
        passive: false
    }
);


boardSvg.addEventListener(
    "contextmenu",
    event => {
        event.preventDefault();
    }
);


/* =========================================================
   START
========================================================= */

loadLevel(1);
