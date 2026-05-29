export function* puzzleSteepestHC(state, getPuzzleNeighbors, puzzleHeuristic) {
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
