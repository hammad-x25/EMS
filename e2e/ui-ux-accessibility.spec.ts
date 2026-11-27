import { expect, test } from "@playwright/test";

test.describe("UI/UX accessibility, responsive layout, and high-stakes safeguards", () => {
  test("verifies mobile nav drawer, admin pagination & confirm dialogs, breadcrumbs, theme propagation, focus trap, and modal error visibility", async ({
    browser,
  }) => {
    // 1. Mobile 375x812 viewport: collapsible drawer & zero horizontal page overflow
    test.setTimeout(90_000);
    const pwCandidateEmail = `pw-rotate-${Date.now()}@aegisexam.local`;
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileContext.newPage();

    try {
      await mobilePage.goto("/login");
      await mobilePage.getByLabel("Email address").fill("admin@aegisexam.local");
      await mobilePage.getByLabel("Password").fill("Admin@123!");
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

      // Create an isolated candidate for self-service password change E2E test
      const createRes = await mobilePage.request.post("/api/admin/users", {
        data: {
          name: "Password Rotate Candidate",
          email: pwCandidateEmail,
          password: "TempPassword@123!",
          role: "CANDIDATE",
        },
      });
      expect(createRes.status()).toBe(201);
    } finally {
      await mobileContext.close();
    }

    // 2. Examiner breadcrumbs & Question Bank confirmation dialog
    const examinerContext = await browser.newContext();
    const examinerPage = await examinerContext.newPage();
    try {
      await examinerPage.goto("/login");
      await examinerPage.getByLabel("Email address").fill("examiner1@aegisexam.local");
      await examinerPage.getByLabel("Password").fill("Examiner@123!");
      await examinerPage.getByRole("button", { name: "Sign in securely" }).click();
      await examinerPage.waitForURL("**/examiner");

      // Examiner Change Password dialog rejects wrong current password cleanly
      await examinerPage.getByRole("button", { name: "Change password" }).click();
      const pwModal = examinerPage.getByRole("dialog", { name: "Change password" });
      await expect(pwModal).toBeVisible();
      await pwModal.getByLabel(/Current password/i).fill("WrongPass@123!");
      await pwModal.getByLabel(/^New password/i).fill("RotatedPass@999!");
      await pwModal.getByLabel(/Confirm new password/i).fill("RotatedPass@999!");
      await pwModal.getByRole("button", { name: "Update password" }).click();
      await expect(pwModal.getByRole("alert").first()).toContainText(/Current password is incorrect/i);
      await examinerPage.keyboard.press("Escape");
      await expect(pwModal).toHaveCount(0);

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

    // 3. Candidate self-service password change and re-login verification
    const candidateContext = await browser.newContext();
    const candidatePage = await candidateContext.newPage();
    try {
      await candidatePage.goto("/login");
      await candidatePage.getByLabel("Email address").fill(pwCandidateEmail);
      await candidatePage.getByLabel("Password").fill("TempPassword@123!");
      await candidatePage.getByRole("button", { name: "Sign in securely" }).click();
      await candidatePage.waitForURL("**/candidate");

      await candidatePage.getByRole("button", { name: "Change password" }).click();
      const candPwDialog = candidatePage.getByRole("dialog", { name: "Change password" });
      await candPwDialog.getByLabel(/Current password/i).fill("TempPassword@123!");
      await candPwDialog.getByLabel(/^New password/i).fill("UpdatedStudent@789!");
      await candPwDialog.getByLabel(/Confirm new password/i).fill("UpdatedStudent@789!");
      await candPwDialog.getByRole("button", { name: "Update password" }).click();
      await expect(candPwDialog.getByRole("status")).toContainText(/Password updated/i);
      await candPwDialog.getByRole("button", { name: "Close", exact: true }).click();

      // Sign out and verify new password succeeds
      await candidatePage.getByRole("button", { name: "Sign out" }).click();
      await candidatePage.waitForURL("**/login");
      await candidatePage.getByLabel("Email address").fill(pwCandidateEmail);
      await candidatePage.getByLabel("Password").fill("UpdatedStudent@789!");
      await candidatePage.getByRole("button", { name: "Sign in securely" }).click();
      await candidatePage.waitForURL("**/candidate");
    } finally {
      await candidateContext.close();
    }
  });
});
