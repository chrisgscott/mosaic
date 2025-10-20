"use client";

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Entity } from "@/app/(app)/graph/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Maximize2 } from "lucide-react";
import { useRouter } from "next/navigation";

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

export function EntityGraphView({
  entity,
  outgoingRelationships,
  incomingRelationships,
  allEntities,
}: EntityGraphViewProps) {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Prepare graph data for force-graph
  const graphData = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];

    // Add the current entity as the center node
    nodes.push({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      val: 15, // Larger size for center node
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
          val: 8,
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
          val: 8,
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
              {graphData.nodes.length - 1} connected entities
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/graph/visualize")}
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Full Graph
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-[500px] bg-muted/20 rounded-lg overflow-hidden">
          <ForceGraph2D
            graphData={graphData}
            nodeLabel="name"
            nodeAutoColorBy="type"
            linkLabel="label"
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.2}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = node.isCurrent ? 14 : 12;
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth + 8, fontSize + 4];

              // Draw node circle with glow for current entity
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              
              if (node.isCurrent) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = node.color;
              }
              
              ctx.fill();
              ctx.shadowBlur = 0;

              // Draw label background
              ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
              ctx.fillRect(
                node.x - bckgDimensions[0] / 2,
                node.y - bckgDimensions[1] / 2 + node.val + 5,
                bckgDimensions[0],
                bckgDimensions[1]
              );

              // Draw label text
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = "#fff";
              ctx.fillText(label, node.x, node.y + node.val + 5 + fontSize / 2);
            }}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.005}
            onNodeClick={(node: any) => {
              if (node.id !== entity.id) {
                router.push(`/graph/${node.id}`);
              }
            }}
            cooldownTicks={100}
            d3VelocityDecay={0.3}
          />
        </div>
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
