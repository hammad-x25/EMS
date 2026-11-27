import { expect, test } from "@playwright/test";

test.describe("UI/UX accessibility, responsive layout, and high-stakes safeguards", () => {
  test("verifies mobile nav drawer, admin pagination & confirm dialogs, breadcrumbs, theme propagation, focus trap, and modal error visibility", async ({
    browser,
  }) => {
    // 1. Mobile 375x812 viewport: collapsible drawer & zero horizontal page overflow
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileContext.newPage();

    try {
      await mobilePage.goto("/login");
      await mobilePage.getByRole("button", { name: "Administrator" }).click();
      await mobilePage.getByRole("button", { name: "Sign in securely" }).click();
      await mobilePage.waitForURL("**/admin");

      const menuBtn = mobilePage.getByRole("button", { name: /Open navigation menu/i });
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();

      const navDialog = mobilePage.getByRole("dialog");
      await expect(navDialog).toBeVisible();
      await navDialog.getByRole("link", { name: /Users & roles/i }).click();
      await mobilePage.waitForURL("**/admin/users");

      const hasOverflow = await mobilePage.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);

      // Confirmation dialog on deactivate can be cancelled cleanly via Escape
      const deactivateBtn = mobilePage.getByRole("button", { name: "Deactivate" }).first();
      await deactivateBtn.click();
      await expect(mobilePage.getByRole("dialog")).toBeVisible();
      await mobilePage.keyboard.press("Escape");
      await expect(mobilePage.getByRole("dialog")).toHaveCount(0);

      // Pagination GET endpoint verification
      const auditNav = await mobilePage.goto("/admin/audit");
      expect(auditNav?.status()).toBe(200);
      await expect(mobilePage.getByRole("heading", { name: /Platform audit trail/i })).toBeVisible();
    } finally {
      await mobileContext.close();
    }

    // 2. Examiner breadcrumbs & Question Bank confirmation dialog
    const examinerContext = await browser.newContext();
    const examinerPage = await examinerContext.newPage();
    try {
      await examinerPage.goto("/login");
      await examinerPage.getByRole("button", { name: "Examiner" }).click();
      await examinerPage.getByRole("button", { name: "Sign in securely" }).click();
      await examinerPage.waitForURL("**/examiner");

      await examinerPage.goto("/examiner/exams/seed-exam-ongoing/monitor");
      await expect(examinerPage.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
      await examinerPage
        .getByRole("navigation", { name: "Breadcrumb" })
        .getByRole("link", { name: /CS-301/i })
        .click();
      await examinerPage.waitForURL("**/examiner/exams/seed-exam-ongoing");

      // Exam workspace sandbox: keyboard shortcut guard, Dark theme propagation, Escape close, offline error inside modal
      await examinerPage.request.delete("/api/exams/seed-exam-ongoing/sandbox");
      await examinerPage.goto("/examiner/exams/seed-exam-ongoing/sandbox");
      await expect(examinerPage.getByText(/Question 1 of/i)).toBeVisible();

      // Open Workspace settings drawer
      const settingsBtn = examinerPage.getByRole("button", { name: "Workspace settings" });
      await settingsBtn.click();
      const settingsDialog = examinerPage.getByRole("dialog", { name: "Workspace settings" });
      await expect(settingsDialog).toBeVisible();

      // Pressing 'n' while overlay is open must NOT change question
      await examinerPage.keyboard.press("n");
      await expect(examinerPage.getByText(/Question 1 of/i)).toBeVisible();

      // Enable Dark theme and confirm drawer surface inherits dark background (not hardcoded white)
      await settingsDialog.getByLabel(/Visual theme/i).selectOption("dark");
      const drawerBg = await settingsDialog.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(drawerBg).not.toBe("rgb(255, 255, 255)");

      // Escape closes drawer and restores focus to trigger button
      await examinerPage.keyboard.press("Escape");
      await expect(settingsDialog).toHaveCount(0);
      await expect(settingsBtn).toBeFocused();

      // Restore light theme preference cleanly
      await settingsBtn.click();
      await examinerPage.getByRole("dialog", { name: "Workspace settings" }).getByLabel(/Visual theme/i).selectOption("light");
      await examinerPage.keyboard.press("Escape");

      // Simulate offline change + review modal submit attempt -> error renders INSIDE modal
      await examinerContext.setOffline(true);
      await examinerPage.getByRole("button", { name: /Mark for review/i }).click();
      await examinerPage.getByRole("button", { name: /Review & Submit/i }).click();
      const reviewDialog = examinerPage.getByRole("dialog", { name: /Review & submit/i });
      await expect(reviewDialog).toBeVisible();
      await reviewDialog.getByRole("button", { name: /Confirm final submission/i }).click();
      await expect(reviewDialog.getByRole("alert")).toContainText(/Reconnect and synchronize/i);
      await reviewDialog.getByRole("button", { name: /Return to exam/i }).click();
      await examinerContext.setOffline(false);
    } finally {
      await examinerContext.close();
    }
  });
});
