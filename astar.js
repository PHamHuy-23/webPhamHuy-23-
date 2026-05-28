// A* search algorithm
// Uses a heuristic function to guide search toward the goal.

function astar(graph, start, goal, heuristic) {
  const openSet = new MinPriorityQueue();
  const cameFrom = {};
  const gScore = {};
  const fScore = {};

  for (const node in graph) {
    gScore[node] = Infinity;
    fScore[node] = Infinity;
  }

  gScore[start] = 0;
  fScore[start] = heuristic(start, goal);
  openSet.enqueue(start, fScore[start]);

  while (!openSet.isEmpty()) {
    const { element: current } = openSet.dequeue();

    if (current === goal) {
      return reconstructPath(cameFrom, current);
    }

    for (const { neighbor, cost } of graph[current] || []) {
      const tentativeG = gScore[current] + cost;
      if (tentativeG < gScore[neighbor]) {
        cameFrom[neighbor] = current;
        gScore[neighbor] = tentativeG;
        fScore[neighbor] = tentativeG + heuristic(neighbor, goal);
        openSet.enqueue(neighbor, fScore[neighbor]);
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom, current) {
  const path = [];
  while (current !== undefined) {
    path.unshift(current);
    current = cameFrom[current];
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

module.exports = { astar };
