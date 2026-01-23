import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { useRef, useState, useEffect } from "react";

interface Block {
  id: string;
  block_name_snapshot: string;
  answeredCount: number;
  totalCount: number;
}

interface ChecklistBlockNavProps {
  blocks: Block[];
  activeBlockId: string | null;
  onBlockClick: (blockId: string) => void;
}

export default function ChecklistBlockNav({ 
  blocks, 
  activeBlockId, 
  onBlockClick 
}: ChecklistBlockNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftFade(scrollLeft > 8);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 8);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [blocks]);

  return (
    <div className="relative">
      {/* Left fade indicator */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none transition-opacity duration-200",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
      />
      
      {/* Right fade indicator */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none transition-opacity duration-200",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
      />

      <div 
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide"
      >
        {blocks.map((block, index) => {
          const isComplete = block.answeredCount === block.totalCount && block.totalCount > 0;
          const isActive = activeBlockId === block.id;
          
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onBlockClick(block.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : isComplete
                    ? "bg-success/15 text-success hover:bg-success/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <span className="opacity-70">{index + 1}</span>
              )}
              <span className="truncate max-w-[80px] sm:max-w-[120px]">{block.block_name_snapshot}</span>
              <span className={cn(
                "text-[10px] px-1 py-0.5 rounded-full",
                isActive ? "bg-primary-foreground/20" : "bg-background/50"
              )}>
                {block.answeredCount}/{block.totalCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
