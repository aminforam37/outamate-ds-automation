# Test info

- Name: Login
- Location: C:\DS_playwright-test\tests\Order_Creation.spec.ts:5:6

# Error details

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('button[type="submit"]').nth(1)
    - locator resolved to <button type="submit" color="primary" mat-flat-button="" ng-reflect-color="primary" _ngcontent-ng-c664207029="" mat-ripple-loader-uninitialized="" mat-ripple-loader-class-name="mat-mdc-button-ripple" class="mdc-button mdc-button--unelevated mat-mdc-unelevated-button mat-primary mat-mdc-button-base">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <mat-calendar id="mat-datepicker-0" ng-reflect-start-view="month" ng-reflect-start-at="Mon Jul 14 2025 00:00:00 GMT+0" ng-reflect-selected="Mon Jul 14 2025 00:00:00 GMT+0" class="mat-calendar ng-tns-c2024481049-61 ng-trigger ng-trigger-fadeInCalendar">…</mat-calendar> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="cdk-overlay-backdrop mat-overlay-transparent-backdrop mat-datepicker-0-backdrop cdk-overlay-backdrop-showing"></div> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <mat-calendar id="mat-datepicker-0" ng-reflect-start-view="month" ng-reflect-start-at="Mon Jul 14 2025 00:00:00 GMT+0" ng-reflect-selected="Mon Jul 14 2025 00:00:00 GMT+0" class="mat-calendar ng-tns-c2024481049-61 ng-trigger ng-trigger-fadeInCalendar">…</mat-calendar> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    3 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <mat-calendar id="mat-datepicker-0" ng-reflect-start-view="month" ng-reflect-start-at="Mon Jul 14 2025 00:00:00 GMT+0" ng-reflect-selected="Mon Jul 14 2025 00:00:00 GMT+0" class="mat-calendar ng-tns-c2024481049-61 ng-trigger ng-trigger-fadeInCalendar">…</mat-calendar> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="cdk-overlay-backdrop mat-overlay-transparent-backdrop mat-datepicker-0-backdrop cdk-overlay-backdrop-showing"></div> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <mat-calendar id="mat-datepicker-0" ng-reflect-start-view="month" ng-reflect-start-at="Mon Jul 14 2025 00:00:00 GMT+0" ng-reflect-selected="Mon Jul 14 2025 00:00:00 GMT+0" class="mat-calendar ng-tns-c2024481049-61 ng-trigger ng-trigger-fadeInCalendar">…</mat-calendar> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <mat-calendar id="mat-datepicker-0" ng-reflect-start-view="month" ng-reflect-start-at="Mon Jul 14 2025 00:00:00 GMT+0" ng-reflect-selected="Mon Jul 14 2025 00:00:00 GMT+0" class="mat-calendar ng-tns-c2024481049-61 ng-trigger ng-trigger-fadeInCalendar">…</mat-calendar> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <mat-calendar id="mat-datepicker-0" ng-reflect-start-view="month" ng-reflect-start-at="Mon Jul 14 2025 00:00:00 GMT+0" ng-reflect-selected="Mon Jul 14 2025 00:00:00 GMT+0" class="mat-calendar ng-tns-c2024481049-61 ng-trigger ng-trigger-fadeInCalendar">…</mat-calendar> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <div class="cdk-overlay-backdrop mat-overlay-transparent-backdrop mat-datepicker-0-backdrop cdk-overlay-backdrop-showing"></div> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <mat-calendar id="mat-datepicker-0" ng-reflect-start-view="month" ng-reflect-start-at="Mon Jul 14 2025 00:00:00 GMT+0" ng-reflect-selected="Mon Jul 14 2025 00:00:00 GMT+0" class="mat-calendar ng-tns-c2024481049-61 ng-trigger ng-trigger-fadeInCalendar">…</mat-calendar> from <div class="cdk-overlay-container">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms

    at C:\DS_playwright-test\tests\Order_Creation.spec.ts:172:52
```

# Test source

```ts
   72 |     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
   73 |     await page.waitForTimeout(1500);
   74 |
   75 |     //Customer Order
   76 |     await page.locator('input[formcontrolname="customerNumber"]').fill("ODS-071025");
   77 |     await page.waitForTimeout(1500);
   78 |
   79 |     //Parcel Number
   80 |     await page.locator('input[formcontrolname="parcelNumber"]').fill("894574");
   81 |     await page.waitForTimeout(1500);
   82 |
   83 |     //Address Line1
   84 |     await page.locator('input[formcontrolname="line1"]').fill("2105 Westfall Avenue");
   85 |     await page.waitForTimeout(1500);
   86 |
   87 |     //ZipCode
   88 |     await page.locator('input[formcontrolname="zip"]').fill("99501");
   89 |     await page.waitForTimeout(1500);
   90 |
   91 |     //City
   92 |     await page.locator('input[formcontrolname="city"]').fill("Albuquerque");
   93 |     await page.waitForTimeout(1000);
   94 |
   95 |     //State
   96 |     await page.locator('[aria-haspopup="listbox"]').nth(5).click();
   97 |     //await page.waitForTimeout(1500);
   98 |     await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
   99 |     await page.waitForTimeout(1000);
  100 |
  101 |     //County
  102 |     await page.locator('[aria-haspopup="listbox"]').nth(6).click();
  103 |     await page.waitForTimeout(1000);
  104 |     await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
  105 |     await page.waitForTimeout(1000);
  106 |
  107 |     //First Name
  108 |     await page.locator('input[formcontrolname="firstName"]').nth(0).fill("Diana");
  109 |     
  110 |
  111 |     //Middle Name
  112 |     await page.locator('input[formcontrolname="middleName"]').nth(0).fill("R");
  113 |     
  114 |
  115 |     //Last Name
  116 |     await page.locator('input[formcontrolname="lastName"]').nth(0).fill("Byrge");
  117 |    
  118 |  
  119 |     //Loan Number
  120 |     await page.locator('input[id="LoanNumber"]').fill("589747");
  121 |     await page.waitForTimeout(1000);
  122 |
  123 |     //Consideration Number
  124 |     await page.locator('input[formcontrolname="considerationAmount"]').fill("8500.25");
  125 |     //await page.waitForTimeout(1000);
  126 |
  127 |     //Instrument Date
  128 |    //  await page.locator('[id="pastartdate"]').click();
  129 |    //   await page.locator('tr:nth-child(1) > td:nth-child(4)').click();
  130 | //   const now = new Date();
  131 | //   const month = String(now.getMonth() + 1).padStart(2, '0');
  132 | //   const day = String(now.getDate()).padStart(2, '0');
  133 | //   const year = now.getFullYear();
  134 | //   const formattedDate = `${month}/${day}/${year}`; 
  135 | //  //console.log('Filling date:', formattedDate);
  136 | //  await page.fill('#mat-input-16', formattedDate); 
  137 | //  //await page.keyboard.press('Tab');
  138 | //  // Wait for the calendar overlay to disappear
  139 | //  //await page.waitForSelector('div[class="mat-datepicker-content-container ng-tns-c2024481049-1236"]', { state: 'detached' });
  140 | //  await page.waitForTimeout(1000);
  141 |
  142 | const now = new Date();
  143 | const month = String(now.getMonth() + 1).padStart(2, '0');
  144 | const day = String(now.getDate()).padStart(2, '0');
  145 | const year = now.getFullYear();
  146 | const formattedDate = `${month}/${day}/${year}`;
  147 |
  148 | // Scope the locator inside your known container
  149 | const container = page.locator('#LoanInformation > mat-card-content > div > div > div:nth-child(3)');
  150 | const dateInput = container.locator('input[formcontrolname="instrumentDate"]'); // Adjust if formcontrolname differs
  151 |
  152 | await dateInput.fill(formattedDate);
  153 |
  154 | // Optionally press Enter or blur to try closing the calendar
  155 | await dateInput.press('Enter');
  156 |
  157 |
  158 |
  159 |
  160 |
  161 |  //Special Instruction
  162 |  await page.locator('textarea[formcontrolname="specialInstructions"]').fill("All documents needed");
  163 |  await page.waitForTimeout(1000);
  164 |
  165 |  //attachments
  166 | const filePath = 'C:/DS_playwright-test/Documents/CIC Visily Screens.pdf';
  167 | await page.setInputFiles('input[type="file"]', filePath);
  168 | await page.waitForTimeout(1000);
  169 |
  170 |
  171 | // Create
> 172 | await page.locator('button[type="submit"]').nth(1).click();
      |                                                    ^ Error: locator.click: Target page, context or browser has been closed
  173 | await page.waitForTimeout(1000);
  174 |
  175 | // Fetch the toast message text
  176 | const toastMessage = await page.locator("div[class='toast-container success-toast']").innerText();
  177 | console.log("Toast Message: ", toastMessage); 
  178 |
  179 |
  180 | });
  181 |
  182 |
  183 |
  184 |  
  185 |
  186 |
```