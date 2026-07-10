import { useState, useCallback } from 'react';
import { saveConfig } from '../api/client';

function validate(json) {
  if (!json || typeof json !== 'object') return 'Config must be a JSON object.';
  if (!Array.isArray(json.steps) || json.steps.length === 0) return 'Config needs a non-empty "steps" array.';
  for (const step of json.steps) {
    if (!step.step_id) return 'Every step needs a "step_id".';
    if (!step.question) return `Step "${step.step_id}" needs a "question".`;
    if (step.type !== 'text' && !Array.isArray(step.choices)) {
      return `Step "${step.step_id}" needs "choices" (or set "type": "text").`;
    }
  }
  return null;
}

export function useConfig() {
  const [config, setConfig] = useState(null);
  const [configName, setConfigName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadFromFile = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const validationError = validate(json);
      if (validationError) {
        setError(validationError);
        setConfig(null);
        return;
      }
      const name = file.name.replace(/\.json$/i, '');
      await saveConfig(name, json);
      setConfig(json);
      setConfigName(name);
    } catch (e) {
      setError(e.message?.includes('JSON') ? 'That file is not valid JSON.' : e.message);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setConfig(null);
    setConfigName('');
    setError(null);
  }, []);

  return { config, configName, error, loading, loadFromFile, clear };
}
