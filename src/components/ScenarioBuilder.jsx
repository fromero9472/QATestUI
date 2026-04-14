import ScenarioCard from './ScenarioCard';

const newScenario = () => ({
  name: '',
  type: 'scenario',
  tags: '',
  method: 'GET',
  path: '',
  requestHeaders: '',
  requestBody: '',
  expectedStatus: '200',
  assertions: [],
  customSteps: [],
  exampleHeaders: '',
  examples: [],
});

export default function ScenarioBuilder({ scenarios, onChange }) {
  const addScenario = () => {
    onChange([...scenarios, newScenario()]);
  };

  const updateScenario = (index, updated) => {
    const next = scenarios.map((s, i) => (i === index ? updated : s));
    onChange(next);
  };

  const removeScenario = (index) => {
    onChange(scenarios.filter((_, i) => i !== index));
  };

  return (
    <section className="form-section">
      <div className="section-header">
        <h2>🎬 Scenarios (Acceptance Criteria)</h2>
        <button className="btn btn-primary" onClick={addScenario}>
          + Add Scenario
        </button>
      </div>

      {scenarios.length === 0 && (
        <div className="empty-state">
          <p>No scenarios yet. Click <strong>+ Add Scenario</strong> to get started.</p>
        </div>
      )}

      {scenarios.map((scenario, idx) => (
        <ScenarioCard
          key={idx}
          index={idx}
          scenario={scenario}
          onChange={updateScenario}
          onRemove={removeScenario}
        />
      ))}

      {scenarios.length > 0 && (
        <div className="add-scenario-footer">
          <button className="btn btn-primary" onClick={addScenario}>
            + Add Another Scenario
          </button>
        </div>
      )}
    </section>
  );
}
