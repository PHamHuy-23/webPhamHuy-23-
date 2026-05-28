/* ============================================================
   SCRIPT.JS — AI Algorithm Visualizer
   Supports: BFS, DFS, DLS, Greedy, A*
   Modes: 8-Puzzle, Maze World
   ============================================================ */

// ===== GLOBAL STATE =====
const state = {
    mode: 'puzzle', // 'puzzle' or 'maze'
    algorithm: 'bfs',
    goalCheck: 'evaluation',
    isRunning: false,
    isPaused: false,
    speed: 50,
    stateCounter: 0,

    // Puzzle
    puzzleBoard: [1, 2, 3, 4, 5, 6, 7, 8, 0],
    puzzleGoal: [1, 2, 3, 4, 5, 6, 7, 8, 0],

    // Maze
    mazeSize: 10,
    mazeGrid: [],
    mazeWeights: [],
    mazeStart: [0, 0],
    mazeGoal: [],
    mazeFrontier: new Set(),
    mazeReached: new Set(),
    mazePath: [],
};

let searchIterator = null;
let executionTimer = null;

// ===== PUZZLE UTILITIES =====

function isSolvablePuzzle(board) {
    const tiles = board.filter(x => x !== 0);
    let inversions = 0;
    for (let i = 0; i < tiles.length - 1; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            if (tiles[i] > tiles[j]) inversions++;
        }
    }
    return inversions % 2 === 0;
}

function getPuzzleNeighbors(board) {
    const neighbors = [];
    const zeroIdx = board.indexOf(0);
    const row = Math.floor(zeroIdx / 3);
    const col = zeroIdx % 3;

    const moves = [
        { dr: -1, dc: 0, name: 'U' },
        { dr: 1, dc: 0, name: 'D' },
        { dr: 0, dc: -1, name: 'L' },
        { dr: 0, dc: 1, name: 'R' }
    ];

    for (const move of moves) {
        const nr = row + move.dr;
        const nc = col + move.dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
            const newBoard = [...board];
            const newIdx = nr * 3 + nc;
            [newBoard[zeroIdx], newBoard[newIdx]] = [newBoard[newIdx], newBoard[zeroIdx]];
            neighbors.push({ state: newBoard, action: move.name });
        }
    }
    return neighbors;
}

function puzzleHeuristic(board, type = 'misplaced') {
    if (type === 'misplaced') {
        let count = 0;
        for (let i = 0; i < 9; i++) {
            if (board[i] !== state.puzzleGoal[i]) count++;
        }
        return count;
    }
    return 0;
}

// ===== MAZE UTILITIES =====

function generateMaze() {
    const size = state.mazeSize;
    state.mazeGrid = Array(size).fill(null).map(() => Array(size).fill(1)); // 1 = empty
    state.mazeWeights = Array(size).fill(null).map(() => Array(size).fill(1));

    // Random walls
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if ((i === 0 && j === 0) || (i === size - 1 && j === size - 1)) continue;
            if (Math.random() < 0.25) state.mazeGrid[i][j] = 0; // 0 = wall
        }
    }

    state.mazeStart = [0, 0];
    state.mazeGoal = [size - 1, size - 1];

    // Ensure path exists (simple carving)
    let r = 0, c = 0;
    while (r !== state.mazeGoal[0] || c !== state.mazeGoal[1]) {
        state.mazeGrid[r][c] = 1;
        if (r < state.mazeGoal[0]) r++;
        else if (c < state.mazeGoal[1]) c++;
    }
    state.mazeGrid[r][c] = 1;

    // Random weights
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            state.mazeWeights[i][j] = state.mazeGrid[i][j] === 0 ? 0 : Math.floor(Math.random() * 5) + 1;
        }
    }
}

function getMazeNeighbors(pos) {
    const [r, c] = pos;
    const neighbors = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < state.mazeSize && nc >= 0 && nc < state.mazeSize && state.mazeGrid[nr][nc] === 1) {
            neighbors.push({ state: [nr, nc], cost: state.mazeWeights[nr][nc] });
        }
    }
    return neighbors;
}

function mazeHeuristic(pos, type = 'manhattan') {
    const [r, c] = pos;
    const [gr, gc] = state.mazeGoal;
    return Math.abs(r - gr) + Math.abs(c - gc);
}

// ===== ALGORITHM GENERATORS =====

function* puzzleBFS() {
    let stateId = 0;
    const queue = [{ state: state.puzzleBoard, path: [], depth: 0, id: ++stateId }];
    const reached = new Set([JSON.stringify(state.puzzleBoard)]);

    while (queue.length > 0) {
        const current = queue.shift();

        if (state.goalCheck === 'evaluation' && JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
            yield { event: 'success', node: current };
            return;
        }

        yield { event: 'expanding', node: current, frontierSize: queue.length };

        for (const { state: newState, action } of getPuzzleNeighbors(current.state)) {
            const key = JSON.stringify(newState);
            if (!reached.has(key)) {
                reached.add(key);
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id };

                if (state.goalCheck === 'generation' && JSON.stringify(newState) === JSON.stringify(state.puzzleGoal)) {
                    yield { event: 'success', node: newNode };
                    return;
                }

                queue.push(newNode);
                yield { event: 'generating', node: newNode, frontierSize: queue.length };
            }
        }
    }

    yield { event: 'fail' };
}

function* puzzleDFS() {
    let stateId = 0;
    const stack = [{ state: state.puzzleBoard, path: [], depth: 0, id: ++stateId }];
    const reached = new Set([JSON.stringify(state.puzzleBoard)]);

    while (stack.length > 0) {
        const current = stack.pop();

        if (state.goalCheck === 'evaluation' && JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
            yield { event: 'success', node: current };
            return;
        }

        yield { event: 'expanding', node: current, frontierSize: stack.length };

        const neighbors = getPuzzleNeighbors(current.state);
        for (let i = neighbors.length - 1; i >= 0; i--) {
            const { state: newState, action } = neighbors[i];
            const key = JSON.stringify(newState);
            if (!reached.has(key)) {
                reached.add(key);
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id };

                if (state.goalCheck === 'generation' && JSON.stringify(newState) === JSON.stringify(state.puzzleGoal)) {
                    yield { event: 'success', node: newNode };
                    return;
                }

                stack.push(newNode);
                yield { event: 'generating', node: newNode, frontierSize: stack.length };
            }
        }
    }

    yield { event: 'fail' };
}

function* puzzleDLS(depthLimit) {
    let stateId = 0;
    const stack = [{ state: state.puzzleBoard, path: [], depth: 0, id: ++stateId }];
    const reached = new Set([JSON.stringify(state.puzzleBoard)]);

    while (stack.length > 0) {
        const current = stack.pop();

        if (current.depth > depthLimit) continue;

        if (state.goalCheck === 'evaluation' && JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
            yield { event: 'success', node: current };
            return;
        }

        yield { event: 'expanding', node: current, frontierSize: stack.length };

        if (current.depth < depthLimit) {
            const neighbors = getPuzzleNeighbors(current.state);
            for (let i = neighbors.length - 1; i >= 0; i--) {
                const { state: newState, action } = neighbors[i];
                const key = JSON.stringify(newState);
                if (!reached.has(key)) {
                    reached.add(key);
                    const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id };

                    if (state.goalCheck === 'generation' && JSON.stringify(newState) === JSON.stringify(state.puzzleGoal)) {
                        yield { event: 'success', node: newNode };
                        return;
                    }

                    stack.push(newNode);
                    yield { event: 'generating', node: newNode, frontierSize: stack.length };
                }
            }
        }
    }

    yield { event: 'fail' };
}

function* puzzleGreedy() {
    let stateId = 0;
    const queue = [{ state: state.puzzleBoard, path: [], depth: 0, id: ++stateId, h: puzzleHeuristic(state.puzzleBoard) }];
    const reached = new Set([JSON.stringify(state.puzzleBoard)]);

    while (queue.length > 0) {
        queue.sort((a, b) => a.h - b.h);
        const current = queue.shift();

        if (state.goalCheck === 'evaluation' && JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
            yield { event: 'success', node: current };
            return;
        }

        yield { event: 'expanding', node: current, frontierSize: queue.length };

        for (const { state: newState, action } of getPuzzleNeighbors(current.state)) {
            const key = JSON.stringify(newState);
            if (!reached.has(key)) {
                reached.add(key);
                const h = puzzleHeuristic(newState);
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, h };

                if (state.goalCheck === 'generation' && JSON.stringify(newState) === JSON.stringify(state.puzzleGoal)) {
                    yield { event: 'success', node: newNode };
                    return;
                }

                queue.push(newNode);
                yield { event: 'generating', node: newNode, frontierSize: queue.length };
            }
        }
    }

    yield { event: 'fail' };
}

function* puzzleAStar() {
    let stateId = 0;
    const queue = [{ state: state.puzzleBoard, path: [], depth: 0, id: ++stateId, g: 0, h: puzzleHeuristic(state.puzzleBoard) }];
    const reached = new Set([JSON.stringify(state.puzzleBoard)]);

    while (queue.length > 0) {
        queue.sort((a, b) => (a.g + a.h) - (b.g + b.h));
        const current = queue.shift();

        if (state.goalCheck === 'evaluation' && JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
            yield { event: 'success', node: current };
            return;
        }

        yield { event: 'expanding', node: current, frontierSize: queue.length };

        for (const { state: newState, action } of getPuzzleNeighbors(current.state)) {
            const key = JSON.stringify(newState);
            if (!reached.has(key)) {
                reached.add(key);
                const g = current.g + 1;
                const h = puzzleHeuristic(newState);
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, g, h };

                if (state.goalCheck === 'generation' && JSON.stringify(newState) === JSON.stringify(state.puzzleGoal)) {
                    yield { event: 'success', node: newNode };
                    return;
                }

                queue.push(newNode);
                yield { event: 'generating', node: newNode, frontierSize: queue.length };
            }
        }
    }

    yield { event: 'fail' };
}

function* mazeBFS() {
    let stateId = 0;
    const queue = [{ state: state.mazeStart, path: [state.mazeStart], depth: 0, id: ++stateId }];
    const reached = new Set([JSON.stringify(state.mazeStart)]);
    const frontier = new Set();

    while (queue.length > 0) {
        const current = queue.shift();
        frontier.delete(JSON.stringify(current.state));
        reached.add(JSON.stringify(current.state));

        if (JSON.stringify(current.state) === JSON.stringify(state.mazeGoal)) {
            state.mazePath = current.path;
            yield { event: 'success', node: current, frontier, reached, path: current.path };
            return;
        }

        yield { event: 'expanding', node: current, frontier, reached, frontierSize: frontier.size };

        for (const { state: newState, cost } of getMazeNeighbors(current.state)) {
            const key = JSON.stringify(newState);
            if (!reached.has(key) && !frontier.has(key)) {
                const newNode = { state: newState, path: [...current.path, newState], depth: current.depth + 1, id: ++stateId, parentId: current.id };
                frontier.add(key);
                queue.push(newNode);
                yield { event: 'generating', node: newNode, frontier, reached, frontierSize: frontier.size };
            }
        }
    }

    yield { event: 'fail', frontier, reached };
}

function* mazeDFS() {
    let stateId = 0;
    const stack = [{ state: state.mazeStart, path: [state.mazeStart], depth: 0, id: ++stateId }];
    const reached = new Set([JSON.stringify(state.mazeStart)]);
    const frontier = new Set();

    while (stack.length > 0) {
        const current = stack.pop();
        frontier.delete(JSON.stringify(current.state));
        reached.add(JSON.stringify(current.state));

        if (JSON.stringify(current.state) === JSON.stringify(state.mazeGoal)) {
            state.mazePath = current.path;
            yield { event: 'success', node: current, frontier, reached, path: current.path };
            return;
        }

        yield { event: 'expanding', node: current, frontier, reached, frontierSize: frontier.size };

        const neighbors = getMazeNeighbors(current.state);
        for (let i = neighbors.length - 1; i >= 0; i--) {
            const { state: newState, cost } = neighbors[i];
            const key = JSON.stringify(newState);
            if (!reached.has(key) && !frontier.has(key)) {
                const newNode = { state: newState, path: [...current.path, newState], depth: current.depth + 1, id: ++stateId, parentId: current.id };
                frontier.add(key);
                stack.push(newNode);
                yield { event: 'generating', node: newNode, frontier, reached, frontierSize: frontier.size };
            }
        }
    }

    yield { event: 'fail', frontier, reached };
}

function* mazeGreedy() {
    let stateId = 0;
    const queue = [{ state: state.mazeStart, path: [state.mazeStart], depth: 0, id: ++stateId, h: mazeHeuristic(state.mazeStart) }];
    const reached = new Set([JSON.stringify(state.mazeStart)]);
    const frontier = new Set();

    while (queue.length > 0) {
        queue.sort((a, b) => a.h - b.h);
        const current = queue.shift();
        frontier.delete(JSON.stringify(current.state));
        reached.add(JSON.stringify(current.state));

        if (JSON.stringify(current.state) === JSON.stringify(state.mazeGoal)) {
            state.mazePath = current.path;
            yield { event: 'success', node: current, frontier, reached, path: current.path };
            return;
        }

        yield { event: 'expanding', node: current, frontier, reached, frontierSize: frontier.size };

        for (const { state: newState, cost } of getMazeNeighbors(current.state)) {
            const key = JSON.stringify(newState);
            if (!reached.has(key) && !frontier.has(key)) {
                const h = mazeHeuristic(newState);
                const newNode = { state: newState, path: [...current.path, newState], depth: current.depth + 1, id: ++stateId, parentId: current.id, h };
                frontier.add(key);
                queue.push(newNode);
                yield { event: 'generating', node: newNode, frontier, reached, frontierSize: frontier.size };
            }
        }
    }

    yield { event: 'fail', frontier, reached };
}

function* mazeAStar() {
    let stateId = 0;
    const queue = [{ state: state.mazeStart, path: [state.mazeStart], depth: 0, id: ++stateId, g: 0, h: mazeHeuristic(state.mazeStart) }];
    const reached = new Set([JSON.stringify(state.mazeStart)]);
    const frontier = new Set();

    while (queue.length > 0) {
        queue.sort((a, b) => (a.g + a.h) - (b.g + b.h));
        const current = queue.shift();
        frontier.delete(JSON.stringify(current.state));
        reached.add(JSON.stringify(current.state));

        if (JSON.stringify(current.state) === JSON.stringify(state.mazeGoal)) {
            state.mazePath = current.path;
            yield { event: 'success', node: current, frontier, reached, path: current.path };
            return;
        }

        yield { event: 'expanding', node: current, frontier, reached, frontierSize: frontier.size };

        for (const { state: newState, cost } of getMazeNeighbors(current.state)) {
            const key = JSON.stringify(newState);
            if (!reached.has(key) && !frontier.has(key)) {
                const g = current.g + cost;
                const h = mazeHeuristic(newState);
                const newNode = { state: newState, path: [...current.path, newState], depth: current.depth + 1, id: ++stateId, parentId: current.id, g, h };
                frontier.add(key);
                queue.push(newNode);
                yield { event: 'generating', node: newNode, frontier, reached, frontierSize: frontier.size };
            }
        }
    }

    yield { event: 'fail', frontier, reached };
}

// ===== UI RENDERING =====

function renderPuzzleBoard(board = state.puzzleBoard) {
    const container = document.getElementById('puzzleBoard');
    container.innerHTML = '';

    for (let i = 0; i < 9; i++) {
        const tile = document.createElement('div');
        tile.className = `puzzle-tile ${board[i] === 0 ? 'empty' : ''} ${board[i] === state.puzzleGoal[i] && board[i] !== 0 ? 'correct' : ''}`;
        tile.textContent = board[i] === 0 ? '' : board[i];
        container.appendChild(tile);
    }
}

function renderMazeBoard() {
    const container = document.getElementById('mazeBoard');
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${state.mazeSize}, 1fr)`;

    for (let r = 0; r < state.mazeSize; r++) {
        for (let c = 0; c < state.mazeSize; c++) {
            const cell = document.createElement('div');
            const key = JSON.stringify([r, c]);
            const isFrontier = state.mazeFrontier.has(key);
            const isReached = state.mazeReached.has(key);
            const isPath = state.mazePath.some(p => p[0] === r && p[1] === c);

            cell.className = 'maze-cell';

            if (state.mazeGrid[r][c] === 0) {
                cell.classList.add('wall');
            } else if (r === state.mazeStart[0] && c === state.mazeStart[1]) {
                cell.classList.add('start');
                cell.textContent = 'S';
            } else if (r === state.mazeGoal[0] && c === state.mazeGoal[1]) {
                cell.classList.add('goal');
                cell.textContent = 'G';
            } else if (isPath) {
                cell.classList.add('path');
                cell.textContent = '●';
            } else if (isFrontier) {
                cell.classList.add('frontier');
                cell.textContent = '○';
            } else if (isReached) {
                cell.classList.add('reached');
                cell.textContent = '·';
            } else {
                cell.classList.add('empty');
                cell.textContent = state.mazeWeights[r][c];
            }

            container.appendChild(cell);
        }
    }
}

function addTableRow(node, eventType) {
    const tbody = document.getElementById('tableBody');
    const tr = document.createElement('tr');

    let stateStr = '';
    if (state.mode === 'puzzle') {
        stateStr = node.state.join('');
    } else {
        stateStr = `(${node.state[0]},${node.state[1]})`;
    }

    tr.innerHTML = `
        <td>State ${node.id}</td>
        <td>${stateStr}</td>
        <td>${node.frontierSize || 0}</td>
    `;

    if (eventType === 'success') {
        tr.classList.add('solution-row');
    }

    tbody.appendChild(tr);
    tbody.parentElement.scrollTop = tbody.parentElement.scrollHeight;
}

// ===== MAIN CONTROLS =====

function switchMode(mode) {
    state.mode = mode;
    document.getElementById('puzzlePresets').classList.toggle('hidden', mode === 'maze');
    document.getElementById('mazeOptions').classList.toggle('hidden', mode === 'puzzle');
    document.getElementById('puzzleBoard').classList.toggle('hidden', mode === 'maze');
    document.getElementById('mazeBoard').classList.toggle('hidden', mode === 'puzzle');

    if (mode === 'maze') {
        generateMaze();
        renderMazeBoard();
    } else {
        renderPuzzleBoard();
    }

    resetVisualizer();
}

function updateDLSLimit() {
    const val = document.getElementById('dlsLimit').value;
    document.getElementById('dlsLimitValue').textContent = val;
}

function updateMazeSize() {
    state.mazeSize = parseInt(document.getElementById('mazeSize').value);
    document.getElementById('mazeSizeValue').textContent = state.mazeSize;
    generateMaze();
    renderMazeBoard();
}

function updateSpeed() {
    state.speed = parseInt(document.getElementById('speed').value);
    document.getElementById('speedValue').textContent = state.speed + 'ms';
}

function setPuzzlePreset(difficulty) {
    const presets = {
        easy: [1, 2, 3, 4, 5, 6, 7, 0, 8],
        medium: [1, 2, 3, 4, 5, 6, 0, 7, 8],
        hard: [4, 1, 2, 5, 0, 3, 6, 7, 8]
    };
    state.puzzleBoard = [...presets[difficulty]];
    if (isSolvablePuzzle(state.puzzleBoard)) {
        renderPuzzleBoard();
    } else {
        alert('Unsolvable puzzle! Try another.');
        state.puzzleBoard = [1, 2, 3, 4, 5, 6, 7, 8, 0];
        renderPuzzleBoard();
    }
}

function randomizePuzzle() {
    do {
        const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        state.puzzleBoard = arr;
    } while (!isSolvablePuzzle(state.puzzleBoard));
    renderPuzzleBoard();
}

function startSolving() {
    state.algorithm = document.querySelector('input[name="algorithm"]:checked').value;
    state.goalCheck = document.querySelector('input[name="goalCheck"]:checked').value;

    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('stepBtn').disabled = false;

    document.getElementById('tableBody').innerHTML = '';
    state.stateCounter = 0;
    state.isRunning = true;

    // Create appropriate generator
    if (state.mode === 'puzzle') {
        if (state.algorithm === 'bfs') searchIterator = puzzleBFS();
        else if (state.algorithm === 'dfs') searchIterator = puzzleDFS();
        else if (state.algorithm === 'dls') searchIterator = puzzleDLS(parseInt(document.getElementById('dlsLimit').value));
        else if (state.algorithm === 'greedy') searchIterator = puzzleGreedy();
        else if (state.algorithm === 'astar') searchIterator = puzzleAStar();
    } else {
        if (state.algorithm === 'bfs') searchIterator = mazeBFS();
        else if (state.algorithm === 'dfs') searchIterator = mazeDFS();
        else if (state.algorithm === 'greedy') searchIterator = mazeGreedy();
        else if (state.algorithm === 'astar') searchIterator = mazeAStar();
        else searchIterator = mazeBFS();
    }

    playLoop();
}

function playLoop() {
    if (executionTimer) clearInterval(executionTimer);
    executionTimer = setInterval(() => {
        if (!state.isPaused) nextStep();
    }, state.speed);
}

function togglePause() {
    state.isPaused = !state.isPaused;
    document.getElementById('pauseBtn').textContent = state.isPaused ? '▶ RESUME' : '⏸ PAUSE';
}

function nextStep() {
    if (!searchIterator || !state.isRunning) return;

    const result = searchIterator.next();
    if (result.done) {
        stopSolving();
        return;
    }

    const { event, node, frontierSize, frontier, reached, path } = result.value;

    // Update maze visualization state
    if (state.mode === 'maze') {
        if (frontier) state.mazeFrontier = new Set(frontier);
        if (reached) state.mazeReached = new Set(reached);
    }

    addTableRow(node, event);

    if (state.mode === 'puzzle') {
        renderPuzzleBoard(node.state);
    } else {
        renderMazeBoard();
    }

    if (event === 'success') {
        const pathStr = state.mode === 'maze'
            ? path.map(p => `(${p[0]},${p[1]})`).join(' → ')
            : node.path.join(' → ');
        showModal('🏆 SUCCESS!', `Found solution in ${path ? path.length - 1 : node.path.length} steps!<br>Path: ${pathStr}`);
        stopSolving();
    } else if (event === 'fail') {
        showModal('❌ FAILED', 'No solution found!');
        stopSolving();
    }
}

function stopSolving() {
    if (executionTimer) clearInterval(executionTimer);
    state.isRunning = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('stepBtn').disabled = true;
}

function resetVisualizer() {
    stopSolving();
    state.stateCounter = 0;
    state.mazeFrontier = new Set();
    state.mazeReached = new Set();
    state.mazePath = [];
    document.getElementById('tableBody').innerHTML = '';
    document.getElementById('pauseBtn').textContent = '⏸ PAUSE';
    state.isPaused = false;

    if (state.mode === 'puzzle') {
        renderPuzzleBoard();
    } else {
        renderMazeBoard();
    }
}

function showModal(title, message) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').innerHTML = message;
    document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

// ===== INITIALIZATION =====

window.addEventListener('DOMContentLoaded', () => {
    renderPuzzleBoard();

    document.querySelectorAll('input[name="algorithm"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'dls') {
                document.getElementById('dlsOptions').classList.remove('hidden');
            } else {
                document.getElementById('dlsOptions').classList.add('hidden');
            }
        });
    });

    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') closeModal();
    });
});
