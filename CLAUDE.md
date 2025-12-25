# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Infinite Transactions" (also known as "Transactions on Cruise Control") is a browser-based trading system simulation that models automated sequential token purchases and liquidity management. The application uses Decimal.js for precise financial calculations and implements a modular architecture with ES6 modules.

## Development Commands

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
This runs the `prepare` script (copies Decimal.js to public/lib/) and starts the server on port 3000.

### Start Production Server
```bash
npm start
```
Runs prepare script and starts the server on default port.

### Access Application
After starting the dev server:
```
http://localhost:3000
```

## Architecture Overview

### Module System
The application uses **ES6 modules** with strict import/export patterns. All modules are loaded as `type="module"` and must use `.js` extensions in imports.

### Core Dependencies
- **Decimal.js**: Critical for all financial calculations. The library is loaded globally via a `<script>` tag in `index.html` before any application modules, configured with `{ precision: 20, rounding: 4 }`.
- **serve**: Development server for local hosting.

### State Management Pattern
The application uses a centralized state object (`state.js`) that is:
1. Initialized when modules are loaded
2. Exposed to the global window object (`window.state`)
3. Accessed by all other modules through import

**Critical**: All Decimal instances must be created using `window.Decimal` or retrieved via the `getDecimal()` helper function found in each module. Never assume Decimal is available - always check or use the helper.

### Module Structure

#### `src/modules/state.js`
The single source of truth for application state. Contains:
- Global state object with all application-wide data
- State mutation functions (increment counters, update totals, etc.)
- Gas calculation logic
- Wallet interval management
- PLS price management

**Important state properties:**
- `tokens[]`: Array of Token instances
- `isPaused`: Controls transaction flow
- `walletIntervals`: Map of wallet IDs to their random delay intervals
- `minGlobalGas` / `maxGlobalGas`: Gas cost boundaries
- `minTimeInterval` / `maxTimeInterval`: Transaction timing boundaries

#### `src/modules/token.js`
Implements the `Token` class. Each token instance:
- Manages its own PLS balance and liquidity
- Calculates token prices based on liquidity/supply ratio
- Creates and updates its own DOM element
- Handles token-specific settings (percentages, opposite token selection)
- Provides liquidity management methods

**Key methods:**
- `calculateTokenPrice()`: Returns price as liquidity/supply
- `addLiquidity(plsAmount)`: Converts PLS balance to liquidity
- `updateDisplay()`: Syncs DOM with token state

#### `src/modules/transactions.js`
Handles all transaction processing logic:
- Validates transaction parameters
- Calculates and deducts gas
- Updates token balances and processed amounts
- Chains transactions (triggers next buy based on percentages)
- Manages transaction history

**Transaction Flow:**
1. Validate inputs (amount, wallet ID, token ID)
2. Check if trading is paused
3. Calculate gas cost
4. Verify sufficient PLS balance for gas
5. Process buy (deduct gas, update amounts)
6. Add to transaction history
7. If `shouldContinueChain()`, trigger next transaction asynchronously

#### `src/modules/ui.js`
DOM manipulation and rendering:
- Initializes page elements
- Binds UI event handlers
- Updates transaction history table
- Updates metrics display
- Manages token display updates
- Handles settings panel visibility

**Important**: Uses `elements` object to cache DOM references. All DOM queries happen once during initialization.

#### `src/modules/metrics.js`
Real-time statistics and performance tracking:
- Calculates transactions per minute
- Updates PLS price with random variation
- Tracks gas efficiency
- Updates time elapsed counter
- Manages periodic metric updates

#### `src/modules/settings.js`
Settings panel management:
- Validates setting inputs (ranges, percentages)
- Persists global defaults for new tokens
- Updates gas cost ranges
- Manages time interval settings
- Controls font size adjustments

#### `src/utils/formatters.js`
Number and display formatting utilities:
- Currency formatting (USD, PLS)
- Scientific notation handling
- Gas price formatting
- Address truncation
- Time duration formatting

#### `src/utils/validators.js`
Input validation functions:
- Positive number validation
- Percentage range validation (0-100)
- Wallet ID validation
- Token ID validation
- Gas amount validation

### Entry Point (`src/main.js`)
Application initialization sequence:
1. Wait for `DOMContentLoaded`
2. Verify Decimal.js is loaded and functional
3. Initialize global state
4. Initialize page UI
5. Bind event handlers
6. Set up global error handling

## Key Architectural Patterns

### Decimal.js Integration
All financial calculations use Decimal instances. The pattern throughout the codebase:

```javascript
function getDecimal() {
    if (!window.Decimal) {
        throw new Error('Decimal.js not loaded');
    }
    return window.Decimal;
}
```

Never perform arithmetic with native JavaScript numbers for financial values. Always use Decimal methods:
- `.plus()` not `+`
- `.minus()` not `-`
- `.times()` not `*`
- `.dividedBy()` not `/`

### Async Transaction Chaining
Transactions are processed with delays to simulate real-world timing. The system uses:
- `getRandomDelay(walletId)`: Returns consistent random delay per wallet
- `setTimeout()`: Schedules next transaction in chain
- Pause state checking before each transaction

### Glow Effect System
Visual feedback through CSS class toggling:
- `.flash-glow` class applied briefly (100ms) when token processes transaction
- Token's `triggerGlowEffect()` method manages timing

## Important Implementation Notes

### Adding New Features

**For new transaction types:**
1. Add validation in `validators.js`
2. Implement logic in `transactions.js`
3. Update metrics tracking in `metrics.js`
4. Add UI display updates in `ui.js`

**For new token functionality:**
1. Add methods to Token class in `token.js`
2. Update state management in `state.js` if needed
3. Add display updates in token's `updateDisplay()` method
4. Update `createTokenElement()` if new UI elements needed

**For new settings:**
1. Add input elements to settings panel in `index.html`
2. Add validation in `validators.js`
3. Implement setting logic in `settings.js`
4. Update state in `state.js`

### Common Gotchas

1. **Decimal.js Loading**: Always verify `window.Decimal` exists before creating instances
2. **Module Import Paths**: Must include `.js` extension (e.g., `'./state.js'`)
3. **State Updates**: Never mutate state directly - use the exported mutation functions
4. **Token Limit**: Hard limit of 20 tokens (`state.maxTokens`)
5. **Pause State**: Always check `state.isPaused` before processing transactions

### Transaction History Order
Transactions are displayed newest-first by prepending to table body, not appending.

### Gas Cost Calculation
Gas is calculated randomly between `minGlobalGas` and `maxGlobalGas` per transaction. Gas is deducted from the token's PLS balance before processing the transaction amount.

## Project Structure
```
/
├── index.html              # Main HTML entry point
├── styles.css              # Global styles
├── package.json            # Dependencies and scripts
├── buysim.md              # Original project specifications
├── src/
│   ├── main.js            # Application entry point
│   ├── modules/
│   │   ├── state.js       # Global state management
│   │   ├── token.js       # Token class implementation
│   │   ├── transactions.js # Transaction processing
│   │   ├── ui.js          # DOM manipulation
│   │   ├── metrics.js     # Statistics and metrics
│   │   └── settings.js    # Settings management
│   └── utils/
│       ├── formatters.js  # Display formatting
│       └── validators.js  # Input validation
└── public/
    └── lib/
        └── decimal.js     # Decimal.js library (copied by prepare script)
```

## Testing Approach

Since this is a browser-based simulation with no test suite:
1. Test in browser with dev server running
2. Check browser console for errors
3. Verify transaction history updates correctly
4. Confirm metrics update in real-time
5. Test with multiple tokens (up to 20)
6. Verify pause/resume functionality
7. Test settings panel updates propagate correctly
