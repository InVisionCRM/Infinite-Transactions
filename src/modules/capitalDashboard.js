/**
 * @fileoverview Capital dashboard UI module for displaying real vs derived capital
 */

import { state } from './state.js';
import { getCapitalBreakdown, calculateCascadeImpact, setCapitalCalculationMode, capitalCalculationMode } from './capitalTracking.js';
import { formatCurrency } from '../utils/formatters.js';

/**
 * Get the Decimal instance
 * @returns {typeof Decimal} The Decimal constructor
 */
function getDecimal() {
    if (!window.Decimal) {
        throw new Error('Decimal.js not loaded');
    }
    return window.Decimal;
}

/**
 * Initialize capital dashboard
 */
export function initializeCapitalDashboard() {
    console.log('Initializing capital dashboard...');

    // Set up calculation mode toggle
    const marketModeBtn = document.getElementById('marketModeBtn');
    const backingModeBtn = document.getElementById('backingModeBtn');
    const modeDescription = document.getElementById('modeDescription');

    if (marketModeBtn && backingModeBtn) {
        marketModeBtn.addEventListener('click', () => {
            setCapitalCalculationMode('market');
            marketModeBtn.classList.add('active');
            backingModeBtn.classList.remove('active');
            if (modeDescription) {
                modeDescription.textContent = 'Uses full market price of paired tokens. This is how DEXs inflate TVL numbers.';
                modeDescription.style.color = '#e74c3c';
            }
            updateCapitalDashboard();
            // Update all token displays
            state.tokens.forEach(token => {
                token.updateLiquidityDisplay();
            });
        });

        backingModeBtn.addEventListener('click', () => {
            setCapitalCalculationMode('backing');
            backingModeBtn.classList.add('active');
            marketModeBtn.classList.remove('active');
            if (modeDescription) {
                modeDescription.textContent = 'Calculates proportional real capital based on supply used. Shows true backing.';
                modeDescription.style.color = '#27ae60';
            }
            updateCapitalDashboard();
            // Update all token displays
            state.tokens.forEach(token => {
                token.updateLiquidityDisplay();
            });
        });
    }

    // Set up stress test slider
    const stressSlider = document.getElementById('stressSlider');
    const stressValue = document.getElementById('stressValue');
    const stressResults = document.getElementById('stressResults');

    if (stressSlider && stressValue && stressResults) {
        stressSlider.addEventListener('input', (e) => {
            const percentChange = parseInt(e.target.value);
            stressValue.textContent = `${percentChange > 0 ? '+' : ''}${percentChange}%`;
            updateStressTest(percentChange);
        });
    }

    // Initial update
    updateCapitalDashboard();
}

/**
 * Update capital dashboard with current values
 */
export function updateCapitalDashboard() {
    const breakdown = getCapitalBreakdown();

    // Update real capital
    const realCapitalEl = document.getElementById('realCapitalValue');
    if (realCapitalEl) {
        realCapitalEl.textContent = formatCurrency(breakdown.realCapital, '$', 0);
    }

    // Update derived capital
    const derivedCapitalEl = document.getElementById('derivedCapitalValue');
    if (derivedCapitalEl) {
        derivedCapitalEl.textContent = formatCurrency(breakdown.derivedCapital, '$', 0);
    }

    // Update total
    const totalCapitalEl = document.getElementById('totalCapitalValue');
    if (totalCapitalEl) {
        totalCapitalEl.textContent = formatCurrency(breakdown.totalDisplayedValue, '$', 0);
    }

    // Update leverage ratio
    const leverageEl = document.getElementById('leverageRatioValue');
    if (leverageEl) {
        const ratio = breakdown.leverageRatio.toNumber();
        leverageEl.textContent = `${ratio.toFixed(2)}x`;

        // Color code based on risk
        if (ratio < 1) {
            leverageEl.style.color = '#2ecc71'; // Green - low risk
        } else if (ratio < 3) {
            leverageEl.style.color = '#f39c12'; // Orange - medium risk
        } else if (ratio < 5) {
            leverageEl.style.color = '#e67e22'; // Dark orange - high risk
        } else {
            leverageEl.style.color = '#e74c3c'; // Red - extreme risk
        }
    }
}

/**
 * Update stress test results
 * @param {number} percentChange - Percentage change in WPLS price
 */
function updateStressTest(percentChange) {
    if (state.tokens.length === 0) {
        const stressResults = document.getElementById('stressResults');
        if (stressResults) {
            stressResults.innerHTML = '<p style="color: #666;">Add tokens to see stress test results...</p>';
        }
        return;
    }

    const impact = calculateCascadeImpact(percentChange);
    const stressResults = document.getElementById('stressResults');

    if (!stressResults) return;

    let html = '<div>';

    // Summary
    html += `<div style="margin-bottom: 1rem; padding: 0.75rem; background: ${percentChange >= 0 ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">`;
    html += `<strong>New WPLS Price:</strong> $${impact.newPlsPrice.toFixed(8)}<br>`;
    html += `<strong>Average Impact:</strong> ${impact.averageImpact.toFixed(2)}%`;
    html += `</div>`;

    // Most vulnerable
    if (impact.mostVulnerable) {
        const vuln = impact.mostVulnerable;
        const vulnToken = state.tokens.find(t => t.id === vuln.tokenId);
        const vulnTokenName = vulnToken ? vulnToken.name : `Token ${vuln.tokenId}`;
        html += `<div class="stress-impact-item vulnerable">`;
        html += `<strong>⚠️ Most Vulnerable: ${vulnTokenName}</strong><br>`;
        html += `Depth: ${vuln.depth} hops | `;
        html += `Impact: ${vuln.changePercent > 0 ? '+' : ''}${vuln.changePercent.toFixed(2)}%<br>`;
        html += `Value: $${vuln.originalValue.toFixed(2)} → $${vuln.newValue.toFixed(2)}`;
        html += `</div>`;
    }

    // Token impacts
    html += `<div style="margin-top: 1rem;"><strong>Token Impact Breakdown:</strong></div>`;
    impact.impacts.slice(0, 5).forEach(token => {
        const impactPercent = token.changePercent;
        const color = Math.abs(impactPercent) > 50 ? '#e74c3c' : Math.abs(impactPercent) > 20 ? '#e67e22' : '#95a5a6';
        const impactToken = state.tokens.find(t => t.id === token.tokenId);
        const impactTokenName = impactToken ? impactToken.name : `Token ${token.tokenId}`;

        html += `<div class="stress-impact-item" style="border-left-color: ${color};">`;
        html += `<strong>${impactTokenName}</strong> (${token.depth} hops)<br>`;
        html += `Impact: <span style="color: ${color}; font-weight: 600;">${impactPercent > 0 ? '+' : ''}${impactPercent.toFixed(2)}%</span><br>`;
        html += `$${token.originalValue.toFixed(2)} → $${token.newValue.toFixed(2)}`;
        html += `</div>`;
    });

    html += '</div>';
    stressResults.innerHTML = html;
}

/**
 * Get color based on leverage ratio
 * @param {number} ratio - Leverage ratio
 * @returns {string} CSS color
 */
function getLeverageColor(ratio) {
    if (ratio < 1) return '#2ecc71';
    if (ratio < 3) return '#f39c12';
    if (ratio < 5) return '#e67e22';
    return '#e74c3c';
}
