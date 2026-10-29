import { createToken } from "@/shared/lib/di";
export const DEMO_API = createToken<{ armConflict(): Promise<void> }>("shared.api.demo");
