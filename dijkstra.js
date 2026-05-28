// Dijkstra's algorithm
// Finds the shortest path from a start node to all reachable nodes
// in a weighted graph with non-negative edge costs.

function dijkstra(graph, start) {
  const distances = {};
  const previous = {};
  const pq = new MinPriorityQueue();

  for (const node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
  }

  distances[start] = 0;
  pq.enqueue(start, 0);

  while (!pq.isEmpty()) {
    const { element: node } = pq.dequeue();

    const neighbors = graph[node] || [];
    for (const { neighbor, cost } of neighbors) {
      const alt = distances[node] + cost;
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = node;
        pq.enqueue(neighbor, alt);
      }
    }
  }

  return { distances, previous };
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

module.exports = { dijkstra };
