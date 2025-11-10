'use client';

import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileAttachmentBadgeProps {
  fileName: string;
  onRemove?: () => void;
  className?: string;
}

export function FileAttachmentBadge({ fileName, onRemove, className }: FileAttachmentBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border bg-blue-50 dark:bg-blue-950 px-3 py-2',
        'border-blue-200 dark:border-blue-800',
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-shrink-0 rounded bg-blue-500 p-1.5">
          <FileText className="size-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
            {fileName}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Document</p>
        </div>
      </div>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900"
          onClick={onRemove}
        >
          <X className="h-3 w-3 text-blue-700 dark:text-blue-300" />
        </Button>
      )}
    </div>
  );
}
