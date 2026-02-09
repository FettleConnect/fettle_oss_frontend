import { test, expect } from '@playwright/test';

test.describe('Consultation E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Log browser console
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));

    // Mock the auth state in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('authToken', 'test-token');
    });
    
    // Intercept token validation
    await page.route('**/api/validate_token/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'test_patient@example.com', name: 'Test Patient', error: 0, msg: 'Success' }),
      });
    });

    // Intercept chat history
    await page.route('**/api/chat_history/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conv: [], thread_id: 'test-thread', mode: 'general_education' }),
      });
    });

    // Intercept consultation list
    await page.route('**/api/consultation_list/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ history: [] }),
      });
    });
  });

  test('should complete the entire patient flow', async ({ page }) => {
    await page.goto('http://localhost:8080/');

    // 1. Initial State: Educational Mode
    await expect(page.getByText('Educational Mode')).toBeVisible({ timeout: 15000 });
    console.log('Verified Educational Mode');

    // 2. Type YES to trigger payment
    const chatInput = page.locator('textarea[placeholder*="Type your message"]');
    await chatInput.fill('YES');
    
    // Mock chat_view for 'YES'
    await page.route('**/api/chat_view/', async route => {
      console.log('Intercepted API Call:', route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          result: "Your Dermatology Review Is Ready to Begin. Please complete the payment to proceed.", 
          role: 'ai',
          mode: 'payment_page'
        }),
      });
    });
    
    await page.keyboard.press('Enter');
    console.log('Sent YES (Enter pressed)');

    // 3. Verify Payment Info Page appears
    try {
      await expect(page.getByText('Dermatologist Consultation')).toBeVisible({ timeout: 15000 });
      console.log('Verified Payment Info Page');
      
      // Click 'Pay £49' to go to checkout step
      await page.getByRole('button', { name: /Pay £/ }).click();
      console.log('Clicked Pay button');

      await expect(page.getByText('Complete Payment')).toBeVisible({ timeout: 15000 });
      console.log('Verified Checkout Page');
    } catch (e) {
      await page.screenshot({ path: 'payment-failure.png', fullPage: true });
      throw e;
    }

    // 4. Click Bypass Payment (Dev Mode) or Simulate success
    await page.route('**/api/chat_view/', async route => {
      const payload = await route.request().postData();
      if (payload?.includes('PAYMENT_CONFIRMED')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ result: "Thank you for payment.", role: 'ai', mode: 'post_payment_intake' }),
        });
      }
    });

    const bypassButton = page.locator('button:has-text("Bypass Payment"), button:has-text("Simulate PayPal Success")');
    await bypassButton.click();
    console.log('Clicked Bypass/Simulate button, waiting for Intake Mode...');

    // 5. Verify Intake Mode
    await expect(page.getByText('Intake Mode')).toBeVisible({ timeout: 15000 });
    console.log('Verified Intake Mode');

    // 6. Answer intake questions (Simulate 6 steps)
    const intakeInput = page.locator('textarea[placeholder*="Describe your symptoms"]');
    
    // Step 1: Duration
    await intakeInput.fill('2 weeks');
    await page.keyboard.press('Enter');
    
    // Step 2: Symptoms
    await page.waitForTimeout(1000);
    await intakeInput.fill('Itching and redness');
    await page.keyboard.press('Enter');

    // ... Fast forward to DONE
    await page.route('**/api/chat_view/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: "Thank you. Reviewing.", role: 'ai', mode: 'dermatologist_review' }),
      });
    });

    await intakeInput.fill('DONE');
    await page.keyboard.press('Enter');

    // 7. Verify Awaiting Review
    await expect(page.getByText('Awaiting Review')).toBeVisible({ timeout: 10000 });
    console.log('Verified Awaiting Review');
  });

  test('should show consultation history and allow switching', async ({ page }) => {
    const historyData = [
      { id: 'h1', name: 'Consultation 2026-02-01', mode: 'final_output', status: 'archived', created_at: '2026-02-01T10:00:00Z' },
      { id: 'h2', name: 'Consultation 2026-02-05', mode: 'dermatologist_review', status: 'active', created_at: '2026-02-05T12:00:00Z' }
    ];

    await page.route('**/api/consultation_list/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ history: historyData }),
      });
    });

    await page.goto('http://localhost:8080/');

    // Verify history items
    await expect(page.getByText('Consultation 2026-02-01')).toBeVisible();
    await expect(page.getByText('Consultation 2026-02-05')).toBeVisible();
    console.log('Verified history items in sidebar');

    // Mock history fetch for specific thread
    await page.route('**/api/chat_history/?thread_id=h1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          conv: [{ id: 'm1', role: 'doctor', content: 'Final assessment for h1' }], 
          thread_id: 'h1', 
          mode: 'final_output' 
        }),
      });
    });

    await page.getByText('Consultation 2026-02-01').click();
    await expect(page.getByText('Final assessment for h1')).toBeVisible();
    await expect(page.getByText('Consultation Complete')).toBeVisible();
    console.log('Successfully switched to historical consultation');
  });
});
