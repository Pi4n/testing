/**
 * Co-Curriculum Management - POST /api/manage-cocurriculum
 * Create activities, mappings, and student participation
 */

const { executeQuery } = require('./_shared/db');
const {
  transformCreditBearingToOracle,
  transformKnowledgeTypeToOracle,
  transformMappingStrengthToOracle,
  transformAchievementToOracle
} = require('./_shared/transformers');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
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
    const { type, action } = data;

    // Handle activity creation
    if (type === 'activity') {
      const { cocurr_id, activity_name, organizer, category, is_credit_bearing, credit_hours } = data;

      if (!activity_name || !organizer || !category) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      const oracleCreditBearing = transformCreditBearingToOracle(is_credit_bearing);

      if (cocurr_id) {
        // Update
        await executeQuery(
          `UPDATE CO_CURRICULUM 
           SET activity_name = :activity_name,
               organizer = :organizer,
               category = :category,
               is_credit_bearing = :is_credit_bearing,
               credit_hours = :credit_hours
           WHERE cocurr_id = :cocurr_id`,
          {
            cocurr_id: parseInt(cocurr_id),
            activity_name,
            organizer,
            category,
            is_credit_bearing: oracleCreditBearing,
            credit_hours: parseInt(credit_hours) || 0
          }
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, cocurr_id })
        };
      } else {
        // Insert
        const result = await executeQuery(
          `INSERT INTO CO_CURRICULUM (activity_name, organizer, category, is_credit_bearing, credit_hours)
           VALUES (:activity_name, :organizer, :category, :is_credit_bearing, :credit_hours)
           RETURNING cocurr_id INTO :id`,
          {
            activity_name,
            organizer,
            category,
            is_credit_bearing: oracleCreditBearing,
            credit_hours: parseInt(credit_hours) || 0,
            id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
          }
        );

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ success: true, cocurr_id: String(result.outBinds.id[0]) })
        };
      }
    }

    // Handle skill mapping
    if (type === 'skill-mapping') {
      if (action === 'delete') {
        await executeQuery(
          'DELETE FROM COCURR_SKILL_MAPPING WHERE mapping_id = :mapping_id',
          { mapping_id: parseInt(data.mapping_id) }
        );
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }

      const { cocurr_id, skill_id, knowledge_type, mapping_strength } = data;

      if (!cocurr_id || !skill_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      const oracleKnowledgeType = transformKnowledgeTypeToOracle(knowledge_type);
      const oracleStrength = transformMappingStrengthToOracle(mapping_strength || 0.6);

      const result = await executeQuery(
        `INSERT INTO COCURR_SKILL_MAPPING (cocurr_id, skill_id, knowledge_type, mapping_strength)
         VALUES (:cocurr_id, :skill_id, :knowledge_type, :mapping_strength)
         RETURNING mapping_id INTO :id`,
        {
          cocurr_id: parseInt(cocurr_id),
          skill_id: parseInt(skill_id),
          knowledge_type: oracleKnowledgeType,
          mapping_strength: oracleStrength,
          id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
        }
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, mapping_id: String(result.outBinds.id[0]) })
      };
    }

    // Handle student participation
    if (type === 'participation') {
      if (action === 'delete') {
        await executeQuery(
          'DELETE FROM STUDENT_COCURRICULUM WHERE record_id = :record_id',
          { record_id: parseInt(data.record_id) }
        );
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }

      const { student_id, cocurr_id, semester, role, achievement } = data;

      if (!student_id || !cocurr_id || !semester || !role) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      const oracleAchievement = transformAchievementToOracle(achievement || 0.7);

      const result = await executeQuery(
        `INSERT INTO STUDENT_COCURRICULUM (student_id, cocurr_id, semester, role, achievement)
         VALUES (:student_id, :cocurr_id, :semester, :role, :achievement)
         RETURNING record_id INTO :id`,
        {
          student_id: parseInt(student_id),
          cocurr_id: parseInt(cocurr_id),
          semester,
          role,
          achievement: oracleAchievement,
          id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
        }
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, record_id: String(result.outBinds.id[0]) })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request type' })
    };

  } catch (error) {
    console.error('Error managing co-curriculum:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to manage co-curriculum',
        message: error.message
      })
    };
  }
};