/**
 * Generates a Karate .feature file from the provided form data.
 * @param {Object} featureData - The complete feature configuration
 * @returns {string} - The formatted Karate feature file content
 */
export function generateKarateFeature(featureData) {
  const { featureName, tags, baseUrl, commonHeaders, scenarios } = featureData;
  const lines = [];

  // Tags
  if (tags && tags.trim()) {
    const tagLine = tags
      .trim()
      .split(/\s+/)
      .map((t) => (t.startsWith('@') ? t : `@${t}`))
      .join(' ');
    lines.push(tagLine);
  }

  // Feature declaration
  lines.push(`Feature: ${featureName || 'Untitled Feature'}`);
  lines.push('');

  // Background
  const hasBackground = baseUrl || (commonHeaders && commonHeaders.trim());
  if (hasBackground) {
    lines.push('  Background:');
    if (baseUrl) {
      lines.push(`    * url '${baseUrl}'`);
    }
    if (commonHeaders && commonHeaders.trim()) {
      try {
        const parsed = JSON.parse(commonHeaders);
        lines.push(`    * headers ${JSON.stringify(parsed)}`);
      } catch {
        // Treat as raw expression
        lines.push(`    * headers ${commonHeaders.trim()}`);
      }
    }
    lines.push('');
  }

  // Scenarios
  (scenarios || []).forEach((scenario) => {
    if (scenario.type === 'outline') {
      lines.push(...buildScenarioOutline(scenario));
    } else {
      lines.push(...buildScenario(scenario));
    }
    lines.push('');
  });

  return lines.join('\n');
}

function buildScenario(scenario) {
  const lines = [];
  lines.push(`  Scenario: ${scenario.name || 'Untitled Scenario'}`);

  // Tags for scenario
  if (scenario.tags && scenario.tags.trim()) {
    const tagLine = scenario.tags
      .trim()
      .split(/\s+/)
      .map((t) => (t.startsWith('@') ? t : `@${t}`))
      .join(' ');
    lines.splice(lines.length - 1, 0, `  ${tagLine}`);
  }

  addSteps(lines, scenario);
  return lines;
}

function buildScenarioOutline(scenario) {
  const lines = [];

  if (scenario.tags && scenario.tags.trim()) {
    const tagLine = scenario.tags
      .trim()
      .split(/\s+/)
      .map((t) => (t.startsWith('@') ? t : `@${t}`))
      .join(' ');
    lines.push(`  ${tagLine}`);
  }

  lines.push(`  Scenario Outline: ${scenario.name || 'Untitled Scenario'}`);
  addSteps(lines, scenario);

  // Examples table
  if (scenario.examples && scenario.examples.length > 0) {
    lines.push('');
    lines.push('    Examples:');

    const headers = Object.keys(scenario.examples[0]);
    const headerRow = `      | ${headers.join(' | ')} |`;
    lines.push(headerRow);

    scenario.examples.forEach((row) => {
      const values = headers.map((h) => String(row[h] ?? ''));
      lines.push(`      | ${values.join(' | ')} |`);
    });
  }

  return lines;
}

function addSteps(lines, scenario) {
  const { path, method, requestHeaders, requestBody, expectedStatus, assertions, customSteps } =
    scenario;

  // Path
  if (path) {
    lines.push(`    Given path '${path}'`);
  }

  // Request headers
  if (requestHeaders && requestHeaders.trim()) {
    try {
      const parsed = JSON.parse(requestHeaders);
      lines.push(`    And headers ${JSON.stringify(parsed)}`);
    } catch {
      lines.push(`    And headers ${requestHeaders.trim()}`);
    }
  }

  // Request body (only for methods that typically have a body)
  const bodyMethods = ['POST', 'PUT', 'PATCH'];
  if (bodyMethods.includes((method || '').toUpperCase()) && requestBody && requestBody.trim()) {
    try {
      const parsed = JSON.parse(requestBody);
      lines.push(`    And request ${JSON.stringify(parsed)}`);
    } catch {
      lines.push(`    And request ${requestBody.trim()}`);
    }
  }

  // HTTP Method
  lines.push(`    When method ${(method || 'GET').toUpperCase()}`);

  // Expected status
  if (expectedStatus) {
    lines.push(`    Then status ${expectedStatus}`);
  }

  // Assertions
  (assertions || []).forEach((assertion, idx) => {
    if (assertion.trim()) {
      const prefix = idx === 0 && !expectedStatus ? 'Then' : 'And';
      lines.push(`    ${prefix} match ${assertion.trim()}`);
    }
  });

  // Custom steps (free-form)
  (customSteps || []).forEach((step) => {
    if (step.trim()) {
      lines.push(`    ${step.trim()}`);
    }
  });
}
