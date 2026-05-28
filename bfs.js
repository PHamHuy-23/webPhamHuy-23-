// Breadth-First Search (BFS)
// Works on an unweighted graph represented as an adjacency list.

function bfs(graph, start, goal = null) {
  const queue = [start];
  const visited = new Set([start]);
  const parent = { [start]: null };

  while (queue.length > 0) {
    const node = queue.shift();

    if (goal !== null && node === goal) {
      return reconstructPath(parent, goal);
    }

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent[neighbor] = node;
        queue.push(neighbor);
      }
    }
  }

  return goal === null ? Array.from(visited) : null;
}

function reconstructPath(parent, goal) {
  const path = [];
  let current = goal;
  while (current !== null) {
    path.unshift(current);
    current = parent[current];
  }
  return path;
}

module.exports = { bfs };
