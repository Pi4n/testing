/**
 * Enrollment Management - POST /api/manage-enrollments
 * Create and delete student enrollments
 */

const { executeQuery } = require('./_shared/db');
const { transformStatusToOracle } = require('./_shared/transformers');

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
    const { action, enrollment_id, student_id, course_id, semester, status, grade } = data;

    if (action === 'delete' && enrollment_id) {
      await executeQuery(
        'DELETE FROM ENROLLMENT WHERE enrollment_id = :enrollment_id',
        { enrollment_id: parseInt(enrollment_id) }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Enrollment deleted successfully'
        })
      };
    }

    if (!student_id || !course_id || !semester) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const oracleStatus = transformStatusToOracle(status || 'In Progress');

    // Insert enrollment
    const result = await executeQuery(
      `INSERT INTO ENROLLMENT (student_id, course_id, semester, status, grade)
       VALUES (:student_id, :course_id, :semester, :status, :grade)
       RETURNING enrollment_id INTO :id`,
      {
        student_id: parseInt(student_id),
        course_id: parseInt(course_id),
        semester,
        status: oracleStatus,
        grade: grade || null,
        id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
      }
    );

    const enrollmentId = result.outBinds.id[0];

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        enrollment_id: String(enrollmentId),
        message: 'Enrollment created successfully'
      })
    };

  } catch (error) {
    console.error('Error managing enrollment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to manage enrollment',
        message: error.message
      })
    };
  }
};