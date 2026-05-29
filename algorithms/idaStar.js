export function* puzzleIDA(state, getPuzzleNeighbors, puzzleHeuristic) {
    const h0 = puzzleHeuristic(state.puzzleBoard);
    let threshold = h0;
    const reached = new Set();

    while (true) {
        reached.clear();
        let min = Infinity;
        let foundGoal = false;

        yield { event: 'iteration_start', I_0: h0, alpha: threshold, iteration: threshold };

        function* dfs(currentState, g, path, currentId) {
            const pathStr = JSON.stringify(currentState);
            if (reached.has(pathStr)) return;
            reached.add(pathStr);

            const h = puzzleHeuristic(currentState);
            const f = g + h;
            const node = { state: currentState, path, depth: g, id: currentId, g, h };

            if (state.goalCheck === 'evaluation' && JSON.stringify(currentState) === JSON.stringify(state.puzzleGoal)) {
                yield { event: 'success', node };
                foundGoal = true;
                return;
            }

            if (f > threshold) {
                if (f < min) min = f;
                return;
            }

            yield { event: 'expanding', node };

            for (const { state: newState, action } of getPuzzleNeighbors(currentState)) {
                const newId = currentId + 1000;
                const newPath = [...path, action];
                const newNode = {
                    state: newState,
                    path: newPath,
                    depth: g + 1,
                    id: newId,
                    parentId: currentId,
                    action,
                    g: g + 1,
                    h: puzzleHeuristic(newState)
                };
                state.nodeRegistry.set(newNode.id, newNode);

                if (state.goalCheck === 'generation' && JSON.stringify(newState) === JSON.stringify(state.puzzleGoal)) {
                    yield { event: 'success', node: newNode };
                    foundGoal = true;
                    return;
                }

                yield* dfs(newState, g + 1, newPath, newId);
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
