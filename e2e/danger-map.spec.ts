import { expect, test } from "@playwright/test";

test("renders the command center map and interactive controls", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("RiskMap Analyzer");
  await expect(page.locator('link[rel~="icon"]').first()).toHaveAttribute("href", "/favicon.svg");
  await expect(page.getByLabel("Layer controls")).toBeVisible();
  await expect(page.getByLabel("Global risk stats")).toBeVisible();
  await expect(page.getByText("GLOBAL DEFCON")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".ticker")).toBeVisible();
  await expect(page.locator(".country-path").first()).toBeVisible();
  await expect(page.getByLabel("Map zoom controls")).toBeVisible();
  await expect(page.locator(".threat-scene-canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cyber Attacks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "FBI Overlay" })).toHaveCount(0);
  await expect(page.locator(".cyber-pulse").first()).toBeVisible();
  await expect(page.locator(".cyber-heat-trail").first()).toBeVisible();
  await expect(page.locator(".attack-arc-line").first()).toBeVisible();
  await expect(page.locator(".ticker-source").filter({ hasText: "CYBER" }).first()).toBeVisible();
  await expect(page.getByLabel("Source confidence badges")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open command search" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Puneet Dixit's GitHub profile" })).toHaveAttribute(
    "href",
    "https://github.com/puneetdixit200",
  );
  await expect(page.getByText("Made with")).toBeVisible();
  await expect(page.getByText("PUNEET DIXIT")).toBeVisible();

  const zoomBox = await page.getByLabel("Map zoom controls").boundingBox();
  expect(zoomBox?.x).toBeGreaterThan(420);
  expect(zoomBox?.x).toBeLessThan(760);

  const githubBox = await page.getByRole("link", { name: "Open Puneet Dixit's GitHub profile" }).boundingBox();
  const tickerBox = await page.locator(".ticker").boundingBox();
  expect(githubBox?.x).toBeGreaterThan(1000);
  expect((githubBox?.x ?? 0) + (githubBox?.width ?? 0)).toBeLessThan(1275);
  expect(githubBox?.y).toBeLessThan((tickerBox?.y ?? 0) - 8);

  const beforeDrag = await page.getByLabel("Layer controls").boundingBox();
  await page.getByTestId("drag-layer-controls").dragTo(page.locator(".leaflet-container"), {
    targetPosition: { x: 420, y: 180 },
  });
  const afterDrag = await page.getByLabel("Layer controls").boundingBox();
  expect(afterDrag?.x).toBeGreaterThan((beforeDrag?.x ?? 0) + 120);
  expect(afterDrag?.y).toBeGreaterThan((beforeDrag?.y ?? 0) + 60);

  const longHorizontalBands = await page.locator(".country-path").evaluateAll((paths) =>
    paths.filter((path) => {
      const box = path.getBoundingClientRect();
      return box.width > window.innerWidth * 0.78 && box.height < 180;
    }).length,
  );
  expect(longHorizontalBands).toBe(0);

  await page.getByLabel("Toggle night vision").click();
  await expect(page.locator("main.danger-shell")).toHaveClass(/night-vision/);

  await page.getByRole("button", { name: "Open command search" }).click();
  await expect(page.getByLabel("Threat search command palette")).toBeVisible();
  await page.getByLabel("Search countries, IPs, CVEs, outbreaks, and notices").fill("United");
  await expect(page.locator(".command-result").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Threat search command palette")).toHaveCount(0);

  await page.getByRole("button", { name: "Replay incidents" }).click();
  await expect(page.getByText(/Hour \d+\/24/)).toBeVisible();

  await page.getByRole("button", { name: "Outbreak Watch" }).click();
  await expect(page.locator(".disease-pulse")).toHaveCount(0);

  await page.getByRole("button", { name: "Cyber Attacks" }).click();
  await expect(page.locator(".cyber-pulse")).toHaveCount(0);

  await page.locator(".country-path").evaluateAll((paths) => {
    const target =
      paths.find((path) => {
        const box = path.getBoundingClientRect();
        return box.width > 80 && box.height > 40;
      }) ?? paths[0];

    target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, view: window }));
  });
  await expect(page.locator(".intel-card.open")).toBeVisible();
  await expect(page.getByLabel("Country lockdown simulator")).toBeVisible();
  await page.getByLabel("Country lockdown simulator").getByText("Patch CVEs").click();
  await expect(page.getByText(/Simulated risk:/)).toBeVisible();
});
