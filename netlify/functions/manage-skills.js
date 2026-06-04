/**
 * Employability Skill Management - POST /api/manage-skills
 * Create employability skills with Option B type translation
 */

const { executeQuery } = require('./_shared/db');
const { transformSkillTypeToOracle } = require('./_shared/transformers');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { skill_name, skill_type, description } = data;

    if (!skill_name || !skill_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'skill_name and skill_type are required' })
      };
    }

    const oracleSkillType = transformSkillTypeToOracle(skill_type);

    const result = await executeQuery(
      `INSERT INTO EMPLOYABILITY_SKILL (skill_name, skill_type, description)
       VALUES (:skill_name, :skill_type, :description)
       RETURNING skill_id INTO :id`,
      {
        skill_name,
        skill_type: oracleSkillType,
        description: description || null,
        id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
      }
    );

    const skillId = result.outBinds.id[0];

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        skill_id: String(skillId),
        message: 'Skill created successfully'
      })
    };

  } catch (error) {
    console.error('Error managing skill:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create skill',
        message: error.message
      })
    };
  }
};
