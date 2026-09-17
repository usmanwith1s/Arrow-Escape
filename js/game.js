const board = document.getElementById("board");
const levelDisplay = document.getElementById("level");
const livesDisplay = document.getElementById("lives");
const message = document.getElementById("gameMessage");
const restartButton = document.getElementById("restartButton");

let level = 1;
let lives = 3;
let arrows = [];

const GRID_SIZE = 7;


/* =========================
   LEVELS
========================= */

const levels = [
    [
        { row: 0, col: 0, direction: "right" },
        { row: 0, col: 2, direction: "down" },
        { row: 2, col: 2, direction: "left" },
        { row: 2, col: 0, direction: "down" },
        { row: 4, col: 0, direction: "right" },
        { row: 4, col: 3, direction: "up" }
    ],

    [
        { row: 0, col: 1, direction: "down" },
        { row: 2, col: 1, direction: "right" },
        { row: 2, col: 4, direction: "up" },
        { row: 1, col: 4, direction: "left" },
        { row: 1, col: 2, direction: "down" },
        { row: 4, col: 2, direction: "right" },
        { row: 4, col: 5, direction: "up" },
        { row: 3, col: 5, direction: "left" }
    ],

    [
        { row: 0, col: 0, direction: "right" },
        { row: 0, col: 3, direction: "down" },
        { row: 2, col: 3, direction: "left" },
        { row: 2, col: 1, direction: "down" },
        { row: 4, col: 1, direction: "right" },
        { row: 4, col: 5, direction: "up" },
        { row: 1, col: 5, direction: "left" },
        { row: 1, col: 2, direction: "down" },
        { row: 5, col: 2, direction: "right" },
        { row: 5, col: 6, direction: "up" }
    ]
];


/* =========================
   START LEVEL
========================= */

function startLevel() {

    board.innerHTML = "";
    arrows = [];
    lives = 3;

    updateStats();

    message.textContent = "Clear all the arrows!";

    const levelData =
        levels[(level - 1) % levels.length];

    createArrows(levelData);
}


/* =========================
   CREATE ARROWS
========================= */

function createArrows(levelData) {

    levelData.forEach((data, index) => {

        const arrow = document.createElement("button");

        arrow.className = "arrow";

        arrow.dataset.row = data.row;
        arrow.dataset.col = data.col;
        arrow.dataset.direction = data.direction;

        arrow.setAttribute(
            "aria-label",
            "Arrow " + (index + 1)
        );

        arrow.addEventListener("click", function () {
            moveArrow(index);
        });

        board.appendChild(arrow);

        arrows.push({
            element: arrow,
            row: data.row,
            col: data.col,
            direction: data.direction,
            escaped: false,
            moving: false
        });
    });

    positionArrows();
}


/* =========================
   POSITION ARROWS
========================= */

function positionArrows() {

    arrows.forEach(arrow => {

        if (arrow.escaped) {
            return;
        }

        const x =
            ((arrow.col + 0.5) / GRID_SIZE) * 100;

        const y =
            ((arrow.row + 0.5) / GRID_SIZE) * 100;

        arrow.element.style.left = x + "%";
        arrow.element.style.top = y + "%";
    });
}


/* =========================
   MOVE ARROW
========================= */

function moveArrow(index) {

    const arrow = arrows[index];

    if (!arrow || arrow.escaped || arrow.moving) {
        return;
    }

    arrow.moving = true;

    const blocker = findBlocker(arrow);

    if (blocker) {

        clash(arrow);

        return;
    }

    escapeArrow(arrow);
}


/* =========================
   FIND BLOCKER
========================= */

function findBlocker(arrow) {

    let blocker = null;

    arrows.forEach(other => {

        if (
            other === arrow ||
            other.escaped
        ) {
            return;
        }

        if (arrow.direction === "right") {

            if (
                other.row === arrow.row &&
                other.col > arrow.col
            ) {

                if (
                    blocker === null ||
                    other.col < blocker.col
                ) {
                    blocker = other;
                }
            }
        }


        if (arrow.direction === "left") {

            if (
                other.row === arrow.row &&
                other.col < arrow.col
            ) {

                if (
                    blocker === null ||
                    other.col > blocker.col
                ) {
                    blocker = other;
                }
            }
        }


        if (arrow.direction === "down") {

            if (
                other.col === arrow.col &&
                other.row > arrow.row
            ) {

                if (
                    blocker === null ||
                    other.row < blocker.row
                ) {
                    blocker = other;
                }
            }
        }


        if (arrow.direction === "up") {

            if (
                other.col === arrow.col &&
                other.row < arrow.row
            ) {

                if (
                    blocker === null ||
                    other.row > blocker.row
                ) {
                    blocker = other;
                }
            }
        }
    });

    return blocker;
}


/* =========================
   CLASH
========================= */

function clash(arrow) {

    arrow.element.classList.add("blocked");

    lives--;

    updateStats();

    message.textContent =
        "CLASH! Find another path.";

    setTimeout(() => {

        arrow.element.classList.remove("blocked");

        arrow.moving = false;

    }, 500);


    if (lives <= 0) {

        message.textContent =
            "Out of lives! Restarting...";

        setTimeout(() => {

            startLevel();

        }, 900);
    }
}


/* =========================
   ESCAPE
========================= */

function escapeArrow(arrow) {

    const distance = 120;

    let x = 0;
    let y = 0;

    if (arrow.direction === "right") {
        x = distance;
    }

    if (arrow.direction === "left") {
        x = -distance;
    }

    if (arrow.direction === "down") {
        y = distance;
    }

    if (arrow.direction === "up") {
        y = -distance;
    }

    arrow.escaped = true;

    arrow.element.style.setProperty(
        "--escape-x",
        `calc(-50% + ${x}vw)`
    );

    arrow.element.style.setProperty(
        "--escape-y",
        `calc(-50% + ${y}vh)`
    );

    arrow.element.classList.add("escaping");

    setTimeout(() => {

        arrow.element.remove();

        checkLevelComplete();

    }, 550);
}


/* =========================
   LEVEL COMPLETE
========================= */

function checkLevelComplete() {

    const remaining =
        arrows.filter(
            arrow => !arrow.escaped
        );

    if (remaining.length === 0) {

        message.textContent =
            "LEVEL COMPLETE! 🎉";

        setTimeout(() => {

            level++;

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
        "❤️".repeat(Math.max(lives, 0));
}


/* =========================
   RESTART
========================= */

restartButton.addEventListener(
    "click",
    startLevel
);


/* =========================
   START
========================= */

startLevel();
