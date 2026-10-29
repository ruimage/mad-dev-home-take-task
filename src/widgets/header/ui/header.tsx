import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/shared/ui";

const linkClassName = "text-sm font-medium transition-colors hover:text-foreground";

export function Header() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
        <Link to="/" className="font-semibold tracking-tight">
          bun-fsd-template
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-foreground" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className={linkClassName}
          >
            Home
          </Link>
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
