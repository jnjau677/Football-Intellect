import { cn } from "@/lib/utils";

interface FormGuideProps {
  form: string[];
}

export function FormGuide({ form }: FormGuideProps) {
  // Take last 5 matches
  const lastFive = form.slice(-5);

  return (
    <div className="flex items-center gap-1">
      {lastFive.map((result, idx) => {
        let colorClass = "bg-muted text-muted-foreground";
        if (result === "W") colorClass = "bg-green-500/20 text-green-500 border-green-500/30";
        if (result === "L") colorClass = "bg-red-500/20 text-red-500 border-red-500/30";
        if (result === "D") colorClass = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";

        return (
          <div 
            key={idx}
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border",
              colorClass
            )}
            title={result === "W" ? "Win" : result === "L" ? "Loss" : "Draw"}
          >
            {result}
          </div>
        );
      })}
    </div>
  );
}
