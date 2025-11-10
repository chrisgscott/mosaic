'use client';

import { Copy, GitBranch, RefreshCw, Trash2, Star, Share2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Action, Actions } from '@/components/ui/shadcn-io/ai/actions';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import type { UIMessage } from 'ai';

interface MessageActionsProps {
  message: UIMessage;
  onCopy?: () => void;
  onBranch?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onRate?: (rating: 'helpful' | 'not_helpful') => void;
  onShare?: () => void;
  onCite?: () => void;
  isStreaming?: boolean;
}

export function MessageActions({
  message,
  onCopy,
  onBranch,
  onRegenerate,
  onDelete,
  onRate,
  onShare,
  onCite,
  isStreaming = false,
}: MessageActionsProps) {
  // Extract text content from message parts
  const getTextContent = (msg: UIMessage): string => {
    return msg.parts
      ?.filter(part => part.type === 'text')
      .map(part => part.text)
      .join('') || '';
  };

  const handleCopy = async () => {
    const text = getTextContent(message);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Message copied to clipboard');
      onCopy?.();
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error('Failed to copy message');
    }
  };

  const handleBranch = () => {
    onBranch?.();
  };

  const handleRegenerate = () => {
    if (!isStreaming) {
      onRegenerate?.();
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this message?')) {
      onDelete?.();
    }
  };

  const handleRate = (rating: 'helpful' | 'not_helpful') => {
    onRate?.(rating);
    toast.success(`Rated as ${rating.replace('_', ' ')}`);
  };

  const handleShare = () => {
    onShare?.();
  };

  const handleCite = () => {
    onCite?.();
  };

  // Only show actions for completed messages
  if (isStreaming) {
    return null;
  }

  return (
    <Actions className="opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Primary actions - always visible */}
      <Action 
        tooltip="Copy" 
        label="Copy message"
        onClick={handleCopy}
      >
        <Copy className="size-4" />
      </Action>

      {message.role === 'assistant' && (
        <>
          <Action 
            tooltip="Branch" 
            label="Branch conversation"
            onClick={handleBranch}
          >
            <GitBranch className="size-4" />
          </Action>

          <Action 
            tooltip="Regenerate" 
            label="Regenerate response"
            onClick={handleRegenerate}
          >
            <RefreshCw className="size-4" />
          </Action>

          <Action 
            tooltip="Citations" 
            label="View citations"
            onClick={handleCite}
          >
            <MessageSquare className="size-4" />
          </Action>
        </>
      )}

      {/* More actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Action tooltip="More actions" label="More actions">
            <MoreHorizontal className="size-4" />
          </Action>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {message.role === 'assistant' && (
            <>
              <DropdownMenuItem onClick={() => handleRate('helpful')}>
                <Star className="size-4 mr-2" />
                Helpful
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRate('not_helpful')}>
                <Star className="size-4 mr-2 rotate-180" />
                Not Helpful
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="size-4 mr-2" />
            Share
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="size-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Actions>
  );
}
