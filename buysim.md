# Project Prompt: Recreate "Transactions on Cruise Control" Webpage

## **Objective**
Develop a responsive and interactive webpage titled **"Transactions on Cruise Control"** using HTML, CSS, and JavaScript. The webpage should feature dynamic components including a real-time transaction history spreadsheet, customizable controls for transaction parameters, and the ability to manage multiple tokens with adjustable settings. The layout should be clean and elegant without the need for draggable or resizable boxes.

## **Key Features and Requirements**

### 1. **Page Layout**
- **Header:**
  - Display the title **"Transactions on Cruise Control"** prominently at the top of the page.
  
- **Settings Toggle Button:**
  - Positioned at the top-right corner.
  - When clicked, it toggles the visibility of the settings panel.
  
- **Main Wrapper:**
  - A container that houses both the left and right sections of the page.
  
  - **Left-Side Container:**
    - Contains multiple token boxes.
  
  - **Right-Side Container:**
    - Contains a real-time transaction history spreadsheet.
    - Should be scrollable and maintain a consistent size.

### 2. **Token Management**
- **Token Boxes:**
  - Each token box represents a distinct token (e.g., Token A, Token B).
  - Displays relevant information such as:
    - **Amount Processed:** The total amount processed for the token.
    - **Total PLS in Contract:** The PLS balance related to the token.
    - **PLS Price:** The current price of PLS in USD.
  
- **Dynamic Addition of Tokens:**
  - Users can add up to **20 tokens**.
  - When a new token is added:
    - A new token box is created with the same size and styling as existing tokens.
    - Positioned adjacent to the most recently added token to maintain a clean layout.
  
  - **Each Token Box Includes:**
    - **Adjustable Settings:**
      - **Percentage to Opposite Token (%):** Determines the portion of each buy transaction allocated to purchasing the opposite token.
      - **Percentage to PLS for Gas (%):** Determines the portion of each buy transaction allocated to buying PLS for gas fees.
      - **Choose Opposite Token:** Dropdown to select which token to buy with the allocated percentage.
      - **Gas Cost Range:** Inputs to set the minimum and maximum gas costs.

### 3. **Settings Panel**
- **Accessibility:**
  - Hidden by default and toggled via the **Settings** button.
  - Positioned fixedly to avoid overlapping with other content.
  
- **Contents:**
  - **Global Font Size Adjustment:**
    - A range slider (`<input type="range">`) allowing users to adjust the base font size (e.g., from 12px to 96px).
    - Display the current font size value dynamically.
  
  - **Global Percentage Inputs:**
    - **Default Percentage to Opposite Token (%):** Sets the default percentage for new tokens.
    - **Default Percentage to PLS for Gas (%):** Sets the default percentage for new tokens.
  
  - **Gas Cost Settings:**
    - **Minimum Gas Cost:** Input to set the minimum gas cost in PLS.
    - **Maximum Gas Cost:** Input to set the maximum gas cost in PLS.

### 4. **Transaction History Spreadsheet**
- **Structure:**
  - A table with the following columns:
    - **Transaction #**
    - **Wallet ID**
    - **Amount Bought ($)**
    - **Gas Used ($)**
    - **PLS Remaining**
  - Ordered from **most recent to oldest transactions**.
  
- **Features:**
  - **Dynamic Updates:**
    - New transactions are logged and displayed at the top of the table in real-time.
  
  - **Styling:**
    - Clean and readable design with alternating row colors for better readability.

### 5. **Controls Box (Buy/Add PLS)**
- **Components:**
  - **Buy Section:**
    - Input field to enter the buy amount in dollars.
    - **Buy Button:** Initiates the transaction process.
  
  - **Counters:**
    - **Transactions Executed:** Displays the total number of transactions.
    - **Total Amount Processed:** Displays the cumulative amount processed.
  
  - **Add Funds Section:**
    - Input field to add PLS to the contract.
    - **Add Funds Button:** Adds the specified amount of PLS to the contract balance.
  
- **Functionality:**
  - **Buy Transactions:**
    - Validate user input to ensure it's a positive number.
    - Assign a unique Wallet ID for each transaction.
    - Execute transactions with dynamic gas calculations, including occasional gas spikes and leftover gas pools.
    - Deduct the appropriate amounts from the contract's PLS balance.
    - Update counters and processed amounts accordingly.
  
  - **Add Funds:**
    - Validate user input.
    - Add the specified PLS amount to the contract's balance.
    - Provide user feedback upon successful addition.

### 6. **Dynamic Features**
- **PLS Price Update:**
  - Initialize the PLS price at `$0.000046`.
  - Update the price every second by randomly increasing or decreasing it within the bounds of `$0.000046` to `$0.0001`.
  - Ensure the price does not exceed these bounds.
  
- **Timer:**
  - Display the elapsed time in seconds since the page loaded.
  - Show the average number of transactions per minute.
  - Update both metrics every second.
  
- **Glow Effect:**
  - Implement a glow effect (`.flash-glow` class) that triggers on a randomly selected token box when a transaction is executed.
  - The glow should last for a brief period (e.g., 100ms) to indicate activity.

### 7. **Token Addition and Management**
- **Adding a New Token:**
  - Provide a button or interface to add new tokens.
  - Upon adding:
    - Validate that the total number of tokens does not exceed 20.
    - Create a new token box with identical styling and functionality.
    - Position the new token box adjacent to the most recently added token to maintain a clean and organized layout.
  - If the limit is reached, disable the addition of new tokens and notify the user.

### 8. **Responsive and Clean Design**
- **Layout:**
  - Utilize CSS Flexbox or Grid for an organized and responsive layout.
  - Ensure that the interface adapts gracefully to various screen sizes, including desktops, tablets, and mobile devices.
  
- **Styling:**
  - Maintain a consistent color scheme and typography for a professional appearance.
  - Use whitespace effectively to prevent clutter and enhance readability.
  
- **Accessibility:**
  - Ensure that all interactive elements are accessible via keyboard navigation.
  - Add appropriate `aria` labels and roles to improve accessibility for screen readers.

### 9. **Dynamic Font Scaling**
- **Implementation:**
  - The font size within each token box should adjust to 15% of the box's smaller dimension (width or height).
  - Utilize the `ResizeObserver` API to monitor size changes and adjust font sizes in real-time.
  - Ensure that the font size remains within reasonable limits to maintain readability.

### 10. **Technical Specifications**
- **Technologies to Use:**
  - **HTML5** for structuring the webpage.
  - **CSS3** for styling, layout, and responsive design.
  - **Vanilla JavaScript** for interactivity, dynamic updates, and functionality.
  - **Decimal.js** library for high-precision calculations in JavaScript. (Include via CDN: `https://cdnjs.cloudflare.com/ajax/libs/decimal.js/10.3.1/decimal.min.js`)
  
- **Code Structure:**
  - **HTML:**
    - Semantic and well-structured markup.
    - Clearly defined sections for headers, settings panel, main content, and transaction table.
  
  - **CSS:**
    - Organized and commented stylesheets.
    - Use of classes and IDs for targeting specific elements.
    - Responsive design using media queries.
  
  - **JavaScript:**
    - Modular and well-commented code.
    - Efficient event handling for adding tokens, adjusting settings, and dynamic updates.
    - Validation and error handling for user inputs.
    - Use of `ResizeObserver` for monitoring element size changes.
    - Implementation of dynamic features like PLS price updates and timers.

### **Specific Instructions to Implement All Features**

#### 1. **Real-Time Transaction History Spreadsheet**
- Create a table with the specified columns.
- Implement functionality to log new transactions at the top of the table.
- Ensure that the table updates in real-time as transactions occur.
- Style the table for readability with alternating row colors or other visual enhancements.

#### 2. **Controls for Adjustable Percentages and Gas Costs**
- In the settings panel, provide inputs to adjust:
  - **Percentage to Opposite Token (%):**
    - Sets the default percentage for all tokens.
    - Users can override this setting per token.
  
  - **Percentage to PLS for Gas (%):**
    - Sets the default percentage for all tokens.
    - Users can override this setting per token.
  
  - **Gas Cost Range:**
    - Inputs to set the minimum and maximum gas costs in PLS.
  
- In each token box, allow users to:
  - Override the default percentages.
  - Choose which opposite token to purchase.
  - Set individual gas cost ranges if needed.

#### 3. **Adding and Managing Additional Tokens**
- Implement a button or interface element to add new tokens.
- Upon adding a new token:
  - Validate that the total number of tokens does not exceed 20.
  - Create a new token box with identical styling and functionality.
  - Position the new token box adjacent to the most recently added token to maintain a clean and organized layout.
  
- Provide options within each token box to adjust its specific settings.

#### 4. **Ensuring a Clean and Elegant Layout**
- Use CSS Flexbox or Grid to arrange token boxes neatly.
- Maintain consistent sizing and spacing between elements.
- Ensure that the interface remains uncluttered, even with multiple tokens.
- Utilize responsive design principles to adapt the layout for various screen sizes.

#### 5. **Dynamic Font Scaling Based on Box Size**
- Implement the `ResizeObserver` API to monitor size changes of each token box.
- Calculate the font size as 15% of the box's smaller dimension (width or height).
- Apply the calculated font size to the text within the box in real-time.
- Ensure that the font size does not become too small or too large by setting reasonable limits.

#### 6. **PLS Price and Timer Implementations**
- **PLS Price:**
  - Initialize at `$0.000046`.
  - Update every second by randomly increasing or decreasing within `$0.000046` to `$0.0001`.
  - Ensure the price remains within the specified bounds.
  
- **Timer:**
  - Display elapsed time since page load in seconds.
  - Display average transactions per minute.
  - Update both metrics every second.

#### 7. **Glow Effect on Transaction Execution**
- Implement a glow effect (`.flash-glow` class) that triggers on a randomly selected token box upon transaction execution.
- The glow should be brief (e.g., 100ms) to indicate activity.

#### 8. **Validation and Error Handling**
- Ensure all user inputs are validated (e.g., positive numbers, percentages summing to 100%).
- Provide user feedback through alerts or inline messages when validations fail.

#### 9. **Accessibility Enhancements**
- Ensure all interactive elements are accessible via keyboard navigation.
- Add `aria` labels and roles where necessary for screen reader compatibility.

### **Technical Specifications**

- **Technologies to Use:**
  - **HTML5** for structuring the webpage.
  - **CSS3** for styling, layout, and responsive design.
  - **Vanilla JavaScript** for interactivity, dynamic updates, and functionality.
  - **Decimal.js** library for high-precision calculations in JavaScript. (Include via CDN: `https://cdnjs.cloudflare.com/ajax/libs/decimal.js/10.3.1/decimal.min.js`)
  
- **Code Structure:**
  - **HTML:**
    - Semantic and well-structured markup.
    - Clearly defined sections for headers, settings panel, main content, and transaction table.
  
  - **CSS:**
    - Organized and commented stylesheets.
    - Use of classes and IDs for targeting specific elements.
    - Responsive design using media queries.
  
  - **JavaScript:**
    - Modular and well-commented code.
    - Efficient event handling for adding tokens, adjusting settings, and dynamic updates.
    - Validation and error handling for user inputs.
    - Use of `ResizeObserver` for monitoring element size changes.
    - Implementation of dynamic features like PLS price updates and timers.

### **Final Deliverables**
- A fully functional and responsive webpage titled **"Transactions on Cruise Control"** with all the specified features.
- Clean, organized, and well-commented HTML, CSS, and JavaScript code.
- Usage of the Decimal.js library for precise numerical calculations.

### **Testing and Validation**

- **Functionality Tests:**
  - Verify that all token boxes display correct information and update in real-time.
  - Ensure that adding new tokens works correctly up to the 20-token limit.
  - Confirm that the settings panel adjusts global settings and that individual token settings can override global defaults.
  - Check that the transaction history spreadsheet logs transactions in real-time, ordered from most recent to oldest.
  - Validate that the PLS price updates within the specified range every second.
  - Ensure that the timer and average transactions per minute metrics update accurately.
  - Test the glow effect triggers correctly upon transaction execution.

- **Responsive Design Tests:**
  - Test the webpage on various screen sizes (desktop, tablet, mobile) to ensure consistent behavior and layout.

- **Browser Compatibility Tests:**
  - Verify functionality across modern browsers (Chrome, Firefox, Edge, Safari).

- **Accessibility Tests:**
  - Ensure that all interactive elements are accessible via keyboard navigation.
  - Check for appropriate `aria` labels and roles for screen readers.

### **Additional Recommendations**

1. **Performance Optimization:**
   - Optimize JavaScript for efficient DOM manipulation and event handling.
   - Minimize reflows and repaints by batching DOM updates where possible.

2. **Persistent State (Optional Enhancement):**
   - Implement local storage to remember user settings and token configurations across sessions.

3. **User Experience Enhancements:**
   - Provide visual feedback (e.g., loading indicators) during transactions.
   - Implement confirmation dialogs for critical actions like adding funds or tokens.

4. **Security Considerations:**
   - Ensure that user inputs are sanitized to prevent potential security vulnerabilities.

### **Final Notes**
This prompt is designed to provide clear and comprehensive instructions to a coding GPT agent, ensuring that all aspects of your "Transactions on Cruise Control" project are accurately implemented. By following these guidelines, the resulting webpage will feature a dynamic, user-friendly interface with robust functionality tailored to your specifications.

---
