import { test, expect } from '@playwright/test';

test.describe('Doctor Dashboard E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the auth state in localStorage for doctor
    await page.addInitScript(() => {
      window.localStorage.setItem('DoctorToken', 'test-doctor-token');
    });
    
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));

    // Intercept token validation
    await page.route('**/api/validate_token/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'doctor@test.com', name: 'Doctor', role: 'doctor', error: 0, msg: 'Success' }),
      });
    });

    // Intercept doctor conversation history
    await page.route('**/api/doctor_conversation/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          conv: [], 
          intake_data: { duration: '2 weeks', symptoms: 'itching' },
          doctor_draft: 'Most likely Nummular Eczema.',
          payment_status: 'PAID'
        }),
      });
    });

    // Intercept doctor tabs
    await page.route('**/api/doctor_tabs/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          tabs_doc: [
            { 
              id: 'p1', 
              name: 'Guaq AI', 
              email: 'guaqai@gmail.com', 
              payment_status: 'PAID', 
              active: true,
              intake_data: { duration: '2 weeks', symptoms: 'itching' },
              doctor_draft: 'Most likely Nummular Eczema.'
            }
          ] 
        }),
      });
    });
  });

  test('should view patient details and AI draft', async ({ page }) => {
    // Log viewport
    const viewport = page.viewportSize();
    console.log(`Viewport size: ${viewport?.width}x${viewport?.height}`);

    await page.goto('http://localhost:8080/doctor-login');

    // 1. Verify Patient List
    await expect(page.getByText('Guaq AI')).toBeVisible({ timeout: 15000 });
    console.log('Verified patient in dashboard');

    // 2. Select Patient
    await page.getByText('Guaq AI').click();
    await page.waitForTimeout(2000); // Give it more time to render and for useEffect to run

    // 3. Verify Case Summary
    await expect(page.getByText('Medical Case Summary')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2 weeks')).toBeVisible();
    await expect(page.getByText('itching')).toBeVisible();
    console.log('Verified case summary data');

    // 4. Verify AI Draft is loaded into editor
    const editor = page.locator('textarea[placeholder*="Write your professional assessment"]');
    await expect(editor).toHaveValue(/Most likely Nummular Eczema/);
    console.log('Verified AI draft loaded in editor');

    // 5. Test Refine with AI Sidebar
    // The sidebar might be open by default on desktop
    const sidebarInput = page.locator('input[placeholder*="Ask for diagnosis"]');
    const isSidebarVisible = await sidebarInput.isVisible();
    
    if (!isSidebarVisible) {
      console.log('Sidebar not visible, clicking toggle button...');
      const aiButton = page.locator('button:has-text("Refine"), button:has-text("AI Tools")');
      await aiButton.click();
    }
    
    await expect(page.locator('input[placeholder*="Ask for diagnosis"]')).toBeVisible({ timeout: 15000 });
    console.log('Verified AI Consultation sidebar visibility');
    
    await page.locator('input[placeholder*="Ask for diagnosis"]').fill('What is the dosage?');
    
    // Mock internal consultation API
    await page.route('**/api/doctor_chat_view/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'Apply Mometasone 0.1% once daily.', role: 'internal-consultation' }),
      });
    });
    
    await page.keyboard.press('Enter');
    await expect(page.getByText('Apply Mometasone 0.1% once daily.')).toBeVisible();
    console.log('Verified internal AI consultation');

    // 6. Apply AI suggestion to editor
    await page.getByText('Apply to Editor').last().click();
    await expect(editor).toHaveValue(/Apply Mometasone 0.1% once daily/);
    console.log('Verified content applied from sidebar to editor');

    // 7. Send Response
    await page.route('**/api/doctor_send_response/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', role: 'doctor' }),
      });
    });

    await page.getByText('Send Response').click();
    await expect(page.getByText('Response Sent')).toBeVisible();
    console.log('Verified sending response to patient');
  });
});
