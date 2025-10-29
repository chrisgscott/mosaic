"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import dynamic from "next/dynamic";
import { Entity } from "@/app/(app)/admin/graph/actions";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  description: string | null;
  confidence: number | null;
}

interface GraphVisualizationProps {
  entities: Entity[];
  relationships: Relationship[];
}

type LayoutType = "circular" | "dagre" | "force" | "obsidian";

// Layout helper functions
function getCircularLayout(entities: Entity[]): Node[] {
  return entities.map((entity, index) => {
    const angle = (index / entities.length) * 2 * Math.PI;
    const radius = 300;
    
    return {
      id: entity.id,
      type: "default",
      position: {
        x: 400 + radius * Math.cos(angle),
        y: 400 + radius * Math.sin(angle),
      },
      data: { label: entity.name },
      style: {
        background: getColorForType(entity.type),
        color: "#fff",
        border: "2px solid #222",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "12px",
        fontWeight: "500",
      },
    };
  });
}

function getDagreLayout(entities: Entity[], relationships: Relationship[]): Node[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 100, nodesep: 80 });

  // Add nodes
  entities.forEach((entity) => {
    dagreGraph.setNode(entity.id, { width: 150, height: 50 });
  });

  // Add edges
  relationships.forEach((rel) => {
    dagreGraph.setEdge(rel.source_entity_id, rel.target_entity_id);
  });

  dagre.layout(dagreGraph);

  return entities.map((entity) => {
    const nodeWithPosition = dagreGraph.node(entity.id);
    return {
      id: entity.id,
      type: "default",
      position: {
        x: nodeWithPosition.x,
        y: nodeWithPosition.y,
      },
      data: { label: entity.name },
      style: {
        background: getColorForType(entity.type),
        color: "#fff",
        border: "2px solid #222",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "12px",
        fontWeight: "500",
      },
    };
  });
}

function getForceLayout(entities: Entity[], relationships: Relationship[]): Node[] {
  // Create nodes with initial random positions
  const nodes = entities.map((entity) => ({
    id: entity.id,
    x: Math.random() * 800,
    y: Math.random() * 800,
  }));

  // Create links
  const links = relationships.map((rel) => ({
    source: rel.source_entity_id,
    target: rel.target_entity_id,
  }));

  // Run force simulation
  const simulation = forceSimulation(nodes as any)
    .force("link", forceLink(links).id((d: any) => d.id).distance(100))
    .force("charge", forceManyBody().strength(-300))
    .force("center", forceCenter(400, 400))
    .force("collide", forceCollide(60));

  // Run simulation synchronously
  simulation.tick(300);
  simulation.stop();

  return entities.map((entity) => {
    const node = nodes.find((n) => n.id === entity.id);
    return {
      id: entity.id,
      type: "default",
      position: {
        x: node?.x || 0,
        y: node?.y || 0,
      },
      data: { label: entity.name },
      style: {
        background: getColorForType(entity.type),
        color: "#fff",
        border: "2px solid #222",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "12px",
        fontWeight: "500",
      },
    };
  });
}

export function GraphVisualization({ entities, relationships }: GraphVisualizationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<Entity | null>(null);
  const [layoutType, setLayoutType] = useState<LayoutType>("obsidian");
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Get unique entity types
  const entityTypes = useMemo(() => {
    const types = new Set(entities.map((e) => e.type));
    return Array.from(types).sort();
  }, [entities]);

  // Transform entities to React Flow nodes based on selected layout
  const initialNodes: Node[] = useMemo(() => {
    switch (layoutType) {
      case "dagre":
        return getDagreLayout(entities, relationships);
      case "force":
        return getForceLayout(entities, relationships);
      case "circular":
      default:
        return getCircularLayout(entities);
    }
  }, [entities, relationships, layoutType]);

  // Transform relationships to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.source_entity_id,
      target: rel.target_entity_id,
      label: rel.relationship_type,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#64748b" },
      labelStyle: { fontSize: "10px", fill: "#64748b" },
    }));
  }, [relationships]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when layout changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Measure container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Filter nodes and edges based on search and type
  const filteredNodes = useMemo(() => {
    let filtered = nodes;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((node) => {
        const entity = entities.find((e) => e.id === node.id);
        return (
          entity?.name.toLowerCase().includes(query) ||
          entity?.description?.toLowerCase().includes(query)
        );
      });
    }

    // Filter by entity type
    if (selectedType !== "all") {
      filtered = filtered.filter((node) => {
        const entity = entities.find((e) => e.id === node.id);
        return entity?.type === selectedType;
      });
    }

    return filtered;
  }, [nodes, searchQuery, selectedType, entities]);

  // Filter edges to only show connections between visible nodes
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [edges, filteredNodes]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const entity = entities.find((e) => e.id === node.id);
      setSelectedNode(entity || null);
    },
    [entities]
  );

  // Prepare data for ForceGraph2D (Obsidian layout)
  const forceGraphData = useMemo(() => {
    const filteredEntityIds = new Set(
      entities
        .filter((e) => {
          if (selectedType !== "all" && e.type !== selectedType) return false;
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              e.name.toLowerCase().includes(query) ||
              e.description?.toLowerCase().includes(query)
            );
          }
          return true;
        })
        .map((e) => e.id)
    );

    return {
      nodes: entities
        .filter((e) => filteredEntityIds.has(e.id))
        .map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          val: (e.relationship_count || 0) + 1, // Node size based on connections
          color: getColorForType(e.type),
        })),
      links: relationships
        .filter(
          (r) =>
            filteredEntityIds.has(r.source_entity_id) &&
            filteredEntityIds.has(r.target_entity_id)
        )
        .map((r) => ({
          source: r.source_entity_id,
          target: r.target_entity_id,
          label: r.relationship_type,
        })),
    };
  }, [entities, relationships, selectedType, searchQuery]);

  return (
    <div className="flex gap-4 h-full w-full p-4 overflow-hidden">
      {/* Main graph area */}
      <div ref={containerRef} className="flex-1 min-w-0 border rounded-lg overflow-hidden bg-background relative">
        {layoutType === "obsidian" ? (
          <div className="w-full h-full">
            <ForceGraph2D
              graphData={forceGraphData}
              nodeLabel="name"
              nodeAutoColorBy="type"
              linkLabel="label"
              linkColor={() => "#64748b"}
              linkWidth={2}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map((n) => n + fontSize * 0.4);

              // Draw node circle with glow
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val * 2, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              ctx.shadowBlur = 10;
              ctx.shadowColor = node.color;
              ctx.fill();
              ctx.shadowBlur = 0;

              // Draw label background
              ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
              ctx.fillRect(
                node.x - bckgDimensions[0] / 2,
                node.y - bckgDimensions[1] / 2 + node.val * 2 + 5,
                bckgDimensions[0],
                bckgDimensions[1]
              );

              // Draw label text
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = "#fff";
              ctx.fillText(label, node.x, node.y + node.val * 2 + 5 + fontSize / 2);
            }}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.005}
            onNodeClick={(node: any) => {
              const entity = entities.find((e) => e.id === node.id);
              setSelectedNode(entity || null);
            }}
            cooldownTicks={100}
            d3VelocityDecay={0.3}
          />
          </div>
        ) : (
          <ReactFlow
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            connectionMode={ConnectionMode.Loose}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        )}
        
        {/* Control Panel - positioned absolutely to work with both layouts */}
        <div className="absolute top-2 left-2 bg-background/95 backdrop-blur p-4 rounded-lg border z-10">
            <div className="space-y-4 min-w-[250px]">
              <div>
                <Label htmlFor="search" className="text-xs">Search Entities</Label>
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="layout" className="text-xs">Layout</Label>
                <Select value={layoutType} onValueChange={(value) => setLayoutType(value as LayoutType)}>
                  <SelectTrigger id="layout" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obsidian">Obsidian (Recommended)</SelectItem>
                    <SelectItem value="force">Force-Directed</SelectItem>
                    <SelectItem value="dagre">Hierarchical (Dagre)</SelectItem>
                    <SelectItem value="circular">Circular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="type" className="text-xs">Filter by Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id="type" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {entityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Showing {layoutType === "obsidian" ? forceGraphData.nodes.length : filteredNodes.length} of {entities.length} entities
              </div>
            </div>
          </div>
      </div>

      {/* Entity details panel */}
      {selectedNode && (
        <Card className="w-80 flex-shrink-0 overflow-auto max-h-full">
          <CardHeader>
            <CardTitle className="text-lg">{selectedNode.name}</CardTitle>
            <CardDescription>
              <Badge variant="outline">
                {selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1)}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedNode.description && (
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{selectedNode.description}</p>
              </div>
            )}
            {selectedNode.aliases && selectedNode.aliases.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Aliases</p>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.aliases.map((alias, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {alias}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Documents</p>
                <p>{selectedNode.document_ids?.length || 0}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Chunks</p>
                <p>{selectedNode.chunk_ids?.length || 0}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Relationships</p>
                <p>{selectedNode.relationship_count || 0}</p>
              </div>
              {selectedNode.extraction_confidence && (
                <div>
                  <p className="font-medium text-muted-foreground">Confidence</p>
                  <p>{Math.round(selectedNode.extraction_confidence * 100)}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to get color for entity type
function getColorForType(type: string): string {
  const colors: Record<string, string> = {
    methodology: "#3b82f6", // blue
    framework: "#8b5cf6", // purple
    tool: "#10b981", // green
    concept: "#f59e0b", // amber
    organization: "#ef4444", // red
    person: "#ec4899", // pink
    program: "#06b6d4", // cyan
    project: "#84cc16", // lime
  };
  return colors[type.toLowerCase()] || "#6b7280"; // gray as default
}
