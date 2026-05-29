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

    // Node tracking for tree visualization
    nodeRegistry: new Map(),
    currentNodeId: null,
    treeRootId: null
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
    state.treeRootId = stateId;

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
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action };
                state.nodeRegistry.set(newNode.id, newNode);

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
    state.treeRootId = stateId;

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
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action };
                state.nodeRegistry.set(newNode.id, newNode);

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
    state.treeRootId = stateId;

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
                    const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action };
                    state.nodeRegistry.set(newNode.id, newNode);

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
    state.treeRootId = stateId;

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
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action, h };
                state.nodeRegistry.set(newNode.id, newNode);

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
                const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action, g, h };
                state.nodeRegistry.set(newNode.id, newNode);

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

function* puzzleIDA() {
    const h0 = puzzleHeuristic(state.puzzleBoard);
    let I0 = h0;
    let threshold = I0;
    const reached = new Set();

    while (true) {
        reached.clear();
        let min = Infinity;
        let foundGoal = false;

        yield { event: 'iteration_start', I_0: I0, alpha: threshold, iteration: I0 };

        function* dfs(currentState, g, path, currentId) {
            const pathStr = JSON.stringify(currentState);
            if (reached.has(pathStr)) return;
            reached.add(pathStr);

            const h = puzzleHeuristic(currentState);
            const f = g + h;

            if (state.goalCheck === 'evaluation' && JSON.stringify(currentState) === JSON.stringify(state.puzzleGoal)) {
                yield { event: 'success', node: { state: currentState, path, depth: g, id: currentId, g, h } };
                foundGoal = true;
                return;
            }

            if (f > threshold) {
                if (f < min) min = f;
                return;
            }

            yield { event: 'expanding', node: { state: currentState, path, depth: g, id: currentId, g, h } };

            for (const { state: newState, action } of getPuzzleNeighbors(currentState)) {
                const newId = currentId + 1000;
                const newNode = { state: newState, path: [...path, action], depth: g + 1, id: newId, parentId: currentId, action, g: g + 1, h: puzzleHeuristic(newState) };
                state.nodeRegistry.set(newNode.id, newNode);

                if (state.goalCheck === 'generation' && JSON.stringify(newState) === JSON.stringify(state.puzzleGoal)) {
                    yield { event: 'success', node: newNode };
                    foundGoal = true;
                    return;
                }

                yield* dfs(newState, g + 1, [...path, action], newId);
                if (foundGoal) return;
            }
        }

        let nodeId = 0;
        const rootNode = { state: state.puzzleBoard, path: [], depth: 0, id: ++nodeId, g: 0, h: h0 };
        state.nodeRegistry.set(rootNode.id, rootNode);
        state.treeRootId = rootNode.id;

        yield* dfs(state.puzzleBoard, 0, [], nodeId);

        if (foundGoal) return;
        if (min === Infinity) {
            yield { event: 'fail' };
            return;
        }

        threshold = min;
    }
}

function* puzzleSimpleHC() {
    let stateId = 0;
    let current = { state: state.puzzleBoard, path: [], depth: 0, id: ++stateId, h: puzzleHeuristic(state.puzzleBoard) };
    state.nodeRegistry.set(current.id, current);
    state.treeRootId = current.id;

    if (JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
        yield { event: 'success', node: current };
        return;
    }

    while (true) {
        yield { event: 'expanding', node: current };

        const neighbors = getPuzzleNeighbors(current.state);
        let foundBetter = false;

        for (const { state: newState, action } of neighbors) {
            const h = puzzleHeuristic(newState);
            const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action, h };
            state.nodeRegistry.set(newNode.id, newNode);

            yield { event: 'evaluating', node: newNode };

            if (h < current.h) {
                current = newNode;
                foundBetter = true;
                yield { event: 'moving', node: current };

                if (JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
                    yield { event: 'success', node: current };
                    return;
                }

                break;
            }
        }

        if (!foundBetter) {
            yield { event: 'local_maximum', node: current };
            return;
        }
    }
}

function* puzzleSteepestHC() {
    let stateId = 0;
    let current = { state: state.puzzleBoard, path: [], depth: 0, id: ++stateId, h: puzzleHeuristic(state.puzzleBoard) };
    state.nodeRegistry.set(current.id, current);
    state.treeRootId = current.id;

    if (JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
        yield { event: 'success', node: current };
        return;
    }

    while (true) {
        yield { event: 'expanding', node: current };

        const neighbors = getPuzzleNeighbors(current.state);
        let best = null;

        for (const { state: newState, action } of neighbors) {
            const h = puzzleHeuristic(newState);
            const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action, h };
            state.nodeRegistry.set(newNode.id, newNode);

            yield { event: 'evaluating', node: newNode };

            if (!best || h < best.h) {
                best = newNode;
            }
        }

        if (best && best.h < current.h) {
            current = best;
            yield { event: 'moving', node: current };

            if (JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
                yield { event: 'success', node: current };
                return;
            }
        } else {
            yield { event: 'local_maximum', node: current };
            return;
        }
    }
}

function* puzzleStochasticHC() {
    let stateId = 0;
    let current = { state: state.puzzleBoard, path: [], depth: 0, id: ++stateId, h: puzzleHeuristic(state.puzzleBoard) };
    state.nodeRegistry.set(current.id, current);
    state.treeRootId = current.id;

    if (JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
        yield { event: 'success', node: current };
        return;
    }

    while (true) {
        yield { event: 'expanding', node: current };

        const neighbors = getPuzzleNeighbors(current.state);
        const improving = [];

        for (const { state: newState, action } of neighbors) {
            const h = puzzleHeuristic(newState);
            const newNode = { state: newState, path: [...current.path, action], depth: current.depth + 1, id: ++stateId, parentId: current.id, action, h };
            state.nodeRegistry.set(newNode.id, newNode);

            yield { event: 'evaluating', node: newNode };

            if (h < current.h) {
                improving.push(newNode);
            }
        }

        if (improving.length > 0) {
            const randomIdx = Math.floor(Math.random() * improving.length);
            current = improving[randomIdx];
            yield { event: 'moving', node: current };

            if (JSON.stringify(current.state) === JSON.stringify(state.puzzleGoal)) {
                yield { event: 'success', node: current };
                return;
            }
        } else {
            yield { event: 'local_maximum', node: current };
            return;
        }
    }
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

function renderNodeCard(node) {
    const card = document.createElement('div');
    card.className = `node-card ${node.visualState || ''}`;
    if (state.currentNodeId === node.id) card.classList.add('current');

    // Mini 3x3 grid
    let gridHTML = '<div class="node-mini-grid">';
    for (let i = 0; i < 9; i++) {
        const val = node.state[i];
        const isCorrect = val === state.puzzleGoal[i] && val !== 0;
        const isEmpty = val === 0;
        gridHTML += `<div class="node-mini-tile ${isEmpty ? 'empty' : ''} ${isCorrect ? 'correct' : ''}">${isEmpty ? '' : val}</div>`;
    }
    gridHTML += '</div>';

    // Metadata
    const parentLabel = node.parentId !== undefined ? `#${node.parentId}` : 'ROOT';
    const moveLabel = node.action || '—';
    const hValue = node.h !== undefined ? node.h.toFixed(0) : '—';
    const fValue = node.g !== undefined && node.h !== undefined ? (node.g + node.h).toFixed(0) : '—';

    card.innerHTML = gridHTML + `
        <div class="node-metadata">
            <div class="node-metadata-row"><span>ID:</span> <strong>#${node.id}</strong></div>
            <div class="node-metadata-row"><span>Parent:</span> <strong>${parentLabel}</strong></div>
            <div class="node-metadata-row"><span>Move:</span> <strong>${moveLabel}</strong></div>
            <div class="node-metadata-row"><span>Depth:</span> <strong>${node.depth}</strong></div>
            <div class="node-metadata-row"><span>h(n):</span> <strong>${hValue}</strong></div>
            ${node.g !== undefined ? `<div class="node-metadata-row"><span>f(n):</span> <strong>${fValue}</strong></div>` : ''}
        </div>
    `;

    return card;
}

function renderTreeDiagram() {
    const container = document.getElementById('treeDiagram');
    container.innerHTML = '';

    if (!state.treeRootId || state.nodeRegistry.size === 0) return;

    const root = state.nodeRegistry.get(state.treeRootId);
    if (!root) return;

    // Build tree structure recursively with compact layout
    function buildTreeHTML(nodeId, depth = 0) {
        const node = state.nodeRegistry.get(nodeId);
        if (!node) return '';

        const children = [...state.nodeRegistry.values()].filter(n => n.parentId === nodeId);
        const isCurrentNode = state.currentNodeId === nodeId;

        // Use max depth of 4 to prevent excessive indentation
        const indentLevel = Math.min(depth, 4);
        const indentPx = indentLevel * 15;

        let html = `<div style="margin-left: ${indentPx}px; margin-bottom: 0.25rem; flex-shrink: 0;">`;
        html += `<div class="node-card ${isCurrentNode ? 'current' : ''}" style="cursor: pointer; min-width: 90px;">`;
        html += `<div style="font-size: 0.55rem; font-weight: bold; line-height: 1.2;">#${node.id}</div>`;
        html += `<div style="font-size: 0.5rem; color: var(--accent-cyan); line-height: 1.2;">h=${node.h !== undefined ? node.h.toFixed(0) : '—'}</div>`;
        if (node.action) html += `<div style="font-size: 0.5rem; color: #a0a0a0; line-height: 1.2;">${node.action}</div>`;
        html += `</div>`;

        if (children.length > 0) {
            for (const child of children) {
                html += buildTreeHTML(child.id, depth + 1);
            }
        }

        html += '</div>';
        return html;
    }

    container.innerHTML = buildTreeHTML(state.treeRootId);
}

function updateTreeHighlight(nodeId) {
    state.currentNodeId = nodeId;
    const node = state.nodeRegistry.get(nodeId);
    if (node) node.visualState = 'current';
    renderTreeDiagram();
}

// ===== MAIN CONTROLS =====

function isHillClimbingAlgorithm() {
    return ['simple_hc', 'steepest_hc', 'stochastic_hc'].includes(state.algorithm);
}

function updateVisualizationMode() {
    const tableWrapper = document.getElementById('tableWrapper');
    const treeDiagramWrapper = document.getElementById('treeDiagramWrapper');
    const tableTitle = document.getElementById('tableTitle');

    if (isHillClimbingAlgorithm()) {
        tableWrapper.style.display = 'none';
        treeDiagramWrapper.style.display = 'block';
        tableTitle.textContent = '🌳 TREE DIAGRAM';
        document.getElementById('metricsDisplay').style.display = 'none';
    } else if (state.algorithm === 'ida') {
        tableWrapper.style.display = 'block';
        treeDiagramWrapper.style.display = 'none';
        tableTitle.textContent = '📊 STATE TRACKING';
        document.getElementById('metricsDisplay').style.display = 'block';
    } else {
        tableWrapper.style.display = 'block';
        treeDiagramWrapper.style.display = 'none';
        tableTitle.textContent = '📊 STATE TRACKING';
        document.getElementById('metricsDisplay').style.display = 'none';
    }
}

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
    document.getElementById('treeDiagram').innerHTML = '';
    state.stateCounter = 0;
    state.nodeRegistry.clear();
    state.currentNodeId = null;
    state.treeRootId = null;
    state.isRunning = true;

    updateVisualizationMode();

    // Create appropriate generator
    if (state.mode === 'puzzle') {
        if (state.algorithm === 'bfs') searchIterator = puzzleBFS();
        else if (state.algorithm === 'dfs') searchIterator = puzzleDFS();
        else if (state.algorithm === 'dls') searchIterator = puzzleDLS(parseInt(document.getElementById('dlsLimit').value));
        else if (state.algorithm === 'greedy') searchIterator = puzzleGreedy();
        else if (state.algorithm === 'astar') searchIterator = puzzleAStar();
        else if (state.algorithm === 'ida') searchIterator = puzzleIDA();
        else if (state.algorithm === 'simple_hc') searchIterator = puzzleSimpleHC();
        else if (state.algorithm === 'steepest_hc') searchIterator = puzzleSteepestHC();
        else if (state.algorithm === 'stochastic_hc') searchIterator = puzzleStochasticHC();
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

    // Handle IDA* metrics
    if (event === 'iteration_start') {
        document.getElementById('boundValue').textContent = result.value.I_0.toFixed(0);
        document.getElementById('alphaValue').textContent = result.value.alpha.toFixed(0);
        document.getElementById('iterationValue').textContent = result.value.iteration.toFixed(0);
    }

    // Update tree for hill-climbing algorithms
    if (isHillClimbingAlgorithm()) {
        state.currentNodeId = node.id;
        renderTreeDiagram();
    } else {
        // Update table for traditional algorithms
        addTableRow(node, event);
    }

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
    } else if (event === 'local_maximum') {
        showModal('⛰️ LOCAL MAXIMUM', `Reached local maximum at h(n) = ${node.h}. No improving neighbors found.`);
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
