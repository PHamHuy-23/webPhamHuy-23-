export function* puzzleStochasticHC(state, getPuzzleNeighbors, puzzleHeuristic) {
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
            const newNode = {
                state: newState,
                path: [...current.path, action],
                depth: current.depth + 1,
                id: ++stateId,
                parentId: current.id,
                action,
                h
            };
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
