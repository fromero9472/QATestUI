export default function FeatureForm({ feature, onChange }) {
  const handleChange = (field) => (e) => {
    onChange({ ...feature, [field]: e.target.value });
  };

  return (
    <section className="form-section">
      <h2>🏷️ Feature Settings</h2>

      <div className="form-group">
        <label htmlFor="featureName">Feature Name *</label>
        <input
          id="featureName"
          type="text"
          placeholder="e.g. User Authentication API"
          value={feature.featureName}
          onChange={handleChange('featureName')}
          className="input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="tags">Tags (optional)</label>
        <input
          id="tags"
          type="text"
          placeholder="e.g. @smoke @regression"
          value={feature.tags}
          onChange={handleChange('tags')}
          className="input"
        />
        <small>Separate tags with spaces. The @ prefix is added automatically.</small>
      </div>

      <div className="form-group">
        <label htmlFor="baseUrl">Base URL</label>
        <input
          id="baseUrl"
          type="text"
          placeholder="e.g. https://api.example.com"
          value={feature.baseUrl}
          onChange={handleChange('baseUrl')}
          className="input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="commonHeaders">Common Headers (JSON, optional)</label>
        <textarea
          id="commonHeaders"
          rows={3}
          placeholder={'e.g. {"Content-Type": "application/json", "Authorization": "Bearer <token>"}'}
          value={feature.commonHeaders}
          onChange={handleChange('commonHeaders')}
          className="textarea"
        />
      </div>
    </section>
  );
}
