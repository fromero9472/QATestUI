import { useState, useMemo } from 'react';
import FeatureForm from './components/FeatureForm';
import ScenarioBuilder from './components/ScenarioBuilder';
import FeaturePreview from './components/FeaturePreview';
import { generateKarateFeature } from './utils/karateGenerator';
import './App.css';

const INITIAL_FEATURE = {
  featureName: '',
  tags: '',
  baseUrl: '',
  commonHeaders: '',
};

const INITIAL_SCENARIOS = [];

export default function App() {
  const [feature, setFeature] = useState(INITIAL_FEATURE);
  const [scenarios, setScenarios] = useState(INITIAL_SCENARIOS);

  const featureContent = useMemo(() => {
    return generateKarateFeature({ ...feature, scenarios });
  }, [feature, scenarios]);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all fields?')) {
      setFeature(INITIAL_FEATURE);
      setScenarios(INITIAL_SCENARIOS);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🥋</span>
            <div>
              <h1>Karate Feature Generator</h1>
              <p>Ingresa los criterios de aceptación y datos de prueba para generar tu archivo .feature</p>
            </div>
          </div>
          <button className="btn btn-outline" onClick={handleReset}>
            🔄 Reset
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="left-panel">
          <FeatureForm feature={feature} onChange={setFeature} />
          <ScenarioBuilder scenarios={scenarios} onChange={setScenarios} />
        </div>

        <div className="right-panel">
          <FeaturePreview content={featureContent} featureName={feature.featureName} />
        </div>
      </main>

      <footer className="app-footer">
        <p>QA Test UI — Karate Feature Generator</p>
      </footer>
    </div>
  );
}
