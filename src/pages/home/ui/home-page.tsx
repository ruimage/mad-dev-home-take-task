import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from "@/shared/ui";

const stack = [
  "Bun — runtime, bundler, test runner",
  "Feature-Sliced Design — architecture",
  "shadcn/ui + Tailwind CSS v4 — interface",
  "Zod + @rzv/make-brand — validated branded types",
  "DI service layer — external sources",
  "Playwright — e2e & component tests",
];

export function HomePage() {
  return (
    <section className="mx-auto grid w-full max-w-5xl items-start gap-6 px-4 py-10 md:grid-cols-2">
      <Card>
        <CardHeader>
          <h1 className="text-3xl leading-none font-semibold tracking-tight">Bun + FSD Template</h1>
          <CardDescription>
            Frontend template on pure Bun: dev server, bundler and unit tests without extra tooling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Classic shadcn/ui example card (docs "Cards" demo). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create project</CardTitle>
          <CardDescription>Deploy your new project in one-click.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Input placeholder="Name of your project" />
          <Input type="email" placeholder="Email" />
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" type="button">
            Cancel
          </Button>
          <Button type="button">Deploy</Button>
        </CardFooter>
      </Card>
    </section>
  );
}
