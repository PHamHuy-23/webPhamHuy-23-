// Cost-Based Search Variant (Uniform Cost Search)
// Expands the least-cost path first and is a cost-aware variant of BFS.

function uniformCostSearch(graph, start, goal) {
  const frontier = new MinPriorityQueue();
  const explored = new Set();
  const parent = { [start]: null };
  const costSoFar = { [start]: 0 };

  frontier.enqueue(start, 0);

  while (!frontier.isEmpty()) {
    const { element: current } = frontier.dequeue();

    if (current === goal) {
      return reconstructPath(parent, goal);
    }

    explored.add(current);

    for (const { neighbor, cost } of graph[current] || []) {
      const newCost = costSoFar[current] + cost;
      if (!costSoFar.hasOwnProperty(neighbor) || newCost < costSoFar[neighbor]) {
        costSoFar[neighbor] = newCost;
        parent[neighbor] = current;
        if (!explored.has(neighbor)) {
          frontier.enqueue(neighbor, newCost);
        }
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

module.exports = { uniformCostSearch };
