const board = document.getElementById("board");
const levelDisplay = document.getElementById("level");
const livesDisplay = document.getElementById("lives");
const message = document.getElementById("gameMessage");
const restartButton = document.getElementById("restartButton");

let level = 1;
let lives = 3;
let arrows = [];


/* =========================
   LEVEL DATA
========================= */

const levels = [
    [
        { row: 0, col: 0, direction: "right" },
        { row: 0, col: 1, direction: "down" },
        { row: 1, col: 1, direction: "left" }
    ],

    [
        { row: 0, col: 0, direction: "down" },
        { row: 1, col: 0, direction: "right" },
        { row: 1, col: 1, direction: "down" },
        { row: 2, col: 1, direction: "right" }
    ],

    [
        { row: 0, col: 0, direction: "right" },
        { row: 0, col: 1, direction: "down" },
        { row: 1, col: 1, direction: "left" },
        { row: 1, col: 0, direction: "down" },
        { row: 2, col: 0, direction: "right" }
    ]
];


/* =========================
   START GAME
========================= */

function startLevel() {

    board.innerHTML = "";
    arrows = [];

    lives = 3;

    updateStats();

    message.textContent = "Clear all the arrows!";

    const levelData = levels[(level - 1) % levels.length];

    createArrows(levelData);
}


/* =========================
   CREATE ARROWS
========================= */

function createArrows(levelData) {

    levelData.forEach((data, index) => {

        const arrow = document.createElement("button");

        arrow.classList.add("arrow");

        arrow.textContent = getArrowSymbol(data.direction);

        arrow.dataset.row = data.row;
        arrow.dataset.col = data.col;
        arrow.dataset.direction = data.direction;

        arrow.addEventListener("click", () => {

            moveArrow(index);

        });

        board.appendChild(arrow);

        arrows.push({
            element: arrow,
            row: data.row,
            col: data.col,
            direction: data.direction,
            escaped: false
        });
    });

    positionArrows();
}


/* =========================
   ARROW SYMBOL
========================= */

function getArrowSymbol(direction) {

    if (direction === "up") {
        return "↑";
    }

    if (direction === "down") {
        return "↓";
    }

    if (direction === "left") {
        return "←";
    }

    return "→";
}


/* =========================
   POSITION ARROWS
========================= */

function positionArrows() {

    const gridSize = getGridSize();

    arrows.forEach(arrow => {

        if (arrow.escaped) {
            return;
        }

        const x = ((arrow.col + 0.5) / gridSize) * 100;
        const y = ((arrow.row + 0.5) / gridSize) * 100;

        arrow.element.style.left = x + "%";
        arrow.element.style.top = y + "%";
    });
}


/* =========================
   GRID SIZE
========================= */

function getGridSize() {

    let max = 0;

    arrows.forEach(arrow => {

        max = Math.max(
            max,
            arrow.row,
            arrow.col
        );

    });

    return Math.max(max + 1, 5);
}


/* =========================
   MOVE ARROW
========================= */

function moveArrow(index) {

    const arrow = arrows[index];

    if (!arrow || arrow.escaped) {
        return;
    }

    const blocked = isBlocked(arrow);

    if (blocked) {

        loseLife();

        arrow.element.classList.add("blocked");

        setTimeout(() => {
            arrow.element.classList.remove("blocked");
        }, 250);

        return;
    }

    escapeArrow(arrow);
}


/* =========================
   CHECK BLOCK
========================= */

function isBlocked(arrow) {

    for (let i = 0; i < arrows.length; i++) {

        const other = arrows[i];

        if (other === arrow || other.escaped) {
            continue;
        }

        if (
            arrow.direction === "right" &&
            other.row === arrow.row &&
            other.col > arrow.col
        ) {
            return true;
        }

        if (
            arrow.direction === "left" &&
            other.row === arrow.row &&
            other.col < arrow.col
        ) {
            return true;
        }

        if (
            arrow.direction === "down" &&
            other.col === arrow.col &&
            other.row > arrow.row
        ) {
            return true;
        }

        if (
            arrow.direction === "up" &&
            other.col === arrow.col &&
            other.row < arrow.row
        ) {
            return true;
        }
    }

    return false;
}


/* =========================
   ESCAPE ARROW
========================= */

function escapeArrow(arrow) {

    arrow.escaped = true;

    arrow.element.classList.add("escaping");

    setTimeout(() => {

        arrow.element.remove();

        checkLevelComplete();

    }, 350);
}


/* =========================
   LOSE LIFE
========================= */

function loseLife() {

    lives--;

    updateStats();

    if (lives <= 0) {

        message.textContent = "Game over!";

        setTimeout(() => {

            startLevel();

        }, 900);

    } else {

        message.textContent =
            "Blocked! Find another arrow.";

    }
}


/* =========================
   LEVEL COMPLETE
========================= */

function checkLevelComplete() {

    const remaining = arrows.filter(
        arrow => !arrow.escaped
    );

    if (remaining.length === 0) {

        message.textContent =
            "Level complete! 🎉";

        setTimeout(() => {

            level++;

            levelDisplay.textContent = level;

            startLevel();

        }, 1000);
    }
}


/* =========================
   UPDATE STATS
========================= */

function updateStats() {

    levelDisplay.textContent = level;

    livesDisplay.textContent =
        "❤️".repeat(lives);
}


/* =========================
   RESTART
========================= */

restartButton.addEventListener("click", () => {

    startLevel();

});


/* =========================
   START
========================= */

startLevel();
