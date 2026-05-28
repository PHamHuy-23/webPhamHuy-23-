// Depth-First Search (DFS)
// Works on an unweighted graph represented as an adjacency list.

function dfs(graph, start, goal = null) {
  const visited = new Set();
  const path = [];

  function visit(node) {
    if (visited.has(node)) return false;
    visited.add(node);
    path.push(node);

    if (goal !== null && node === goal) {
      return true;
    }

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (visit(neighbor)) {
        return true;
      }
    }

    if (goal !== null) {
      path.pop();
    }
    return false;
  }

  visit(start);
  return goal === null ? Array.from(visited) : path;
}

module.exports = { dfs };
