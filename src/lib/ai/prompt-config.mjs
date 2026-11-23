import analysis from '../../config/prompts/analysis.json' with { type: 'json' };
import interviewer from '../../config/prompts/interviewer.json' with { type: 'json' };
import health from '../../config/prompts/health.json' with { type: 'json' };
import questionPlan from '../../config/prompts/question-plan.json' with { type: 'json' };
import report from '../../config/prompts/report.json' with { type: 'json' };

// Static JSON imports work in Next.js bundles and standalone Node scripts.
// Config edits take effect after restart (Node) or rebuild/redeploy (production
// Next.js). No user-controlled paths, remote config, interpolation or eval.
function checked(config, name, localized) {
  const lines = (value) => Array.isArray(value) && value.length > 0
    && value.every((line) => typeof line === 'string' && line.trim().length > 0);
  if (!config || typeof config.version !== 'string'
      || !/^[a-zA-Z0-9._-]{1,100}$/u.test(config.version) || !lines(config.system)
      || (localized && (!lines(config.languageRules?.vi) || !lines(config.languageRules?.en)))) {
    // Do not echo configuration content, which may contain private instructions.
    const error = new Error(`Invalid ${name} prompt configuration.`);
    error.code = 'INVALID_PROMPT_CONFIG';
    throw error;
  }
  Object.freeze(config.system);
  if (localized) {
    Object.freeze(config.languageRules.vi);
    Object.freeze(config.languageRules.en);
    Object.freeze(config.languageRules);
  }
  return Object.freeze(config);
}

function checkedPlan(config) {
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const types = ['technical', 'behavioral', 'hr'];
  const levels = ['easy', 'medium', 'hard'];
  if (typeof config?.version !== 'string' || !/^[a-zA-Z0-9._-]{1,100}$/u.test(config.version)
      || !types.every((type) => text(config.roundPolicies?.[type])
        && levels.every((level) => text(config.difficultyPolicies?.[type]?.[level])))) {
    const error = new Error('Invalid question-plan prompt configuration.');
    error.code = 'INVALID_PROMPT_CONFIG';
    throw error;
  }
  for (const type of types) Object.freeze(config.difficultyPolicies[type]);
  Object.freeze(config.difficultyPolicies);
  Object.freeze(config.roundPolicies);
  return Object.freeze(config);
}

export const ANALYSIS_PROMPT_CONFIG = checked(analysis, 'analysis', true);
export const INTERVIEWER_PROMPT_CONFIG = checked(interviewer, 'interviewer', true);
export const HEALTH_PROMPT_CONFIG = checked(health, 'health', false);
export const QUESTION_PLAN_PROMPT_CONFIG = checkedPlan(questionPlan);
export const REPORT_PROMPT_CONFIG = checked(report, 'report', true);

export function promptText(config, language) {
  const localized = config.languageRules ? config.languageRules[language] : [];
  if (!localized) {
    const error = new Error('Unsupported prompt language.');
    error.code = 'INVALID_PROMPT_CONFIG';
    throw error;
  }
  return [...config.system, ...localized].join('\n');
}
