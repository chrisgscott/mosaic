import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  className?: string;
}

export function Message({ role, content, className }: MessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        isUser ? "bg-muted/50" : "bg-background",
        className
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="text-sm font-medium">
          {isUser ? "You" : "Assistant"}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {content}
        </div>
      </div>
    </div>
  );
}
