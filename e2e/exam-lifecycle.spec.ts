import { expect, test } from "@playwright/test";

test.describe("AegisExam full evaluation lifecycle", () => {
  test("covers admin RBAC, fairness & sandbox, offline exam sync, grading, PDF/QR verification, and dispute resolution", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const adminContext = await browser.newContext();
    const examinerContext = await browser.newContext();
    const candidateContext = await browser.newContext();

    try {
      // 1. Admin login & RBAC verification
      const adminPage = await adminContext.newPage();
      await adminPage.goto("/login");
      await adminPage.getByLabel("Email address").fill("admin@aegisexam.local");
      await adminPage.getByLabel("Password").fill("Admin@123!");
      await adminPage.getByRole("button", { name: "Sign in securely" }).click();
      await adminPage.waitForURL("**/admin");
      await adminPage.goto("/admin/users");
      await expect(adminPage.locator("#main-content").getByText("Aegis Administrator")).toBeVisible();

      // 2. Examiner login, Fairness Inspector, and Sandbox preview
      const examinerPage = await examinerContext.newPage();
      await examinerPage.goto("/login");
      await examinerPage.getByLabel("Email address").fill("examiner1@aegisexam.local");
      await examinerPage.getByLabel("Password").fill("Examiner@123!");
      await examinerPage.getByRole("button", { name: "Sign in securely" }).click();
      await examinerPage.waitForURL("**/examiner");

      await examinerPage.goto("/examiner/exams/seed-exam-ongoing");
      await examinerPage.getByRole("tab", { name: /3\. Fairness Inspector/i }).click();
      await examinerPage.getByRole("button", { name: /Run 20-paper simulation/i }).click();
      await expect(examinerPage.getByText(/Difficulty Std Dev/i)).toBeVisible();

      await examinerPage.request.delete("/api/exams/seed-exam-ongoing/sandbox");
      await examinerPage.goto("/examiner/exams/seed-exam-ongoing/sandbox");
      await expect(examinerPage.getByText(/SANDBOX PREVIEW MODE/i).first()).toBeVisible();

      // Create an isolated live exam for this E2E run
      const now = Date.now();
      const createExamRes = await examinerPage.request.post("/api/exams", {
        data: {
          title: `E2E Live Verification Exam ${now}`,
          instructions: "E2E automated assessment covering offline sync, grading, PDF QR, and dispute resolution.",
          scheduledStart: new Date(now - 5 * 60_000).toISOString(),
          scheduledEnd: new Date(now + 60 * 60_000).toISOString(),
          durationMinutes: 30,
          totalMarks: 10,
          passingMarks: 5,
          shuffleQuestions: false,
          shuffleOptions: false,
          useStratifiedBlueprint: false,
          multiSelectRule: "PARTIAL_NO_NEGATIVE",
          negativeMarkRatio: 0,
          revealAnswersAfterPublish: true,
        },
      });
      expect(createExamRes.ok()).toBe(true);
      const { exam } = (await createExamRes.json()) as { exam: { id: string } };

      const assignRes = await examinerPage.request.put(`/api/exams/${exam.id}/questions`, {
        data: {
          items: [
            { questionId: "seed-question-01", marks: 2, orderIndex: 0 },
            { questionId: "seed-question-02", marks: 3, orderIndex: 1 },
            { questionId: "seed-question-03", marks: 5, orderIndex: 2 },
          ],
        },
      });
      expect(assignRes.ok()).toBe(true);

      const enrollRes = await examinerPage.request.post(`/api/exams/${exam.id}/enrollments`, {
        data: { emails: ["candidate5@aegisexam.local"] },
      });
      expect(enrollRes.ok()).toBe(true);

      const transitionRes = await examinerPage.request.post(`/api/exams/${exam.id}/transition`, {
        data: { targetStatus: "PUBLISHED" },
      });
      expect(transitionRes.ok()).toBe(true);

      // 3. Candidate login, exam start, offline queue & reconnect sync, and submit
      const candidatePage = await candidateContext.newPage();
      await candidatePage.goto("/login");
      await candidatePage.getByLabel("Email address").fill("candidate5@aegisexam.local");
      await candidatePage.getByLabel("Password").fill("Candidate@123!");
      await candidatePage.getByRole("button", { name: "Sign in securely" }).click();
      await candidatePage.waitForURL("**/candidate");

      await candidatePage.goto("/candidate/dashboard");
      const examHeading = candidatePage.getByRole("heading", { name: `E2E Live Verification Exam ${now}` });
      await expect(examHeading).toBeVisible();
      await candidatePage.locator("article", { has: examHeading }).getByRole("button", { name: /View instructions/i }).click();
      await expect(candidatePage.getByRole("button", { name: /Start examination/i })).toBeDisabled();
      await candidatePage.getByRole("checkbox", { name: /I am ready to begin/i }).check();
      await candidatePage.getByRole("link", { name: /Start examination/i }).click();
      await candidatePage.waitForURL(`**/candidate/exams/${exam.id}/take`);

      // Question 1 (SINGLE_MCQ: Queue)
      await candidatePage.getByLabel(/Queue/i).first().check();
      await expect(candidatePage.getByRole("status").filter({ hasText: "Synced" })).toBeVisible();

      // Simulate offline outage on Question 2 (MULTI_SELECT) & Question 3 (WRITTEN)
      await candidatePage.getByRole("button", { name: /^Next/i }).click();
      await candidateContext.setOffline(true);
      await candidatePage.getByLabel(/Merge sort/i).check();
      await candidatePage.getByLabel(/Quick sort/i).check();
      await expect(candidatePage.getByRole("status").filter({ hasText: /Offline/i })).toBeVisible();

      await candidatePage.getByRole("button", { name: /^Next/i }).click();
      await candidatePage.locator("textarea").fill("A stack is LIFO while a queue is FIFO.");

      // Reconnect and wait for automatic queue flush
      await candidateContext.setOffline(false);
      await expect(candidatePage.getByRole("status").filter({ hasText: "Synced" })).toBeVisible({ timeout: 15_000 });

      await candidatePage.getByRole("button", { name: /Review & Submit/i }).click();
      await candidatePage.getByRole("button", { name: /Confirm final submission/i }).click();
      await expect(candidatePage.getByRole("heading", { name: "Submission received" })).toBeVisible({ timeout: 15_000 });

      // 4. Examiner grades written response and publishes results
      await examinerPage.goto(`/examiner/exams/${exam.id}/grading`);
      await expect(examinerPage.getByRole("heading", { name: "Demo Candidate 5" })).toBeVisible();
      await examinerPage.getByLabel(/Score \/ 5/i).fill("4");
      await examinerPage.getByLabel("Feedback").fill("Good comparison.");
      await examinerPage.getByRole("button", { name: /Save grade/i }).click();
      await expect(examinerPage.getByText(/Manual grade saved/i)).toBeVisible();

      await examinerPage.getByRole("button", { name: /Preview result summary/i }).click();
      await examinerPage.getByRole("button", { name: /Publish results/i }).click();
      await expect(examinerPage.getByText(/results published/i)).toBeVisible();

      // 5. Candidate views result, downloads PDF, verifies QR code, and files a dispute
      await candidatePage.goto("/candidate/dashboard");
      const completedHeading = candidatePage.getByRole("heading", { name: `E2E Live Verification Exam ${now}` });
      await candidatePage.locator("article", { has: completedHeading }).getByRole("link", { name: /View result/i }).click();
      await candidatePage.waitForURL("**/candidate/results/**");
      const attemptId = candidatePage.url().split("/").pop() ?? "";
      await expect(candidatePage.getByText("9 / 10")).toBeVisible();

      const pdfRes = await candidatePage.request.get(`/api/reports/attempt/${attemptId}/pdf`);
      expect(pdfRes.status()).toBe(200);
      expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
      const codeV1 = pdfRes.headers()["x-verification-code"];
      expect(codeV1).toMatch(/^AEG-[A-F0-9]{4}-[A-F0-9]{4}$/);

      // Verify v1 report publicly without leaking email
      const publicPage = await browser.newPage();
      await publicPage.goto(`/verify/${codeV1}`);
      await expect(publicPage.getByRole("heading", { name: "VALID" })).toBeVisible();
      await expect(publicPage.getByText("candidate5@aegisexam.local")).toHaveCount(0);

      // Candidate raises a dispute on Question 3
      await candidatePage.getByRole("button", { name: /Raise a dispute/i }).click();
      await candidatePage.getByLabel(/Related question/i).selectOption({ index: 3 });
      await candidatePage
        .getByLabel(/Detailed explanation/i)
        .fill("Please recheck the written answer for full 5/5 credit.");
      await candidatePage.getByRole("button", { name: /Submit dispute/i }).click();
      await expect(candidatePage.getByText(/Dispute submitted/i)).toBeVisible();

      // 6. Examiner resolves dispute with adjusted score -> supersedes v1 report and issues v2
      await examinerPage.goto("/examiner/disputes");
      await expect(examinerPage.getByText(`E2E Live Verification Exam ${now}`).first()).toBeVisible();
      await examinerPage.getByText(`E2E Live Verification Exam ${now}`).first().click();
      await examinerPage.getByLabel(/New written score/i).fill("5");
      await examinerPage
        .getByLabel(/Resolution note/i)
        .fill("Full credit granted after reviewing the LIFO/FIFO explanation.");
      await examinerPage.getByRole("button", { name: /Confirm audited resolution/i }).click();
      await expect(examinerPage.getByText(/Updated score: 10 \/ 10/i)).toBeVisible();

      // Old v1 code is now REVOKED SUPERSEDED; new PDF v2 code is VALID with 10 / 10
      await publicPage.goto(`/verify/${codeV1}`);
      await expect(publicPage.getByRole("heading", { name: "REVOKED SUPERSEDED" })).toBeVisible();

      const pdfV2Res = await candidatePage.request.get(`/api/reports/attempt/${attemptId}/pdf`);
      const codeV2 = pdfV2Res.headers()["x-verification-code"];
      expect(codeV2).not.toBe(codeV1);
      await publicPage.goto(`/verify/${codeV2}`);
      await expect(publicPage.getByRole("heading", { name: "VALID" })).toBeVisible();
      await expect(publicPage.getByText("10 / 10")).toBeVisible();
      await publicPage.close();
    } finally {
      await adminContext.close();
      await examinerContext.close();
      await candidateContext.close();
    }
  });
});
