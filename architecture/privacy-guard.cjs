/** AUREA staging-only privacy guard. No employee data or production integration. */
'use strict';
const MIN_RESPONDENTS = 5;
function canPublishAggregate({ respondentCount, teamSize, previousRespondentCount = null, previousCountPublic = false }) {
  if (!Number.isInteger(respondentCount) || !Number.isInteger(teamSize) || teamSize < 1) return false;
  if (respondentCount < MIN_RESPONDENTS || respondentCount > teamSize) return false;
  // When a published comparison reveals exactly one person's contribution, suppress it.
  if (previousCountPublic && Number.isInteger(previousRespondentCount) &&
      Math.abs(respondentCount - previousRespondentCount) < 2) return false;
  return true;
}
function safeDomainAverage({ respondentCount, teamSize, answers, previousRespondentCount, previousCountPublic = false }) {
  if (!canPublishAggregate({respondentCount,teamSize,previousRespondentCount,previousCountPublic})) return null;
  if (!Array.isArray(answers) || answers.length !== respondentCount ||
      answers.some(x => !Number.isInteger(x) || x < 1 || x > 5)) return null;
  return Math.round(10 * answers.reduce((a,b)=>a+b,0)/respondentCount)/10;
}
module.exports = {MIN_RESPONDENTS,canPublishAggregate,safeDomainAverage};
