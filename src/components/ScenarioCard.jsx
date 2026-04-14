import { useState } from 'react';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const DEFAULT_ASSERTION = 'response.field == expectedValue';

export default function ScenarioCard({ scenario, index, onChange, onRemove }) {
  const [collapsed, setCollapsed] = useState(false);

  const update = (field) => (e) => {
    onChange(index, { ...scenario, [field]: e.target.value });
  };

  const updateAssertions = (i, value) => {
    const assertions = [...(scenario.assertions || [])];
    assertions[i] = value;
    onChange(index, { ...scenario, assertions });
  };

  const addAssertion = () => {
    const assertions = [...(scenario.assertions || []), DEFAULT_ASSERTION];
    onChange(index, { ...scenario, assertions });
  };

  const removeAssertion = (i) => {
    const assertions = (scenario.assertions || []).filter((_, idx) => idx !== i);
    onChange(index, { ...scenario, assertions });
  };

  const updateCustomStep = (i, value) => {
    const customSteps = [...(scenario.customSteps || [])];
    customSteps[i] = value;
    onChange(index, { ...scenario, customSteps });
  };

  const addCustomStep = () => {
    const customSteps = [...(scenario.customSteps || []), '* print "custom step"'];
    onChange(index, { ...scenario, customSteps });
  };

  const removeCustomStep = (i) => {
    const customSteps = (scenario.customSteps || []).filter((_, idx) => idx !== i);
    onChange(index, { ...scenario, customSteps });
  };

  // Examples table (for Scenario Outline)
  const addExampleRow = () => {
    const headers = getExampleHeaders(scenario);
    const newRow = {};
    headers.forEach((h) => (newRow[h] = ''));
    const examples = [...(scenario.examples || []), newRow];
    onChange(index, { ...scenario, examples });
  };

  const removeExampleRow = (rowIdx) => {
    const examples = (scenario.examples || []).filter((_, i) => i !== rowIdx);
    onChange(index, { ...scenario, examples });
  };

  const updateExampleCell = (rowIdx, col, value) => {
    const examples = (scenario.examples || []).map((row, i) =>
      i === rowIdx ? { ...row, [col]: value } : row
    );
    onChange(index, { ...scenario, examples });
  };

  const updateExampleHeaders = (value) => {
    const newHeaders = value
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    const currentHeaders = getExampleHeaders(scenario);
    const examples = (scenario.examples || []).map((row) => {
      const newRow = {};
      newHeaders.forEach((h) => {
        newRow[h] = row[h] ?? (currentHeaders.includes(h) ? row[h] : '');
      });
      return newRow;
    });
    onChange(index, { ...scenario, exampleHeaders: value, examples });
  };

  const getExampleHeaders = (sc) => {
    if (sc.exampleHeaders) {
      return sc.exampleHeaders
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    }
    if (sc.examples && sc.examples.length > 0) {
      return Object.keys(sc.examples[0]);
    }
    return ['param', 'expectedStatus'];
  };

  const isOutline = scenario.type === 'outline';

  return (
    <div className={`scenario-card ${collapsed ? 'collapsed' : ''}`}>
      <div className="scenario-card-header">
        <button
          className="collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <span className="scenario-label">
          {isOutline ? '📊 Scenario Outline' : '📋 Scenario'} {index + 1}:{' '}
          <em>{scenario.name || 'Unnamed'}</em>
        </span>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onRemove(index)}
          title="Remove scenario"
        >
          ✕
        </button>
      </div>

      {!collapsed && (
        <div className="scenario-card-body">
          {/* Name & Type */}
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Scenario Name *</label>
              <input
                type="text"
                placeholder="e.g. Login with valid credentials"
                value={scenario.name}
                onChange={update('name')}
                className="input"
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={scenario.type}
                onChange={update('type')}
                className="select"
              >
                <option value="scenario">Scenario</option>
                <option value="outline">Scenario Outline</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Scenario Tags (optional)</label>
            <input
              type="text"
              placeholder="e.g. @happy-path @smoke"
              value={scenario.tags || ''}
              onChange={update('tags')}
              className="input"
            />
          </div>

          {/* HTTP Settings */}
          <fieldset className="fieldset">
            <legend>🌐 Request</legend>

            <div className="form-row">
              <div className="form-group">
                <label>HTTP Method</label>
                <select value={scenario.method} onChange={update('method')} className="select">
                  {HTTP_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group flex-2">
                <label>Endpoint Path</label>
                <input
                  type="text"
                  placeholder={isOutline ? "e.g. /users/<userId>" : "e.g. /users/1"}
                  value={scenario.path}
                  onChange={update('path')}
                  className="input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Request Headers (JSON, optional)</label>
              <textarea
                rows={2}
                placeholder='{"Authorization": "Bearer <token>"}'
                value={scenario.requestHeaders || ''}
                onChange={update('requestHeaders')}
                className="textarea"
              />
            </div>

            {['POST', 'PUT', 'PATCH'].includes(scenario.method) && (
              <div className="form-group">
                <label>Request Body (JSON)</label>
                <textarea
                  rows={4}
                  placeholder={
                    isOutline
                      ? '{"username": "<username>", "password": "<password>"}'
                      : '{"username": "admin", "password": "secret"}'
                  }
                  value={scenario.requestBody || ''}
                  onChange={update('requestBody')}
                  className="textarea"
                />
              </div>
            )}
          </fieldset>

          {/* Expected Response */}
          <fieldset className="fieldset">
            <legend>✅ Expected Response</legend>

            <div className="form-group">
              <label>Expected HTTP Status</label>
              <input
                type="number"
                placeholder="e.g. 200"
                value={scenario.expectedStatus}
                onChange={update('expectedStatus')}
                className="input input-sm"
                min={100}
                max={599}
              />
            </div>

            <div className="form-group">
              <label>Response Assertions (match expressions)</label>
              {(scenario.assertions || []).map((assertion, i) => (
                <div key={i} className="list-item">
                  <span className="step-keyword">match</span>
                  <input
                    type="text"
                    placeholder="response.token != null"
                    value={assertion}
                    onChange={(e) => updateAssertions(i, e.target.value)}
                    className="input"
                  />
                  <button
                    className="btn btn-danger btn-xs"
                    onClick={() => removeAssertion(i)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm mt-1" onClick={addAssertion}>
                + Add Assertion
              </button>
            </div>

            <div className="form-group">
              <label>Custom Steps (free-form Karate steps)</label>
              {(scenario.customSteps || []).map((step, i) => (
                <div key={i} className="list-item">
                  <input
                    type="text"
                    placeholder="* print response"
                    value={step}
                    onChange={(e) => updateCustomStep(i, e.target.value)}
                    className="input"
                  />
                  <button
                    className="btn btn-danger btn-xs"
                    onClick={() => removeCustomStep(i)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm mt-1" onClick={addCustomStep}>
                + Add Custom Step
              </button>
            </div>
          </fieldset>

          {/* Examples (Scenario Outline only) */}
          {isOutline && (
            <fieldset className="fieldset">
              <legend>📊 Test Data — Examples Table</legend>
              <div className="form-group">
                <label>Column Headers (comma-separated)</label>
                <input
                  type="text"
                  placeholder="username, password, expectedStatus"
                  value={scenario.exampleHeaders || ''}
                  onChange={(e) => updateExampleHeaders(e.target.value)}
                  className="input"
                />
                <small>
                  Use these names as placeholders in the scenario steps: &lt;username&gt;
                </small>
              </div>

              {getExampleHeaders(scenario).length > 0 && (
                <div className="examples-table-wrapper">
                  <table className="examples-table">
                    <thead>
                      <tr>
                        {getExampleHeaders(scenario).map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(scenario.examples || []).map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          {getExampleHeaders(scenario).map((h) => (
                            <td key={h}>
                              <input
                                type="text"
                                value={row[h] ?? ''}
                                onChange={(e) => updateExampleCell(rowIdx, h, e.target.value)}
                                className="input input-table"
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => removeExampleRow(rowIdx)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="btn btn-secondary btn-sm mt-1" onClick={addExampleRow}>
                    + Add Row
                  </button>
                </div>
              )}
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
