/**
 * Course Management - POST /api/manage-courses
 * Create and update courses
 */

const { executeQuery } = require('./_shared/db');
const { transformCourseTypeToOracle } = require('./_shared/transformers');

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
    const { course_id, course_code, course_name, course_type, credit_hours, program_id } = data;

    if (!course_code || !course_name || !program_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const oracleCourseType = transformCourseTypeToOracle(course_type || 'Core');

    if (course_id) {
      // Update existing course
      await executeQuery(
        `UPDATE COURSE 
         SET course_code = :course_code,
             course_name = :course_name,
             course_type = :course_type,
             credit_hours = :credit_hours,
             program_id = :program_id
         WHERE course_id = :course_id`,
        {
          course_id: parseInt(course_id),
          course_code,
          course_name,
          course_type: oracleCourseType,
          credit_hours: parseInt(credit_hours) || 3,
          program_id: parseInt(program_id)
        }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          course_id,
          message: 'Course updated successfully'
        })
      };
    } else {
      // Insert new course
      const result = await executeQuery(
        `INSERT INTO COURSE (course_code, course_name, course_type, credit_hours, program_id)
         VALUES (:course_code, :course_name, :course_type, :credit_hours, :program_id)
         RETURNING course_id INTO :id`,
        {
          course_code,
          course_name,
          course_type: oracleCourseType,
          credit_hours: parseInt(credit_hours) || 3,
          program_id: parseInt(program_id),
          id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
        }
      );

      const newCourseId = result.outBinds.id[0];

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          course_id: String(newCourseId),
          message: 'Course created successfully'
        })
      };
    }

  } catch (error) {
    console.error('Error managing course:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to manage course',
        message: error.message
      })
    };
  }
};