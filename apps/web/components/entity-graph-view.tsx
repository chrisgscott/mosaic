"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import { Entity } from "@/app/(app)/graph/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Maximize2, Network, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface Relationship {
  id: string;
  relationship_type: string;
  description: string | null;
  source?: { id: string; name: string; type: string };
  target?: { id: string; name: string; type: string };
}

interface EntityGraphViewProps {
  entity: Entity;
  outgoingRelationships: Relationship[];
  incomingRelationships: Relationship[];
  allEntities: Entity[];
}

// Helper function for hierarchical layout using dagre
function getHierarchicalLayout(
  entity: Entity,
  outgoingRelationships: Relationship[],
  incomingRelationships: Relationship[]
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 60 });

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const addedEntityIds = new Set<string>();

  // Add current entity as center node
  const currentNode: Node = {
    id: entity.id,
    type: "default",
    position: { x: 0, y: 0 },
    data: { label: entity.name },
    style: {
      background: getColorForType(entity.type),
      color: "#fff",
      border: "3px solid #fff",
      borderRadius: "8px",
      padding: "12px 16px",
      fontSize: "14px",
      fontWeight: "600",
      boxShadow: `0 0 20px ${getColorForType(entity.type)}`,
    },
  };
  nodes.push(currentNode);
  dagreGraph.setNode(entity.id, { width: 180, height: 60 });
  addedEntityIds.add(entity.id);

  // Add outgoing relationships
  outgoingRelationships.forEach((rel) => {
    if (rel.target && !addedEntityIds.has(rel.target.id)) {
      const node: Node = {
        id: rel.target.id,
        type: "default",
        position: { x: 0, y: 0 },
        data: { label: rel.target.name },
        style: {
          background: getColorForType(rel.target.type),
          color: "#fff",
          border: "2px solid #fff",
          borderRadius: "8px",
          padding: "10px 14px",
          fontSize: "12px",
          fontWeight: "500",
        },
      };
      nodes.push(node);
      dagreGraph.setNode(rel.target.id, { width: 160, height: 50 });
      addedEntityIds.add(rel.target.id);
    }

    if (rel.target) {
      edges.push({
        id: `${entity.id}-${rel.target.id}`,
        source: entity.id,
        target: rel.target.id,
        label: rel.relationship_type,
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#64748b", strokeWidth: 2 },
        labelStyle: { fill: "#fff", fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: "rgba(0, 0, 0, 0.8)" },
      });
      dagreGraph.setEdge(entity.id, rel.target.id);
    }
  });

  // Add incoming relationships
  incomingRelationships.forEach((rel) => {
    if (rel.source && !addedEntityIds.has(rel.source.id)) {
      const node: Node = {
        id: rel.source.id,
        type: "default",
        position: { x: 0, y: 0 },
        data: { label: rel.source.name },
        style: {
          background: getColorForType(rel.source.type),
          color: "#fff",
          border: "2px solid #fff",
          borderRadius: "8px",
          padding: "10px 14px",
          fontSize: "12px",
          fontWeight: "500",
        },
      };
      nodes.push(node);
      dagreGraph.setNode(rel.source.id, { width: 160, height: 50 });
      addedEntityIds.add(rel.source.id);
    }

    if (rel.source) {
      edges.push({
        id: `${rel.source.id}-${entity.id}`,
        source: rel.source.id,
        target: entity.id,
        label: rel.relationship_type,
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#64748b", strokeWidth: 2 },
        labelStyle: { fill: "#fff", fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: "rgba(0, 0, 0, 0.8)" },
      });
      dagreGraph.setEdge(rel.source.id, entity.id);
    }
  });

  // Apply dagre layout
  dagre.layout(dagreGraph);

  // Update node positions
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - (nodeWithPosition.width || 0) / 2,
      y: nodeWithPosition.y - (nodeWithPosition.height || 0) / 2,
    };
  });

  return { nodes, edges };
}

export function EntityGraphView({
  entity,
  outgoingRelationships,
  incomingRelationships,
  allEntities,
}: EntityGraphViewProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<"force" | "hierarchical">("hierarchical");

  // Prepare hierarchical layout data
  const hierarchicalData = useMemo(
    () => getHierarchicalLayout(entity, outgoingRelationships, incomingRelationships),
    [entity, outgoingRelationships, incomingRelationships]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(hierarchicalData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(hierarchicalData.edges);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id !== entity.id) {
        router.push(`/graph/${node.id}`);
      }
    },
    [entity.id, router]
  );

  // Prepare graph data for force-graph
  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];

    // Add the current entity as the center node
    nodes.push({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      val: 20, // Larger size for center node
      color: getColorForType(entity.type),
      isCurrent: true,
    });

    // Add connected entities
    const addedEntityIds = new Set([entity.id]);

    // Add outgoing relationships
    outgoingRelationships.forEach((rel) => {
      if (rel.target && !addedEntityIds.has(rel.target.id)) {
        nodes.push({
          id: rel.target.id,
          name: rel.target.name,
          type: rel.target.type,
          val: 12, // Increased from 8
          color: getColorForType(rel.target.type),
        });
        addedEntityIds.add(rel.target.id);
      }

      if (rel.target) {
        links.push({
          source: entity.id,
          target: rel.target.id,
          label: rel.relationship_type,
          color: "rgba(255, 255, 255, 0.3)",
        });
      }
    });

    // Add incoming relationships
    incomingRelationships.forEach((rel) => {
      if (rel.source && !addedEntityIds.has(rel.source.id)) {
        nodes.push({
          id: rel.source.id,
          name: rel.source.name,
          type: rel.source.type,
          val: 12, // Increased from 8
          color: getColorForType(rel.source.type),
        });
        addedEntityIds.add(rel.source.id);
      }

      if (rel.source) {
        links.push({
          source: rel.source.id,
          target: entity.id,
          label: rel.relationship_type,
          color: "rgba(255, 255, 255, 0.3)",
        });
      }
    });

    return { nodes, links };
  }, [entity, outgoingRelationships, incomingRelationships]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Relationship Graph</CardTitle>
            <CardDescription>
              {hierarchicalData.nodes.length - 1} connected entities
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={layout} onValueChange={(value: any) => setLayout(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hierarchical">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Hierarchical
                  </div>
                </SelectItem>
                <SelectItem value="force">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Force-Directed
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/graph/visualize")}
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              Full Graph
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {layout === "hierarchical" ? (
          <div className="w-full h-[600px] bg-muted/20 rounded-lg overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
              attributionPosition="bottom-left"
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        ) : (
          <div className="relative w-full h-[600px] bg-muted/20 rounded-lg overflow-hidden">
            <ForceGraph2D
            graphData={graphData}
            nodeLabel={(node: any) => `${node.name} (${node.type})`}
            nodeAutoColorBy="type"
            linkLabel="label"
            linkDirectionalArrowLength={8}
            linkDirectionalArrowRelPos={0.9}
            linkCurvature={0.25}
            linkWidth={2}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
              // Draw node circle with glow for current entity
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              
              if (node.isCurrent) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = node.color;
              }
              
              ctx.fill();
              ctx.shadowBlur = 0;

              // Add white border for better visibility
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 2;
              ctx.stroke();

              // Only draw label for current entity or on hover
              if (node.isCurrent) {
                const label = node.name;
                const fontSize = 14;
                ctx.font = `bold ${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth + 12, fontSize + 6];

                // Draw label background with better contrast
                ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
                ctx.fillRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y - node.val - bckgDimensions[1] - 8,
                  bckgDimensions[0],
                  bckgDimensions[1]
                );

                // Draw label text above the node
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#fff";
                ctx.fillText(label, node.x, node.y - node.val - 8 - fontSize / 2 + 3);
              }
            }}
            linkDirectionalParticles={3}
            linkDirectionalParticleWidth={3}
            linkDirectionalParticleSpeed={0.006}
            onNodeClick={(node: any) => {
              if (node.id !== entity.id) {
                router.push(`/graph/${node.id}`);
              }
            }}
            // Improved physics for better spacing
            d3AlphaDecay={0.01}
            d3VelocityDecay={0.15}
            cooldownTicks={300}
            warmupTicks={50}
          />
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorForType(entity.type) }} />
            <span>Current Entity</span>
          </div>
          <span>•</span>
          <span>Click any node to navigate</span>
          <span>•</span>
          <span>Arrows show relationship direction</span>
        </div>
      </CardContent>
    </Card>
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
