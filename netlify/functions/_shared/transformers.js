/**
 * Data Transformation Layer (Option B)
 * Converts between frontend format and Oracle database format
 */

/**
 * Transform course type from frontend to Oracle
 * Frontend: 'Core', 'Elective'
 * Oracle: 'Academic', 'Technical', 'Elective'
 */
function transformCourseTypeToOracle(frontendType) {
  const mapping = {
    'Core': 'Academic',
    'Elective': 'Elective',
    'Academic': 'Academic',
    'Technical': 'Technical'
  };
  return mapping[frontendType] || 'Academic';
}

function transformCourseTypeFromOracle(oracleType) {
  const mapping = {
    'Academic': 'Core',
    'Technical': 'Core',
    'Elective': 'Elective'
  };
  return mapping[oracleType] || 'Core';
}

/**
 * Transform enrollment status
 * Frontend: 'In Progress', 'Completed'
 * Oracle: 'Active', 'Completed', 'Withdrawn'
 */
function transformStatusToOracle(frontendStatus) {
  const mapping = {
    'In Progress': 'Active',
    'Completed': 'Completed',
    'Active': 'Active',
    'Withdrawn': 'Withdrawn'
  };
  return mapping[frontendStatus] || 'Active';
}

function transformStatusFromOracle(oracleStatus) {
  const mapping = {
    'Active': 'In Progress',
    'Completed': 'Completed',
    'Withdrawn': 'Withdrawn'
  };
  return mapping[oracleStatus] || 'In Progress';
}

/**
 * Transform knowledge type
 * Frontend: 'Hard', 'Soft', 'Professional'
 * Oracle: 'Academic Knowledge', 'Technical Skills', 'Marketability Values'
 */
function transformKnowledgeTypeToOracle(frontendType) {
  const mapping = {
    'Hard': 'Academic Knowledge',
    'Soft': 'Technical Skills',
    'Professional': 'Marketability Values',
    'Academic Knowledge': 'Academic Knowledge',
    'Technical Skills': 'Technical Skills',
    'Marketability Values': 'Marketability Values'
  };
  return mapping[frontendType] || 'Academic Knowledge';
}

function transformKnowledgeTypeFromOracle(oracleType) {
  const mapping = {
    'Academic Knowledge': 'Hard',
    'Technical Skills': 'Soft',
    'Marketability Values': 'Professional'
  };
  return mapping[oracleType] || 'Hard';
}

/**
 * Transform skill type
 * Frontend: 'Cognitive', 'Soft Skill', 'Professional'
 * Oracle: 'Academic Knowledge', 'Technical Skills', 'Marketability Values'
 */
function transformSkillTypeToOracle(frontendType) {
  const mapping = {
    'Cognitive': 'Academic Knowledge',
    'Soft Skill': 'Technical Skills',
    'Professional': 'Marketability Values',
    'Academic Knowledge': 'Academic Knowledge',
    'Technical Skills': 'Technical Skills',
    'Marketability Values': 'Marketability Values'
  };
  return mapping[frontendType] || 'Academic Knowledge';
}

function transformSkillTypeFromOracle(oracleType) {
  const mapping = {
    'Academic Knowledge': 'Cognitive',
    'Technical Skills': 'Soft Skill',
    'Marketability Values': 'Professional'
  };
  return mapping[oracleType] || 'Cognitive';
}

/**
 * Transform mapping strength
 * Frontend: 0.0-1.0 (number)
 * Oracle: 'Low', 'Medium', 'High' (string)
 */
function transformMappingStrengthToOracle(frontendStrength) {
  const num = parseFloat(frontendStrength);
  if (isNaN(num)) {
    // Already a string
    return ['Low', 'Medium', 'High'].includes(frontendStrength) ? frontendStrength : 'Medium';
  }
  if (num < 0.4) return 'Low';
  if (num < 0.7) return 'Medium';
  return 'High';
}

function transformMappingStrengthFromOracle(oracleStrength) {
  const mapping = {
    'Low': 0.3,
    'Medium': 0.6,
    'High': 0.9
  };
  return mapping[oracleStrength] || 0.6;
}

/**
 * Transform achievement value
 * Frontend: 0.0-1.0 (number)
 * Oracle: VARCHAR2(200) (string)
 */
function transformAchievementToOracle(frontendAchievement) {
  if (typeof frontendAchievement === 'number') {
    return frontendAchievement.toString();
  }
  return frontendAchievement || '0';
}

function transformAchievementFromOracle(oracleAchievement) {
  const num = parseFloat(oracleAchievement);
  return isNaN(num) ? 0 : num;
}

/**
 * Transform LO domain
 * Frontend: 'Academic', 'Co-curricular'
 * Oracle: 'Knowledge', 'Skills', 'Values'
 */
function transformLODomainToOracle(frontendDomain) {
  const mapping = {
    'Academic': 'Knowledge',
    'Co-curricular': 'Skills',
    'Knowledge': 'Knowledge',
    'Skills': 'Skills',
    'Values': 'Values'
  };
  return mapping[frontendDomain] || 'Knowledge';
}

function transformLODomainFromOracle(oracleDomain) {
  const mapping = {
    'Knowledge': 'Academic',
    'Skills': 'Co-curricular',
    'Values': 'Co-curricular'
  };
  return mapping[oracleDomain] || 'Academic';
}

/**
 * Transform credit bearing boolean
 * Frontend: true/false (boolean)
 * Oracle: 1/0 (number)
 */
function transformCreditBearingToOracle(frontendValue) {
  if (typeof frontendValue === 'boolean') {
    return frontendValue ? 1 : 0;
  }
  if (frontendValue === 'true') return 1;
  if (frontendValue === 'false') return 0;
  return frontendValue ? 1 : 0;
}

function transformCreditBearingFromOracle(oracleValue) {
  return oracleValue === 1 || oracleValue === '1';
}

module.exports = {
  transformCourseTypeToOracle,
  transformCourseTypeFromOracle,
  transformStatusToOracle,
  transformStatusFromOracle,
  transformKnowledgeTypeToOracle,
  transformKnowledgeTypeFromOracle,
  transformSkillTypeToOracle,
  transformSkillTypeFromOracle,
  transformMappingStrengthToOracle,
  transformMappingStrengthFromOracle,
  transformAchievementToOracle,
  transformAchievementFromOracle,
  transformLODomainToOracle,
  transformLODomainFromOracle,
  transformCreditBearingToOracle,
  transformCreditBearingFromOracle
};
