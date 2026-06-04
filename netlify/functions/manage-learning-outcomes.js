/**
 * Learning Outcome Management - POST /api/manage-learning-outcomes
 * Create, update, and delete learning outcomes
 */

const { executeQuery, ensureDefaultCourse } = require('./_shared/db');
const { transformLODomainToOracle } = require('./_shared/transformers');

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

  try {
    const data = JSON.parse(event.body);
    const { action, lo_id, lo_code, description, domain, course_id } = data;

    if (action === 'delete' && lo_id) {
      // Delete learning outcome
      await executeQuery(
        'DELETE FROM LEARNING_OUTCOME WHERE lo_id = :lo_id',
        { lo_id: parseInt(lo_id) }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Learning outcome deleted successfully'
        })
      };
    }

    if (!lo_code || !description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const oracleDomain = transformLODomainToOracle(domain || 'Academic');
    
    // Get course_id - use provided or default
    let finalCourseId = course_id ? parseInt(course_id) : await ensureDefaultCourse();

    if (lo_id) {
      // Update existing LO
      await executeQuery(
        `UPDATE LEARNING_OUTCOME 
         SET lo_code = :lo_code,
             description = :description,
             domain = :domain,
             course_id = :course_id
         WHERE lo_id = :lo_id`,
        {
          lo_id: parseInt(lo_id),
          lo_code,
          description,
          domain: oracleDomain,
          course_id: finalCourseId
        }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          lo_id,
          message: 'Learning outcome updated successfully'
        })
      };
    } else {
      // Insert new LO
      const result = await executeQuery(
        `INSERT INTO LEARNING_OUTCOME (lo_code, description, domain, course_id)
         VALUES (:lo_code, :description, :domain, :course_id)
         RETURNING lo_id INTO :id`,
        {
          lo_code,
          description,
          domain: oracleDomain,
          course_id: finalCourseId,
          id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
        }
      );

      const newLoId = result.outBinds.id[0];

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          lo_id: String(newLoId),
          message: 'Learning outcome created successfully'
        })
      };
    }

  } catch (error) {
    console.error('Error managing learning outcome:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to manage learning outcome',
        message: error.message
      })
    };
  }
};