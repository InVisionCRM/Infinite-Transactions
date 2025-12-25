# Infinite Transactions

A trading system simulation with automated sequential buys and token management.

## Project Structure

The project is organized into modules and utilities, each with a specific responsibility:

### Core Modules (`src/modules/`)

#### `state.js`
- Global state management
- State initialization and updates
- Transaction counters and metrics
- Wallet and token tracking
- Gas calculations
- Time interval management

#### `token.js`
- Token class implementation
- Token creation and management
- Liquidity calculations
- Price calculations
- Token balance management
- Token display updates

#### `ui.js`
- DOM element management
- UI updates and rendering
- Event binding for UI elements
- Transaction history display
- Metrics display updates
- Token display management

#### `transactions.js`
- Transaction processing logic
- Buy transaction handling
- PLS distribution
- Gas calculations and deductions
- Transaction chaining
- Error handling

#### `metrics.js`
- Performance metrics calculations
- Transaction rate tracking
- Gas efficiency calculations
- Token-specific metrics
- Real-time statistics updates
- Performance monitoring

#### `settings.js`
- Settings panel management
- Configuration validation
- Settings persistence
- Time interval management
- Gas price configuration
- Font size management

### Utilities (`src/utils/`)

#### `formatters.js`
- Number formatting utilities
- Currency formatting
- Time duration formatting
- Address formatting
- Gas price formatting
- Scientific notation handling

#### `validators.js`
- Input validation
- Range validation
- Percentage validation
- Gas input validation
- Time interval validation
- Token supply validation

### Entry Point

#### `main.js`
- Application initialization
- Module coordination
- Event handler binding
- Error handling
- Global state initialization

## Adding New Features

When adding new features, consider the following locations:

1. For new token functionality:
   - Add to `token.js`
   - Update state management in `state.js`
   - Add UI elements in `ui.js`

2. For new transaction types:
   - Add to `transactions.js`
   - Update metrics in `metrics.js`
   - Add validation in `validators.js`

3. For new settings:
   - Add to `settings.js`
   - Update state in `state.js`
   - Add UI elements in `ui.js`

4. For new display features:
   - Add formatting in `formatters.js`
   - Update UI in `ui.js`
   - Add metrics in `metrics.js`

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open in browser:
   ```
   http://localhost:3000
   ```

## Development

- Use ES modules for all imports/exports
- Maintain type safety with JSDoc comments
- Follow the existing module structure
- Add validation for new inputs
- Update documentation when adding features 