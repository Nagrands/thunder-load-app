const categoryScoreBudgets = {
  performance: { warning: 0.9, failure: 0.75 },
  accessibility: { failure: 0.95 },
  bestPractices: { failure: 0.95 },
  seo: { failure: 0.95 }
};

const lcpBudgetMs = { warning: 2500, failure: 4000 };
const clsBudget = { warning: 0.1, failure: 0.25 };

export function evaluateLighthouseBudgets({ url, scores, lcp, cls }) {
  const failures = [];
  const warnings = [];

  for (const [category, budget] of Object.entries(categoryScoreBudgets)) {
    const score = scores[category];
    if (score < budget.failure) {
      failures.push(`${url}: ${category} ${Math.round(score * 100)} < ${Math.round(budget.failure * 100)}`);
    } else if (budget.warning && score < budget.warning) {
      warnings.push(`${url}: ${category} ${Math.round(score * 100)} < ${Math.round(budget.warning * 100)}`);
    }
  }

  if (lcp > lcpBudgetMs.failure) {
    failures.push(`${url}: LCP ${Math.round(lcp)}ms > ${lcpBudgetMs.failure}ms`);
  } else if (lcp > lcpBudgetMs.warning) {
    warnings.push(`${url}: LCP ${Math.round(lcp)}ms > ${lcpBudgetMs.warning}ms`);
  }

  if (cls > clsBudget.failure) {
    failures.push(`${url}: CLS ${cls.toFixed(3)} > ${clsBudget.failure}`);
  } else if (cls > clsBudget.warning) {
    warnings.push(`${url}: CLS ${cls.toFixed(3)} > ${clsBudget.warning}`);
  }

  return { failures, warnings };
}
