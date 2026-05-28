// Greedy Best-First Search
// Expands the node that appears to be closest to the goal according to heuristic only.

function greedyBestFirstSearch(graph, start, goal, heuristic) {
  const openSet = new MinPriorityQueue();
  const visited = new Set([start]);
  const parent = { [start]: null };

  openSet.enqueue(start, heuristic(start, goal));

  while (!openSet.isEmpty()) {
    const { element: node } = openSet.dequeue();

    if (node === goal) {
      return reconstructPath(parent, goal);
    }

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent[neighbor] = node;
        openSet.enqueue(neighbor, heuristic(neighbor, goal));
      }
    }
  }

  return null;
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

class MinPriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element, priority) {
    this.items.push({ element, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }

  dequeue() {
    return this.items.shift();
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

module.exports = { greedyBestFirstSearch };
