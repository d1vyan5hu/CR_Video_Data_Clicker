import { useState, useEffect, useCallback, useMemo } from 'react';
import { evaluateCondition, activeSteps } from '../utils/conditions';

function findNextValidIndex(steps, fromIndex, answers) {
  for (let i = fromIndex; i < steps.length; i++) {
    if (evaluateCondition(steps[i].condition, answers)) return i;
  }
  return -1;
}

export default function AnnotationModal({ config, annotation, onUpdateFields, onFinish, onCancel }) {
  const steps = config.steps;
  const [answers, setAnswers] = useState(annotation.fields || {});
  const [pathIndices, setPathIndices] = useState(() => {
    const first = findNextValidIndex(steps, 0, annotation.fields || {});
    return first === -1 ? [] : [first];
  });
  const [textValue, setTextValue] = useState('');

  const currentIndex = pathIndices[pathIndices.length - 1];
  const currentStep = currentIndex != null ? steps[currentIndex] : null;
  const totalSteps = useMemo(() => activeSteps(steps, answers).length, [steps, answers]);
  const stepNumber = pathIndices.length;

  useEffect(() => {
    setTextValue('');
  }, [currentIndex]);

  const advance = useCallback(
    (value) => {
      const nextAnswers = { ...answers, [currentStep.step_id]: value };
      setAnswers(nextAnswers);
      onUpdateFields(nextAnswers);

      const nextIndex = findNextValidIndex(steps, currentIndex + 1, nextAnswers);
      if (nextIndex === -1) {
        onFinish();
      } else {
        setPathIndices((p) => [...p, nextIndex]);
      }
    },
    [answers, currentStep, currentIndex, steps, onUpdateFields, onFinish]
  );

  const goBack = useCallback(() => {
    if (pathIndices.length <= 1) {
      onCancel();
      return;
    }
    setPathIndices((p) => p.slice(0, -1));
  }, [pathIndices, onCancel]);

  const submitText = useCallback(() => {
    if (!textValue.trim()) return;
    advance(textValue.trim());
  }, [textValue, advance]);

  useEffect(() => {
    const handler = (e) => {
      if (!currentStep) return;
      const isTypingWithContent = currentStep.type === 'text' && textValue.length > 0;

      if (currentStep.type !== 'text') {
        if (e.key >= '1' && e.key <= '9') {
          const idx = Number(e.key) - 1;
          if (currentStep.choices[idx]) advance(currentStep.choices[idx].value);
          return;
        }
        if (e.key === '0' && currentStep.choices[9]) {
          advance(currentStep.choices[9].value);
          return;
        }
      }
      if (e.key === 'Backspace' && !isTypingWithContent) {
        e.preventDefault();
        goBack();
      }
      if (e.key === 'Enter' && currentStep.type === 'text') {
        submitText();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStep, textValue, advance, goBack, submitText]);

  if (!currentStep) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card glass">
        <div className="modal-progress">
          <div className="modal-progress-fill" style={{ width: `${Math.min(100, (stepNumber / Math.max(totalSteps, 1)) * 100)}%` }} />
        </div>
        <div className="modal-step-label">
          Step {stepNumber} of {totalSteps}
        </div>
        <h3 className="modal-question">{currentStep.question}</h3>

        {currentStep.type === 'text' ? (
          <>
            <input
              className="field-input"
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Type your answer…"
            />
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={goBack}>
                {pathIndices.length <= 1 ? '✕ Cancel' : '← Back'}
              </button>
              <button className="btn btn-primary btn-sm" disabled={!textValue.trim()} onClick={submitText}>
                Submit
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="choice-grid">
              {currentStep.choices.map((choice, i) => (
                <button key={choice.value} className="choice-btn" onClick={() => advance(choice.value)}>
                  <span className="choice-key">{i === 9 ? 0 : i + 1}.</span>
                  {choice.label}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-sm" onClick={goBack}>
                {pathIndices.length <= 1 ? '✕ Cancel' : '← Back'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
