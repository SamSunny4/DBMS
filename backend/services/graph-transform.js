/**
 * Convert Neo4j path/node/relationship records into Cytoscape.js elements format.
 */

export function neo4jToCytoscape(records, fieldMap = {}) {
  const nodesMap = new Map();
  const edgesMap = new Map();

  for (const record of records) {
    // Handle explicit node fields
    for (const key of record.keys) {
      const value = record.get(key);
      processValue(value, nodesMap, edgesMap);
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };
}

function processValue(value, nodesMap, edgesMap) {
  if (!value) return;

  // Neo4j Path
  if (value.segments) {
    for (const segment of value.segments) {
      addNode(segment.start, nodesMap);
      addNode(segment.end, nodesMap);
      addEdge(segment.relationship, segment.start, segment.end, edgesMap);
    }
    return;
  }

  // Neo4j Node
  if (value.labels) {
    addNode(value, nodesMap);
    return;
  }

  // Neo4j Relationship
  if (value.type) {
    addEdge(value, null, null, edgesMap);
    return;
  }

  // Arrays
  if (Array.isArray(value)) {
    for (const item of value) {
      processValue(item, nodesMap, edgesMap);
    }
  }
}

function addNode(node, nodesMap) {
  const id = node.identity.toString();
  if (nodesMap.has(id)) return;

  const label = node.labels?.[0] || 'Unknown';
  const props = toPlainObject(node.properties);

  nodesMap.set(id, {
    data: {
      id,
      label: props.address || props.name || id,
      nodeType: label,
      ...props,
    },
  });
}

function addEdge(rel, startNode, endNode, edgesMap) {
  const id = rel.identity.toString();
  if (edgesMap.has(id)) return;

  const source = startNode ? startNode.identity.toString() : rel.start.toString();
  const target = endNode ? endNode.identity.toString() : rel.end.toString();
  const props = toPlainObject(rel.properties);

  edgesMap.set(id, {
    data: {
      id: `e${id}`,
      source,
      target,
      edgeType: rel.type,
      label: props.amount != null ? `${props.amount} ${props.coin_type || ''}`.trim() : '',
      ...props,
    },
  });
}

function toPlainObject(props) {
  const obj = {};
  for (const [key, val] of Object.entries(props || {})) {
    if (val != null && typeof val === 'object' && typeof val.toNumber === 'function') {
      obj[key] = val.toNumber();
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

/**
 * Build Cytoscape elements from flat wallet/transfer row data.
 */
export function rowsToCytoscape(rows) {
  const nodesMap = new Map();
  const edges = [];

  for (const row of rows) {
    if (!nodesMap.has(row.wallet_from)) {
      nodesMap.set(row.wallet_from, {
        data: { id: row.wallet_from, label: row.wallet_from, nodeType: 'Wallet' },
      });
    }
    if (!nodesMap.has(row.wallet_to)) {
      nodesMap.set(row.wallet_to, {
        data: { id: row.wallet_to, label: row.wallet_to, nodeType: 'Wallet' },
      });
    }

    edges.push({
      data: {
        id: row.txid || `${row.wallet_from}-${row.wallet_to}-${row.timestamp}`,
        source: row.wallet_from,
        target: row.wallet_to,
        edgeType: 'TRANSFER',
        amount: row.amount,
        coin_type: row.coin_type,
        timestamp: row.timestamp,
        label: `${row.amount} ${row.coin_type || ''}`.trim(),
      },
    });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}
