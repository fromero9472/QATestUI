import { useCallback } from 'react';

export default function FeaturePreview({ content, featureName }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (featureName || 'feature').replace(/\s+/g, '_').toLowerCase();
    a.download = `${safeName}.feature`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, featureName]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
  }, [content]);

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h2>Preview — .feature</h2>
        <div className="preview-actions">
          <button className="btn btn-secondary" onClick={handleCopy} title="Copy to clipboard">
            📋 Copy
          </button>
          <button className="btn btn-primary" onClick={handleDownload} title="Download .feature file">
            ⬇️ Download
          </button>
        </div>
      </div>
      <pre className="feature-code">
        <code>{content}</code>
      </pre>
    </div>
  );
}
