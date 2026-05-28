// Depth-Limited Search (DLS)
// A DFS variant that stops at a specified depth limit.

function depthLimitedSearch(graph, start, goal, limit) {
  const visited = new Set();
  const path = [];

  function recurse(node, depth) {
    if (depth > limit) {
      return false;
    }

    visited.add(node);
    path.push(node);

    if (node === goal) {
      return true;
    }

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        if (recurse(neighbor, depth + 1)) {
          return true;
        }
      }
    }

    path.pop();
    return false;
  }

  const found = recurse(start, 0);
  return found ? path : null;
}

module.exports = { depthLimitedSearch };
