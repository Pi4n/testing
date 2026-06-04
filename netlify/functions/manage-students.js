/**
 * Student Management - POST /api/manage-students
 * Create new student accounts
 */

const { executeQuery } = require('./_shared/db');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const { full_name, matric_no, email, program_id } = data;

    if (!full_name || !matric_no || !email || !program_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Insert student
    const result = await executeQuery(
      `INSERT INTO STUDENT (full_name, matric_no, email, program_id)
       VALUES (:full_name, :matric_no, :email, :program_id)
       RETURNING student_id INTO :id`,
      {
        full_name,
        matric_no,
        email,
        program_id: parseInt(program_id),
        id: { type: require('oracledb').NUMBER, dir: require('oracledb').BIND_OUT }
      }
    );

    const studentId = result.outBinds.id[0];

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        student_id: String(studentId),
        message: 'Student created successfully'
      })
    };

  } catch (error) {
    console.error('Error managing student:', error);
    
    // Handle unique constraint violations
    if (error.message.includes('unique constraint')) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: 'Student with this matric number or email already exists'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create student',
        message: error.message
      })
    };
  }
};
