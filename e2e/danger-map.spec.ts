import { expect, test } from "@playwright/test";

test("renders the command center map and interactive controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Layer controls")).toBeVisible();
  await expect(page.getByLabel("Global risk stats")).toBeVisible();
  await expect(page.getByText("GLOBAL DEFCON")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".ticker")).toBeVisible();
  await expect(page.locator(".country-path").first()).toBeVisible();

  await page.getByLabel("Toggle night vision").click();
  await expect(page.locator("main.danger-shell")).toHaveClass(/night-vision/);

  await page.getByRole("button", { name: "Disease Spread" }).click();
  await expect(page.locator(".disease-pulse")).toHaveCount(0);

  await page.locator(".country-path").evaluateAll((paths) => {
    const target =
      paths.find((path) => {
        const box = path.getBoundingClientRect();
        return box.width > 80 && box.height > 40;
      }) ?? paths[0];

    target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, view: window }));
  });
  await expect(page.locator(".intel-card.open")).toBeVisible();
});
