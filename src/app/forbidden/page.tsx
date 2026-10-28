import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldX className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-widest text-destructive">403</p>
      <h1 className="text-3xl font-bold">Access denied</h1>
      <p className="max-w-md text-muted-foreground">
        Your account does not have permission to view this area. If you believe this is a mistake,
        contact the placement office.
      </p>
      <Button asChild>
        <Link href="/">Return home</Link>
      </Button>
    </div>
  );
}
