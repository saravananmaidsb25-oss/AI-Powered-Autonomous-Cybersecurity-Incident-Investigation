const STEPS = ['Monitor', 'Detect', 'Correlate', 'Investigate', 'Explain', 'Prioritize', 'Respond', 'Learn', 'Prevent'];

export function securityPipeline(activeIndex = 5) {
  return `<div class="pipeline" role="list">
    ${STEPS.map((step, i) => `
      <div class="pipeline__step ${i <= activeIndex ? 'pipeline__step--done' : ''} ${i === activeIndex ? 'pipeline__step--current' : ''}" role="listitem">
        <span class="pipeline__dot">${i + 1}</span>
        <span class="pipeline__label">${step}</span>
      </div>
      ${i < STEPS.length - 1 ? '<span class="pipeline__line"></span>' : ''}
    `).join('')}
  </div>`;
}
