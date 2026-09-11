import { cn } from "@/lib/utils/cn";

export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8", className)} {...props} />;
}
