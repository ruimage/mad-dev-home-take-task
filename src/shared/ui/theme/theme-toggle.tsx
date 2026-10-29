import { Button } from "../components/button";
import { useTheme } from "./use-theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
      {theme === "dark" ? "☀" : "☾"}
    </Button>
  );
}
