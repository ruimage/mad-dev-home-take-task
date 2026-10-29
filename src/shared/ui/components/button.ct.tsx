import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "./button";

test("renders label and handles clicks", async ({ mount }) => {
  const clicks: string[] = [];

  const component = await mount(
    <Button
      onClick={() => {
        clicks.push("clicked");
      }}
    >
      Click me
    </Button>,
  );

  await expect(component).toContainText("Click me");
  await component.click();

  expect(clicks).toEqual(["clicked"]);
});

test("supports variants through the class API", async ({ mount }) => {
  const component = await mount(<Button variant="outline">Outline</Button>);
  await expect(component).toBeVisible();
  await expect(component).toHaveClass(/border/);
});
